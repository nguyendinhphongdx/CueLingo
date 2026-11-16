//! What a source of audio looks like to the rest of the sidecar. WASAPI loopback and microphone capture
//! (ADR 0020, plan step 7) implement `Capture` on Windows; until then every build gets `Unavailable`, which
//! says so instead of staying silent.
use std::fmt;

/// Called with 16 kHz mono Int16 chunks, from the capture thread.
///
/// The callback must not allocate, block on I/O or log per chunk (it can run on a real-time audio thread):
/// implementations copy into a pre-sized ring and a worker thread does the segmenting and recognition.
pub type SampleSink = Box<dyn FnMut(&[i16]) + Send>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CaptureError {
    /// This build has no capture for the stream yet.
    Unavailable,
    /// The device or the OS refused; the message is for the person, without audio content.
    Failed(String),
}

impl fmt::Display for CaptureError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CaptureError::Unavailable => {
                write!(
                    f,
                    "capture and captions are not available in this build yet"
                )
            }
            CaptureError::Failed(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for CaptureError {}

/// One stream of audio: the system output (`system`) or the microphone (`mic`).
pub trait Capture: Send {
    /// Starts delivering chunks to `sink`. Returns once capture runs (or failed to start).
    fn start(&mut self, sink: SampleSink) -> Result<(), CaptureError>;
    /// Stops delivering. Safe to call when never started.
    fn stop(&mut self);
    /// `Err(Unavailable)` when this build cannot capture at all, so a meeting can say so before it loads a
    /// model. A device that is merely missing or blocked is reported by `start`, not here.
    fn available(&self) -> Result<(), CaptureError> {
        Ok(())
    }
}

/// The stand-in for a platform with no capture: starting always fails with `Unavailable`.
pub struct Unavailable;

impl Capture for Unavailable {
    fn start(&mut self, _sink: SampleSink) -> Result<(), CaptureError> {
        Err(CaptureError::Unavailable)
    }

    fn stop(&mut self) {}

    fn available(&self) -> Result<(), CaptureError> {
        Err(CaptureError::Unavailable)
    }
}

/// The captures for a meeting: system audio and the microphone. Step 7 returns WASAPI ones on Windows.
pub fn platform() -> (Box<dyn Capture>, Box<dyn Capture>) {
    (Box::new(Unavailable), Box::new(Unavailable))
}
