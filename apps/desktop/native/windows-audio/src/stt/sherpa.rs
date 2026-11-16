//! Parakeet TDT v2 (int8 ONNX) through sherpa-onnx. The library is linked statically together with its own
//! ONNX Runtime, so no `onnxruntime.dll` is ever looked up on the machine (an old copy in System32 would
//! break loading, plan risk R10).
use super::models::{self, PARAKEET_TDT_V2_INT8};
use super::Timings;
use super::{ModelProvider, Recognizer};
use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig, OfflineTransducerModelConfig};
use std::path::PathBuf;

pub struct SherpaProvider {
    hub: String,
    root: PathBuf,
    threads: i32,
}

impl Default for SherpaProvider {
    fn default() -> Self {
        Self {
            hub: models::DEFAULT_HUB.to_string(),
            root: models::models_root(),
            threads: default_threads(),
        }
    }
}

/// Four threads is where this model stops getting faster on a typical laptop CPU; fewer cores get fewer.
/// `CUELINGO_STT_THREADS` overrides it (to measure).
fn default_threads() -> i32 {
    if let Some(n) = std::env::var("CUELINGO_STT_THREADS")
        .ok()
        .and_then(|v| v.parse::<i32>().ok())
        .filter(|n| *n > 0)
    {
        return n;
    }
    std::thread::available_parallelism().map_or(2, |n| n.get().min(4)) as i32
}

impl ModelProvider for SherpaProvider {
    fn load(
        &self,
        language: &str,
        progress: &mut dyn FnMut(f64),
    ) -> Result<(Box<dyn Recognizer>, Timings), String> {
        if !super::is_supported(language) {
            return Err(format!("no on-device model for {language}"));
        }
        let (dir, mut timings) =
            models::ensure(&PARAKEET_TDT_V2_INT8, &self.hub, &self.root, progress)?;
        let path = |name: &str| dir.join(name).to_string_lossy().into_owned();

        let mut config = OfflineRecognizerConfig::default();
        config.model_config.transducer = OfflineTransducerModelConfig {
            encoder: Some(path("encoder.int8.onnx")),
            decoder: Some(path("decoder.int8.onnx")),
            joiner: Some(path("joiner.int8.onnx")),
        };
        config.model_config.tokens = Some(path("tokens.txt"));
        config.model_config.model_type = Some("nemo_transducer".into());
        config.model_config.num_threads = self.threads;
        config.model_config.provider = Some("cpu".into());

        let started = std::time::Instant::now();
        let recognizer = OfflineRecognizer::create(&config)
            .ok_or("the speech model could not be loaded (see stderr)")?;
        timings.create_ms = started.elapsed().as_millis() as u64;
        Ok((Box::new(Sherpa(recognizer)), timings))
    }
}

struct Sherpa(OfflineRecognizer);

impl Recognizer for Sherpa {
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
