//! Turns what a device delivers (any rate, interleaved f32) into the 16 kHz mono Int16 the rest of the sidecar
//! takes, and hands it to the sink. Kept apart from WASAPI so it runs and is tested on any platform.
use crate::capture::SampleSink;
use crate::resample::Resampler;

pub struct Pump {
    resampler: Resampler,
    scratch: Vec<i16>,
}

impl Pump {
    /// `None` for a device format that makes no sense (zero rate or channels).
    pub fn new(input_rate: u32, channels: u16) -> Option<Self> {
        Some(Self {
            resampler: Resampler::new(input_rate, channels)?,
            // Room for a few hundred ms so steady-state pushes do not allocate.
            scratch: Vec::with_capacity(16_000),
        })
    }

    /// Resamples one chunk and passes the result on. Silence in gives silence out (never skipped), so the
    /// segmenter keeps seeing time pass.
    pub fn push(&mut self, interleaved: &[f32], sink: &mut SampleSink) {
        self.scratch.clear();
        self.resampler.process_f32(interleaved, &mut self.scratch);
        if !self.scratch.is_empty() {
            sink(&self.scratch);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    fn collecting() -> (SampleSink, Arc<Mutex<Vec<i16>>>) {
        let got = Arc::new(Mutex::new(Vec::new()));
        let sink_got = got.clone();
        let sink: SampleSink =
            Box::new(move |s: &[i16]| sink_got.lock().unwrap().extend_from_slice(s));
        (sink, got)
    }

    #[test]
    fn rejects_a_device_format_that_makes_no_sense() {
        assert!(Pump::new(0, 2).is_none());
        assert!(Pump::new(48_000, 0).is_none());
    }

    #[test]
    fn one_second_of_48k_stereo_becomes_about_16k_mono_samples() {
        let (mut sink, got) = collecting();
        let mut pump = Pump::new(48_000, 2).unwrap();
        let chunk = vec![0.25f32; 48_000 * 2 / 10]; // 100 ms
        for _ in 0..10 {
            pump.push(&chunk, &mut sink);
        }
        let n = got.lock().unwrap().len();
        // The filter holds back a few samples of history; one second in gives within 1 % out.
        assert!((15_800..=16_000).contains(&n), "got {n} samples");
    }

    #[test]
    fn silence_is_still_delivered() {
        let (mut sink, got) = collecting();
        let mut pump = Pump::new(16_000, 1).unwrap();
        pump.push(&[0.0; 1_600], &mut sink);
        assert_eq!(got.lock().unwrap().len(), 1_600);
    }

    #[test]
    fn an_empty_chunk_calls_the_sink_not_at_all() {
        let (mut sink, got) = collecting();
        let mut pump = Pump::new(16_000, 1).unwrap();
        pump.push(&[], &mut sink);
        assert!(got.lock().unwrap().is_empty());
    }
}
