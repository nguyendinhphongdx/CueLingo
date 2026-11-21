//! Offline Vietnamese recognition, the fallback when the cloud is out of reach (ADR 0024).
//!
//! The sidecar still cuts the meeting into utterances; the webview sends one here only while it is in offline
//! mode. Nothing is downloaded during a meeting: the model comes down when the person turns the fallback on in
//! Settings. Design: apps/docs/docs/04-modules/01-desktop/local-stt.md.
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use base64::Engine as _;
use cuelingo_audio::stt::models::{self, ModelFile, ModelSpec};
use cuelingo_audio::stt::{Recognizer, MIN_SAMPLES};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};

use crate::commands::AppState;

/// Zipformer Vietnamese (about 70k hours), INT8 ONNX, by its author (`zzasdf/viet_iter3_pseudo_label`,
/// Apache-2.0). The revision, sizes and hashes are the ones of ADR 0024.
pub const ZIPFORMER_VI: ModelSpec = ModelSpec {
    id: "zipformer-vi-int8",
    revision: "e827965a37aab92a4455566fac49c0e80a23afef",
    files: &[
        ModelFile {
            name: "exp/encoder-epoch-12-avg-8.int8.onnx",
            size: 70_876_129,
            sha256: "b3abdef7a660fea7faf5e076b3c7613b0fc98406707103784d018189bb522124",
        },
        ModelFile {
            name: "exp/decoder-epoch-12-avg-8.onnx",
            size: 5_165_084,
            sha256: "d1d27cca84c824a8acf5ce6edf0f2c0880cfe295d2e69b95134de1707e1d9998",
        },
        ModelFile {
            name: "exp/joiner-epoch-12-avg-8.int8.onnx",
            size: 1_033_417,
            sha256: "38ec49e1c18e4feb0cad4de13e25c83a866cf56f4a66f22e8ff579d591a69a46",
        },
        ModelFile {
            name: "data/Vietnam_bpe_2000_new/tokens.txt",
            size: 25_847,
            sha256: "f536d03c2e95ebd2930cf0abec88e823bd17d3c1933da7ae6a82db3b80605e15",
        },
    ],
};

/// `resolve` URL prefix of the repository the files come from (`<hub>/<revision>/<name>`).
const HUB: &str = "https://huggingface.co/zzasdf/viet_iter3_pseudo_label/resolve";

/// Longest utterance taken, in seconds. The sidecar cuts at 25 s; this only guards the command.
const MAX_SECONDS: usize = 30;
const SAMPLE_RATE: u32 = 16_000;

/// The recognizer once loaded, and whether a download is running. Cloned into worker threads.
#[derive(Default)]
pub struct LocalStt {
    recognizer: Arc<Mutex<Option<Box<dyn Recognizer>>>>,
    downloading: Arc<AtomicBool>,
    /// Counts releases. A recognition that began before a release must not load the model back: the
    /// meeting it belonged to is over.
    epoch: Arc<AtomicU64>,
}

/// Clears the "downloading" flag however the download thread ends, even by a panic.
struct DownloadGuard(Arc<AtomicBool>);

impl Drop for DownloadGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSttStatus {
    /// `ready` (every file in place and verified) or `missing`.
    state: &'static str,
    size_bytes: u64,
    /// Whether this build can run the model at all (the `local-stt` feature).
    available: bool,
}

fn root() -> PathBuf {
    models::models_root()
}

