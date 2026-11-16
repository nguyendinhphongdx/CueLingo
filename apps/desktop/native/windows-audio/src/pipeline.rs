//! One stream of audio (`system` or `mic`) from samples to protocol lines: level meter, sentence
//! segmenter, then either recognition (`segment` lines) or, for cloud languages, `utterance` lines.
//! Port of `Pipeline` in `Sources/Sidecar/main.swift`.
//!
//! Recognition runs on one worker thread per stream, in order, so a partial never lands after the final of
//! its sentence. A partial that arrives while one is still queued or running is dropped (the next one is
//! more up to date anyway); finals are never dropped.
use crate::level::LevelMeter;
use crate::pcm;
use crate::protocol::{self, Out};
use crate::segmenter::{Event, Segmenter, Utterance};
use crate::stt::Transcriber;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Instant;

/// How long a finished sentence took to recognise, for the `--bench` summary.
#[derive(Debug, Clone, Copy)]
pub struct FinalTiming {
    pub audio_ms: i64,
    pub elapsed_ms: f64,
}

/// Shared by every pipeline of a session.
#[derive(Clone)]
pub struct Shared {
    pub out: Out,
    pub transcriber: Arc<Transcriber>,
    /// Whether the meeting language is recognised in the cloud: then pipelines emit utterances, not text.
    pub cloud: Arc<AtomicBool>,
    pub finals: Arc<Mutex<Vec<FinalTiming>>>,
}

struct Job {
    utterance: Utterance,
    partial: bool,
}

struct Front {
    segmenter: Segmenter,
    meter: LevelMeter,
}

pub struct Pipeline {
    stream: &'static str,
    shared: Shared,
    front: Mutex<Front>,
    clock: Instant,
    busy: Arc<AtomicBool>,
    jobs: Mutex<Option<Sender<Job>>>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl Pipeline {
    pub fn new(stream: &'static str, shared: Shared) -> Self {
        let (tx, rx) = channel::<Job>();
        let busy = Arc::new(AtomicBool::new(false));
        let worker = {
            let shared = shared.clone();
            let busy = busy.clone();
            std::thread::spawn(move || {
                for job in rx {
                    recognise(stream, &shared, &job);
                    if job.partial {
                        busy.store(false, Ordering::Release);
                    }
                }
            })
        };
        Self {
            stream,
            shared,
            front: Mutex::new(Front {
                segmenter: Segmenter::default(),
                meter: LevelMeter::default(),
            }),
            clock: Instant::now(),
            busy,
            jobs: Mutex::new(Some(tx)),
            worker: Mutex::new(Some(worker)),
        }
    }

    /// Feed 16 kHz mono Int16 in any chunk size. Not for a real-time audio thread: it allocates.
    pub fn feed(&self, samples: &[i16]) {
        let cloud = self.shared.cloud.load(Ordering::Acquire);
        let (level, events) = {
            let Ok(mut front) = self.front.lock() else {
                return;
            };
            let now_ms = self.clock.elapsed().as_millis() as i64;
            let level = front.meter.add(samples, now_ms);
            if cloud {
                front.segmenter.set_limits(
                    pcm::MAX_UTTERANCE_MS,
                    pcm::MIN_SPEECH_MS,
                    Some(pcm::MIN_SILENCE_MS),
                );
            } else {
                front.segmenter.set_limits(15_000, 250, None);
            }
            (level, front.segmenter.push(samples))
        };
        if let Some(level) = level {
            self.shared
                .out
                .emit(protocol::level(self.stream, level.rms, level.peak));
        }
        for event in events {
            self.handle(event);
        }
    }

    /// Flushes the sentence in progress and waits until everything queued has been recognised and printed.
    pub fn finish(&self) {
        let events = self
            .front
            .lock()
            .map(|mut f| f.segmenter.flush())
            .unwrap_or_default();
        for event in events {
            self.handle(event);
        }
        // Closing the queue lets the worker run what is left and end.
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.take();
        }
        if let Ok(mut worker) = self.worker.lock() {
            if let Some(handle) = worker.take() {
                let _ = handle.join();
            }
        }
    }

    fn handle(&self, event: Event) {
        let (utterance, partial) = match event {
            Event::Partial(u) => (u, true),
            Event::Final(u) => (u, false),
        };
        if self.shared.cloud.load(Ordering::Acquire) {
            // Cloud language: only finished utterances leave, as audio; partials are not sent.
            if !partial {
                self.shared.out.emit(protocol::utterance(
                    &utterance.id,
                    self.stream,
                    utterance.start_ms,
                    utterance.end_ms,
                    &pcm::base64(&utterance.samples),
                ));
            }
            return;
        }
        if partial && self.busy.swap(true, Ordering::AcqRel) {
            return; // a recognition is already waiting or running
        }
        let sent = self
            .jobs
            .lock()
            .ok()
            .and_then(|jobs| jobs.as_ref().map(|tx| tx.send(Job { utterance, partial })))
            .is_some_and(|result| result.is_ok());
        if !sent && partial {
            self.busy.store(false, Ordering::Release);
        }
    }
}

fn recognise(stream: &str, shared: &Shared, job: &Job) {
    let u = &job.utterance;
    match shared.transcriber.transcribe(&u.samples) {
        Ok(result) => {
            if !job.partial {
                if let Ok(mut finals) = shared.finals.lock() {
                    finals.push(FinalTiming {
                        audio_ms: u.end_ms - u.start_ms,
                        elapsed_ms: result.elapsed_ms,
                    });
                }
            }
            if !result.text.is_empty() {
                shared.out.emit(protocol::segment(
                    &u.id,
                    stream,
                    u.start_ms,
                    u.end_ms,
                    &result.text,
                    job.partial,
                ));
            }
        }
        // The error text comes from the runtime and never carries what was said.
        Err(error) => shared
            .out
            .status("error", &format!("transcribe failed: {error}")),
    }
}
