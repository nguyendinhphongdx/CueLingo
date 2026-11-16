//! On-device speech to text. `Transcriber` is the port of `Transcriber.swift`: it holds the recognizer for the
//! meeting language, applies the user's glossary, records how long each recognition took, and can switch
//! models while running (the old one keeps recognising until the new one is ready).
//!
//! What actually runs the model sits behind `ModelProvider` / `Recognizer`: Parakeet through sherpa-onnx in
//! production (`sherpa.rs`), a fake in the tests.
pub mod models;
#[cfg(feature = "stt")]
pub mod sherpa;

use crate::stats::LatencyStats;
use crate::vocabulary::VocabularyCorrector;
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// Language codes recognised on this machine, in the codes of `SUPPORTED_LANGUAGES` in `@cuelingo/shared`.
/// Windows has one on-device model (English); the Japanese one of macOS is not ported (plan G4).
pub const LANGUAGES: &[&str] = &["en"];

/// Languages recognised in the cloud, with no model here: the sidecar only cuts their audio into utterances.
/// Mirrors `recognition: 'cloud'` in packages/shared/src/languages.ts and `SpeechModels.cloudLanguages`.
pub const CLOUD_LANGUAGES: &[&str] = &["vi", "ja", "ko", "zh"];

pub fn is_cloud(language: &str) -> bool {
    CLOUD_LANGUAGES.contains(&language)
}

pub fn is_supported(language: &str) -> bool {
    LANGUAGES.contains(&language)
}

/// The model needs at least ~1 s of audio; shorter utterances are padded with silence.
pub const MIN_SAMPLES: usize = 16_000;

/// How long the phases of getting a model ready took (for the `--bench` line and for finding slow machines).
#[derive(Debug, Default, Clone, Copy)]
pub struct Timings {
    pub download_ms: u64,
    pub verify_ms: u64,
    /// Time the runtime took to read the files and build the model (set by the recognizer, not by `ensure`).
    pub create_ms: u64,
}

/// Turns 16 kHz mono float audio into text. One utterance at a time.
pub trait Recognizer: Send {
    fn recognize(&mut self, samples: &[f32]) -> Result<String, String>;
}

/// Gets a recognizer ready for a language: downloads the model when needed, then loads it.
pub trait ModelProvider: Send + Sync {
    /// `progress` gets 0...1 while files are being downloaded.
    fn load(
        &self,
        language: &str,
        progress: &mut dyn FnMut(f64),
    ) -> Result<(Box<dyn Recognizer>, Timings), String>;
}

/// The provider the sidecar runs with: Parakeet through sherpa-onnx, or a refusal in a build without `stt`.
pub fn default_provider() -> Arc<dyn ModelProvider> {
    #[cfg(feature = "stt")]
    return Arc::new(sherpa::SherpaProvider::default());
    #[cfg(not(feature = "stt"))]
    return Arc::new(NoModel);
}

/// Stands in when the build has no recognition library (`--no-default-features`).
#[cfg(not(feature = "stt"))]
struct NoModel;

#[cfg(not(feature = "stt"))]
impl ModelProvider for NoModel {
    fn load(
        &self,
        _language: &str,
        _progress: &mut dyn FnMut(f64),
    ) -> Result<(Box<dyn Recognizer>, Timings), String> {
        Err("this build has no speech recognition".into())
    }
}

pub struct Transcription {
    pub text: String,
    /// How long the model took, in milliseconds.
    pub elapsed_ms: f64,
}

struct Active {
    recognizer: Box<dyn Recognizer>,
    language: String,
}

pub struct Transcriber {
    provider: Arc<dyn ModelProvider>,
    active: Mutex<Option<Active>>,
    corrector: Mutex<VocabularyCorrector>,
    stats: Mutex<BTreeMap<String, LatencyStats>>,
}

impl Transcriber {
    pub fn new(provider: Arc<dyn ModelProvider>) -> Self {
        Self {
            provider,
            active: Mutex::new(None),
            corrector: Mutex::new(VocabularyCorrector::default()),
            stats: Mutex::new(BTreeMap::new()),
        }
    }

    /// The user's glossary terms for the current meeting; applied to every later utterance.
    pub fn set_vocabulary<S: AsRef<str>>(&self, terms: &[S]) {
        if let Ok(mut corrector) = self.corrector.lock() {
            *corrector = VocabularyCorrector::new(terms);
        }
    }

    /// The language the loaded model recognises; `None` before the first load.
    pub fn language(&self) -> Option<String> {
        self.active
            .lock()
            .ok()?
            .as_ref()
            .map(|a| a.language.clone())
    }

    /// Loads (downloading on first use) the model for `language`. Switching to the language that is already
    /// loaded does nothing. The swap happens only when the new model is ready.
    pub fn load(&self, language: &str, progress: &mut dyn FnMut(f64)) -> Result<Timings, String> {
        if self.language().as_deref() == Some(language) {
            return Ok(Timings::default());
        }
        // Not under the lock: a download must not stop recognition on the old model.
        let (recognizer, timings) = self.provider.load(language, progress)?;
        let mut active = self.active.lock().map_err(|_| "recognizer lock poisoned")?;
        *active = Some(Active {
            recognizer,
            language: language.to_string(),
        });
        Ok(timings)
    }

    pub fn transcribe(&self, input: &[f32]) -> Result<Transcription, String> {
        let padded;
        let samples = if input.len() < MIN_SAMPLES {
            let mut v = input.to_vec();
            v.resize(MIN_SAMPLES, 0.0);
            padded = v;
            &padded[..]
        } else {
            input
        };
        let mut guard = self.active.lock().map_err(|_| "recognizer lock poisoned")?;
        let active = guard.as_mut().ok_or("no speech model is loaded")?;
        let started = Instant::now();
        let raw = active.recognizer.recognize(samples)?;
        let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;
        let language = active.language.clone();
        drop(guard);
        if let Ok(mut stats) = self.stats.lock() {
            stats.entry(language).or_default().record(elapsed_ms);
        }
        let text = self
            .corrector
            .lock()
            .map(|c| c.correct(raw.trim()))
            .unwrap_or_else(|_| raw.trim().to_string());
        Ok(Transcription { text, elapsed_ms })
    }

    /// Per language: how many recognitions ran and their p50/p95 in milliseconds.
    pub fn latency_summary(&self) -> Vec<(String, usize, f64, f64)> {
        let Ok(stats) = self.stats.lock() else {
            return Vec::new();
        };
        stats
            .iter()
            .filter_map(|(language, value)| {
                Some((
                    language.clone(),
                    value.count(),
                    value.percentile(50.0)?,
                    value.percentile(95.0)?,
                ))
            })
            .collect()
    }
}
