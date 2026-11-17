//! WASAPI capture through cpal (ADR 0020, plan step 7).
//!
//! * `System`: loopback of the default *output* device. cpal turns a render endpoint into a loopback stream
//!   when an input stream is built on it, so this hears everything the person hears, like the Core Audio tap
//!   on macOS (no per-app filtering).
//! * `Microphone`: the default *input* device.
//!
//! Each capture owns one thread, because a cpal `Stream` is not `Send`: the thread opens the stream, drains
//! what the audio callback queued every 20 ms, resamples it and calls the sink. The audio callback itself only
//! copies into a pre-sized queue (no allocation, no I/O). When the stream errors or the default device
//! changes, the thread reopens it on the schedule of `reopen::retry_delay`.
use crate::capture::{Capture, CaptureError, SampleSink};
use crate::permissions;
use crate::pump::Pump;
use crate::reopen::retry_delay;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{ErrorKind, Stream, StreamConfig};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{sync_channel, SyncSender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

/// How often the worker drains the queue. Segmenting wants chunks of this order, not a callback per packet.
const TICK: Duration = Duration::from_millis(20);
/// How often the default device is compared with the one the stream was opened on.
const DEVICE_CHECK: Duration = Duration::from_secs(1);
/// Queue size in samples (about 2 s of 48 kHz stereo). A worker that stalls longer loses audio rather than
/// growing memory; the overrun is not logged from the callback.
const QUEUE_SAMPLES: usize = 48_000 * 2 * 2;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Source {
    System,
    Microphone,
}

impl Source {
    /// The prefix the app reads to know which stream a message is about.
    pub fn label(self) -> &'static str {
        match self {
            Source::System => "system audio",
            Source::Microphone => "microphone",
        }
    }
}

/// Reports a problem to the person (the session turns it into a protocol `status` line).
pub type Reporter = Arc<dyn Fn(&str) + Send + Sync>;

pub struct Wasapi {
    source: Source,
    report: Reporter,
    worker: Option<Worker>,
}

struct Worker {
    stop: Arc<AtomicBool>,
    thread: JoinHandle<()>,
}

impl Wasapi {
    pub fn new(source: Source, report: Reporter) -> Self {
        Self {
            source,
            report,
            worker: None,
        }
    }
}

impl Capture for Wasapi {
    fn start(&mut self, sink: SampleSink) -> Result<(), CaptureError> {
        if self.worker.is_some() {
            return Ok(());
        }
        if self.source == Source::Microphone && permissions::microphone() == "denied" {
            return Err(CaptureError::Failed(
                "blocked in Windows privacy settings (Microphone)".into(),
            ));
        }
        let stop = Arc::new(AtomicBool::new(false));
        let (first_tx, first_rx) = sync_channel(1);
        let thread = {
            let (source, report, stop) = (self.source, self.report.clone(), stop.clone());
            std::thread::Builder::new()
                .name(format!("capture-{}", source.label()))
                .spawn(move || run(source, sink, report, stop, first_tx))
                .map_err(|e| CaptureError::Failed(e.to_string()))?
        };
        // The first open decides whether start succeeded; later failures are reported through `report`.
        match first_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(())) => {
                self.worker = Some(Worker { stop, thread });
                Ok(())
            }
            Ok(Err(e)) => {
                let _ = thread.join();
                Err(e)
            }
            Err(_) => {
                stop.store(true, Ordering::Release);
                let _ = thread.join();
                Err(CaptureError::Failed("the device did not respond".into()))
            }
        }
    }

    fn stop(&mut self) {
        if let Some(worker) = self.worker.take() {
            worker.stop.store(true, Ordering::Release);
            let _ = worker.thread.join();
        }
    }
}

impl Drop for Wasapi {
    fn drop(&mut self) {
        self.stop();
    }
}