/// 16-bit little-endian PCM in base64 (what an `utterance` event carries) to float samples.
fn decode_pcm(encoded: &str) -> Result<Vec<f32>, String> {
    if encoded.len() > MAX_SECONDS * SAMPLE_RATE as usize * 2 * 4 / 3 + 8 {
        return Err("utterance_too_long".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|_| "invalid_pcm".to_string())?;
    if bytes.len() % 2 != 0 {
        return Err("invalid_pcm".into());
    }
    Ok(bytes
        .as_chunks::<2>()
        .0
        .iter()
        .map(|pair| f32::from(i16::from_le_bytes(*pair)) / 32768.0)
        .collect())
}

/// The model writes ALL CAPS without punctuation. Lower-case it and capitalise the first letter; nothing
/// else is added or changed (no punctuation is invented, no word is rewritten).
pub fn normalize(text: &str) -> String {
    let lowered = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    let mut chars = lowered.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

#[cfg(feature = "local-stt")]
mod sherpa {
    use super::{models, root, Recognizer, ZIPFORMER_VI};
    use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig, OfflineTransducerModelConfig};

    struct Zipformer(OfflineRecognizer);

    impl Recognizer for Zipformer {
        fn recognize(&mut self, samples: &[f32]) -> Result<String, String> {
            // Each utterance is independent, so it gets a fresh stream (and a fresh decoder state).
            let stream = self.0.create_stream();
            stream.accept_waveform(16_000, samples);
            self.0.decode(&stream);
            let result = stream
                .get_result()
                .ok_or("recognition returned no result")?;
            Ok(result.text)
        }
    }

    pub fn load() -> Result<Box<dyn Recognizer>, String> {
        let dir = models::model_dir(&ZIPFORMER_VI, &root());
        let path = |name: &str| dir.join(name).to_string_lossy().into_owned();
        let mut config = OfflineRecognizerConfig::default();
        config.model_config.transducer = OfflineTransducerModelConfig {
            encoder: Some(path("exp/encoder-epoch-12-avg-8.int8.onnx")),
            decoder: Some(path("exp/decoder-epoch-12-avg-8.onnx")),
            joiner: Some(path("exp/joiner-epoch-12-avg-8.int8.onnx")),
        };
        config.model_config.tokens = Some(path("data/Vietnam_bpe_2000_new/tokens.txt"));
        // Two threads keep the meeting's own audio and the app responsive; one utterance at a time.
        config.model_config.num_threads = 2;
        config.model_config.provider = Some("cpu".into());
        let recognizer =
            OfflineRecognizer::create(&config).ok_or("the speech model could not be loaded")?;
        Ok(Box::new(Zipformer(recognizer)))
    }
}

#[cfg(not(feature = "local-stt"))]
mod sherpa {
    use super::Recognizer;
    pub fn load() -> Result<Box<dyn Recognizer>, String> {
        Err("local_stt_unavailable".into())
    }
}

/// Whether the model is on this machine and the build can run it.
#[tauri::command]
pub async fn local_stt_status() -> Result<LocalSttStatus, String> {
    // Off the main thread: the first check hashes ~77 MB when no marker file exists yet.
    tauri::async_runtime::spawn_blocking(|| LocalSttStatus {
        state: if models::is_installed(&ZIPFORMER_VI, &root()) {
            "ready"
        } else {
            "missing"
        },
        size_bytes: models::total_bytes(&ZIPFORMER_VI),
        available: cfg!(feature = "local-stt"),
    })
    .await
    .map_err(|_| "local_stt_failed".to_string())
}

fn event(app: &AppHandle, payload: Value) {
    let _ = app.emit("local-stt-model", payload);
}

/// Downloads the model in the background; one at a time and never during a meeting (the caller checks the
/// meeting). Progress and the end arrive as `local-stt-model` events: `downloading` with `progress` 0...1,
/// then `ready`, or `error` with a message that never holds meeting text.
#[tauri::command]
pub fn local_stt_download(
    app: AppHandle,
    state: State<LocalStt>,
    meeting: State<AppState>,
) -> Result<(), String> {
    if !cfg!(feature = "local-stt") {
        return Err("local_stt_unavailable".into());
    }
    if meeting.is_running() {
        return Err("session_already_running".into());
    }
    if state.downloading.swap(true, Ordering::AcqRel) {
        return Err("model_downloading".into());
    }
    let guard = DownloadGuard(state.downloading.clone());
    std::thread::spawn(move || {
        let _guard = guard;
        event(&app, json!({ "state": "downloading", "progress": 0.0 }));
        let mut last = 0.0_f64;
        let result = models::ensure(&ZIPFORMER_VI, HUB, &root(), &mut |progress| {
            // Quiet unless it moved by 5 points, like the sidecar's own download events.
            if progress - last >= 0.05 || progress >= 1.0 {
                last = progress;
                event(
                    &app,
                    json!({ "state": "downloading", "progress": progress }),
                );
            }
        });
        match result {
            Ok(_) => event(&app, json!({ "state": "ready" })),
            Err(message) => event(&app, json!({ "state": "error", "message": message })),
        }
    });
    Ok(())
}

/// Recognises one utterance (16 kHz mono PCM, 16-bit little-endian, base64). The model loads on the first
/// call and stays loaded until `local_stt_unload`. Returns the normalised text, which may be empty.
#[tauri::command]
pub async fn local_stt_transcribe(
    state: State<'_, LocalStt>,
    pcm: String,
    sample_rate: u32,
) -> Result<String, String> {
    if sample_rate != SAMPLE_RATE {
        return Err("invalid_sample_rate".into());
    }
    let recognizer = state.recognizer.clone();
    let epoch = state.epoch.clone();
    let epoch_at_call = epoch.load(Ordering::Acquire);
    tauri::async_runtime::spawn_blocking(move || {
        let mut samples = decode_pcm(&pcm)?;
        if samples.len() < MIN_SAMPLES {
            samples.resize(MIN_SAMPLES, 0.0);
        }
        let mut slot = recognizer
            .lock()
            .map_err(|_| "local_stt_failed".to_string())?;
        if slot.is_none() {
            // Released since this call began: the meeting is over, so do not load the model back.
            if epoch.load(Ordering::Acquire) != epoch_at_call {
                return Err("released".to_string());
            }
            if !models::is_installed(&ZIPFORMER_VI, &root()) {
                return Err("model_missing".to_string());
            }
            *slot = Some(sherpa::load()?);
        }
        let engine = slot.as_mut().ok_or("local_stt_failed")?;
        engine.recognize(&samples).map(|text| normalize(&text))
    })
    .await
    .map_err(|_| "local_stt_failed".to_string())?
}

/// Frees the model's memory (the fallback was turned off, or the meeting ended).
#[tauri::command]
pub async fn local_stt_unload(state: State<'_, LocalStt>) -> Result<(), String> {
    // Counted first, so a recognition that is still waiting for the lock sees it. The lock itself is awaited
    // off the main thread: a recognition may be loading the model (seconds) while holding it.
    state.epoch.fetch_add(1, Ordering::AcqRel);
    let recognizer = state.recognizer.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let Ok(mut slot) = recognizer.lock() {
            *slot = None;
        }
    })
    .await
    .map_err(|_| "local_stt_failed".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_is_pinned_completely() {
        assert_eq!(ZIPFORMER_VI.revision.len(), 40);
        let mut names = std::collections::HashSet::new();
        for file in ZIPFORMER_VI.files {
            assert_eq!(file.sha256.len(), 64, "{}", file.name);
            assert!(
                file.sha256.bytes().all(|b| b.is_ascii_hexdigit()),
                "{}",
                file.name
            );
            assert!(file.size > 0 && names.insert(file.name), "{}", file.name);
        }
        // About 77 MB, as ADR 0024 says.
        let total = models::total_bytes(&ZIPFORMER_VI);
        assert!((70_000_000..90_000_000).contains(&total), "{total}");
    }

    #[test]
    fn normalises_capitals_without_inventing_anything() {
        assert_eq!(normalize("XIN CHÀO CÁC BẠN"), "Xin chào các bạn");
        assert_eq!(normalize("  MỘT   HAI \n BA "), "Một hai ba");
        assert_eq!(
            normalize("ĐÃ DEPLOY LÊN PRODUCTION"),
            "Đã deploy lên production"
        );
        assert_eq!(normalize(""), "");
        assert_eq!(normalize("   "), "");
    }

    #[test]
    fn decodes_pcm16_little_endian() {
        let bytes: Vec<u8> = [0i16, 16384, -32768, 32767]
            .iter()
            .flat_map(|s| s.to_le_bytes())
            .collect();
        let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
        let samples = decode_pcm(&encoded).unwrap();
        assert_eq!(samples.len(), 4);
        assert_eq!(samples[0], 0.0);
        assert_eq!(samples[1], 0.5);
        assert_eq!(samples[2], -1.0);
        assert!((samples[3] - 0.999_97).abs() < 1e-4);
    }

    #[test]
    fn rejects_bad_or_oversized_pcm() {
        assert_eq!(decode_pcm("not base64!!").unwrap_err(), "invalid_pcm");
        // An odd number of bytes cannot be 16-bit samples.
        let odd = base64::engine::general_purpose::STANDARD.encode([1u8, 2, 3]);
        assert_eq!(decode_pcm(&odd).unwrap_err(), "invalid_pcm");
        let long = "A".repeat(MAX_SECONDS * SAMPLE_RATE as usize * 4);
        assert_eq!(decode_pcm(&long).unwrap_err(), "utterance_too_long");
    }

    #[test]
    fn an_empty_folder_has_no_model() {
        let root = std::env::temp_dir().join(format!("cuelingo-local-stt-{}", std::process::id()));
        assert!(!models::is_installed(&ZIPFORMER_VI, &root));
    }

    /// Real model, real audio: `CUELINGO_MODELS_DIR` holds the downloaded model and `CUELINGO_SMOKE_WAV` is a
    /// 16 kHz mono WAV. Run with `cargo test -- --ignored smoke`.
    #[cfg(feature = "local-stt")]
    #[test]
    #[ignore]
    fn smoke_recognises_a_real_clip() {
        let wav = std::env::var("CUELINGO_SMOKE_WAV").expect("CUELINGO_SMOKE_WAV");
        let pcm = cuelingo_audio::wav::read_16k_mono(&std::fs::read(wav).unwrap()).unwrap();
        let bytes: Vec<u8> = pcm.iter().flat_map(|s| s.to_le_bytes()).collect();
        let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
        let mut samples = decode_pcm(&encoded).unwrap();
        samples.resize(samples.len().max(MIN_SAMPLES), 0.0);
        assert!(
            models::is_installed(&ZIPFORMER_VI, &root()),
            "model not installed"
        );
        let mut engine = sherpa::load().unwrap();
        let started = std::time::Instant::now();
        let text = normalize(&engine.recognize(&samples).unwrap());
        println!("SMOKE {:?} in {} ms", text, started.elapsed().as_millis());
        assert!(!text.is_empty());
    }

    /// The real download, from Hugging Face into an empty folder: files in sub-folders, hashes, then one
    /// recognition. About 77 MB. Run with `CUELINGO_MODELS_DIR=<empty dir> cargo test -- --ignored smoke_download`.
    #[cfg(feature = "local-stt")]
    #[test]
    #[ignore]
    fn smoke_download_then_recognise() {
        assert!(
            !models::is_installed(&ZIPFORMER_VI, &root()),
            "use an empty folder"
        );
        let mut last = 0.0;
        models::ensure(&ZIPFORMER_VI, HUB, &root(), &mut |p| last = p).unwrap();
        assert!((last - 1.0).abs() < 1e-9);
        assert!(models::is_installed(&ZIPFORMER_VI, &root()));
        let mut engine = sherpa::load().unwrap();
        let text = engine.recognize(&vec![0.0; MIN_SAMPLES]).unwrap();
        println!("SMOKE_DOWNLOAD ok, silence -> {text:?}");
    }

    /// Speed and memory over a folder of 16 kHz mono WAVs (`CUELINGO_SMOKE_DIR`): real-time factor, p95 per
    /// clip and the process's resident memory. Run with `cargo test --release -- --ignored bench --nocapture`.
    #[cfg(feature = "local-stt")]
    #[test]
    #[ignore]
    fn bench_a_folder_of_clips() {
        let dir = std::env::var("CUELINGO_SMOKE_DIR").expect("CUELINGO_SMOKE_DIR");
        let mut engine = sherpa::load().unwrap();
        let mut times = Vec::new();
        let mut audio_s = 0.0;
        for entry in std::fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().is_none_or(|e| e != "wav") {
                continue;
            }
            let pcm = cuelingo_audio::wav::read_16k_mono(&std::fs::read(&path).unwrap()).unwrap();
            let mut samples: Vec<f32> = pcm.iter().map(|s| f32::from(*s) / 32768.0).collect();
            audio_s += samples.len() as f64 / 16_000.0;
            samples.resize(samples.len().max(MIN_SAMPLES), 0.0);
            let started = std::time::Instant::now();
            engine.recognize(&samples).unwrap();
            times.push(started.elapsed().as_secs_f64());
        }
        times.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let total: f64 = times.iter().sum();
        let rss_kb = std::process::Command::new("ps")
            .args(["-o", "rss=", "-p", &std::process::id().to_string()])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();
        println!(
            "BENCH clips={} audio={:.1}s rtf={:.4} p95={:.3}s rss={}MB",
            times.len(),
            audio_s,
            total / audio_s,
            times[(times.len() - 1) * 95 / 100],
            rss_kb.parse::<u64>().unwrap_or(0) / 1024
        );
    }
}