/// `granted` when the default output device can be opened for loopback, which is all Windows asks for: there
/// is no "system audio" permission to grant.
pub fn check_system_audio() -> Result<(), String> {
    open(Source::System, Arc::new(Queue::new()))
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// What the audio callback fills and the worker drains.
struct Queue {
    samples: Mutex<Vec<f32>>,
    broken: AtomicBool,
    /// The kind of the stream error that set `broken`, for the message (a fixed name, never audio).
    why: Mutex<Option<ErrorKind>>,
}

impl Queue {
    fn new() -> Self {
        Self {
            samples: Mutex::new(Vec::with_capacity(QUEUE_SAMPLES)),
            broken: AtomicBool::new(false),
            why: Mutex::new(None),
        }
    }
}

struct Opened {
    /// Dropping it stops the stream.
    _stream: Stream,
    device_id: Option<String>,
    rate: u32,
    channels: u16,
}

fn device_for(source: Source) -> Option<cpal::Device> {
    let host = cpal::default_host();
    match source {
        Source::System => host.default_output_device(),
        Source::Microphone => host.default_input_device(),
    }
}

fn id_of(device: &cpal::Device) -> Option<String> {
    device.id().ok().map(|id| id.to_string())
}

/// Whether a stream error means the stream is gone and must be reopened. cpal also reports things the stream
/// survives: an xrun is a glitch (it fires on a healthy loopback), a rerouted default device is followed by
/// the stream itself, and a refused real-time priority only costs latency. Reopening for those would tear
/// down a working stream over and over, so it never gets to deliver audio.
fn ends_the_stream(kind: ErrorKind) -> bool {
    !matches!(
        kind,
        ErrorKind::Xrun | ErrorKind::DeviceChanged | ErrorKind::RealtimeDenied
    )
}

fn explain(e: &cpal::Error) -> CaptureError {
    let text = match e.kind() {
        ErrorKind::PermissionDenied => "access denied by Windows".to_string(),
        ErrorKind::DeviceNotAvailable => "no device available".to_string(),
        ErrorKind::DeviceBusy => "the device is in use by an app with exclusive access".to_string(),
        _ => e.to_string(),
    };
    CaptureError::Failed(text)
}

fn open(source: Source, queue: Arc<Queue>) -> Result<Opened, CaptureError> {
    let device = device_for(source).ok_or_else(|| {
        CaptureError::Failed(match source {
            Source::System => "no output device".into(),
            Source::Microphone => "no input device".into(),
        })
    })?;
    let supported = match source {
        Source::System => device.default_output_config(),
        Source::Microphone => device.default_input_config(),
    }
    .map_err(|e| explain(&e))?;
    let config: StreamConfig = supported.into();
    let (rate, channels) = (supported.sample_rate(), supported.channels());

    let data_queue = queue.clone();
    let error_queue = queue;
    let stream = device
        .build_input_stream(
            config,
            move |data: &[f32], _| {
                // Real-time thread: copy and leave. A busy or full queue drops this packet.
                if let Ok(mut samples) = data_queue.samples.try_lock() {
                    if samples.len() + data.len() <= QUEUE_SAMPLES {
                        samples.extend_from_slice(data);
                    }
                }
            },
            move |error: cpal::Error| {
                if !ends_the_stream(error.kind()) {
                    return;
                }
                if let Ok(mut why) = error_queue.why.lock() {
                    *why = Some(error.kind());
                }
                error_queue.broken.store(true, Ordering::Release);
            },
            None,
        )
        .map_err(|e| explain(&e))?;
    stream.play().map_err(|e| explain(&e))?;
    Ok(Opened {
        _stream: stream,
        device_id: id_of(&device),
        rate,
        channels,
    })
}

enum Ended {
    Stopped,
    /// The stream failed or the default device changed.
    Broken(String),
}

/// Drains the queue into the sink until told to stop or the stream breaks.
fn pump_loop(
    source: Source,
    opened: &Opened,
    queue: &Queue,
    sink: &mut SampleSink,
    stop: &AtomicBool,
    delivered: &mut bool,
) -> Ended {
    let Some(mut pump) = Pump::new(opened.rate, opened.channels) else {
        return Ended::Broken("unusable device format".into());
    };
    let mut chunk: Vec<f32> = Vec::with_capacity(QUEUE_SAMPLES);
    let mut last_check = Instant::now();
    loop {
        if stop.load(Ordering::Acquire) {
            return Ended::Stopped;
        }
        std::thread::sleep(TICK);
        if queue.broken.load(Ordering::Acquire) {
            let kind = queue.why.lock().ok().and_then(|why| *why);
            return Ended::Broken(match kind {
                Some(kind) => format!("the audio device stopped ({kind:?})"),
                None => "the audio device stopped".into(),
            });
        }
        if let Ok(mut samples) = queue.samples.lock() {
            std::mem::swap(&mut *samples, &mut chunk);
        }
        if !chunk.is_empty() {
            pump.push(&chunk, sink);
            chunk.clear();
            *delivered = true;
        }
        if last_check.elapsed() >= DEVICE_CHECK {
            last_check = Instant::now();
            if let Some(now) = device_for(source).as_ref().and_then(id_of) {
                if opened.device_id.as_deref().is_some_and(|was| was != now) {
                    return Ended::Broken("the default audio device changed".into());
                }
            }
        }
    }
}

fn sleep_unless_stopped(total: Duration, stop: &AtomicBool) {
    let end = Instant::now() + total;
    while Instant::now() < end && !stop.load(Ordering::Acquire) {
        std::thread::sleep(TICK.min(end - Instant::now()));
    }
}

fn run(
    source: Source,
    mut sink: SampleSink,
    report: Reporter,
    stop: Arc<AtomicBool>,
    first: SyncSender<Result<(), CaptureError>>,
) {
    let say = |message: &str| report(&format!("{}: {message}", source.label()));
    let mut announced = false;
    let mut attempt = 0u32;
    while !stop.load(Ordering::Acquire) {
        let queue = Arc::new(Queue::new());
        match open(source, queue.clone()) {
            Ok(opened) => {
                if !announced {
                    announced = true;
                    let _ = first.send(Ok(()));
                }
                let mut delivered = false;
                let ended = pump_loop(source, &opened, &queue, &mut sink, &stop, &mut delivered);
                if delivered {
                    attempt = 0;
                }
                match ended {
                    Ended::Stopped => return,
                    Ended::Broken(why) => say(&why),
                }
            }
            Err(e) if !announced => {
                let _ = first.send(Err(e));
                return;
            }
            Err(e) => say(&e.to_string()),
        }
        match retry_delay(attempt) {
            Some(wait) => {
                attempt += 1;
                sleep_unless_stopped(wait, &stop);
            }
            None => {
                say("could not reopen the device; stopped trying");
                return;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn glitches_and_followed_reroutes_do_not_end_the_stream() {
        for kind in [
            ErrorKind::Xrun,
            ErrorKind::DeviceChanged,
            ErrorKind::RealtimeDenied,
        ] {
            assert!(!ends_the_stream(kind), "{kind:?}");
        }
    }

    #[test]
    fn a_lost_or_invalid_stream_does_end_it() {
        for kind in [
            ErrorKind::DeviceNotAvailable,
            ErrorKind::StreamInvalidated,
            ErrorKind::BackendError,
            ErrorKind::Other,
        ] {
            assert!(ends_the_stream(kind), "{kind:?}");
        }
    }
}
