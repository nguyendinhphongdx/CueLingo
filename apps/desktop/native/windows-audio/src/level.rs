//! Loudness of the audio, port of `AudioLevel.swift`. Both numbers are 0...1.

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Level {
    pub rms: f32,
    pub peak: f32,
}

impl Level {
    pub const SILENCE: Level = Level {
        rms: 0.0,
        peak: 0.0,
    };

    /// RMS and peak of 16-bit samples normalised to 0...1 (full scale = 1, clamped). Empty input is silence.
    pub fn of_i16(samples: &[i16]) -> Level {
        let mut sums = Sums::default();
        sums.add_i16(samples);
        sums.level().unwrap_or(Level::SILENCE)
    }

    /// Same for float samples in -1...1; values outside are clamped.
    pub fn of_f32(samples: &[f32]) -> Level {
        let mut sums = Sums::default();
        for &s in samples {
            sums.add(s.abs().min(1.0));
        }
        sums.level().unwrap_or(Level::SILENCE)
    }
}

#[derive(Default)]
struct Sums {
    sum_squares: f32,
    count: usize,
    peak: f32,
}

impl Sums {
    fn add(&mut self, value: f32) {
        self.sum_squares += value * value;
        self.peak = self.peak.max(value);
        self.count += 1;
    }

    fn add_i16(&mut self, samples: &[i16]) {
        for &s in samples {
            self.add((f32::from(s).abs() / 32768.0).min(1.0));
        }
    }

    fn level(&self) -> Option<Level> {
        (self.count > 0).then(|| Level {
            rms: (self.sum_squares / self.count as f32).sqrt().min(1.0),
            peak: self.peak,
        })
    }
}

/// Collects audio chunks and reports one level per `interval_ms` of wall time (not per chunk), covering
/// everything heard since the last report. Time is passed in so it is testable. One per stream.
pub struct LevelMeter {
    interval_ms: i64,
    last_report_ms: Option<i64>,
    sums: Sums,
}

impl Default for LevelMeter {
    fn default() -> Self {
        Self::new(100)
    }
}

impl LevelMeter {
    pub fn new(interval_ms: i64) -> Self {
        Self {
            interval_ms,
            last_report_ms: None,
            sums: Sums::default(),
        }
    }

    /// Adds a chunk; returns a level when a report is due (the first chunk reports at once).
    pub fn add(&mut self, samples: &[i16], now_ms: i64) -> Option<Level> {
        self.sums.add_i16(samples);
        if self.sums.count == 0 {
            return None;
        }
        if let Some(last) = self.last_report_ms {
            if now_ms - last < self.interval_ms {
                return None;
            }
        }
        let level = self.sums.level();
        self.last_report_ms = Some(now_ms);
        self.sums = Sums::default();
        level
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn near(a: f32, b: f32) -> bool {
        (a - b).abs() < 0.001
    }

    #[test]
    fn silence_and_empty_are_zero() {
        assert_eq!(Level::of_i16(&[0; 320]), Level::SILENCE);
        assert_eq!(Level::of_i16(&[]), Level::SILENCE);
        assert_eq!(Level::of_f32(&[]), Level::SILENCE);
    }

    #[test]
    fn full_scale_square_is_one() {
        let square: Vec<i16> = (0..320)
            .map(|i| if i % 2 == 0 { i16::MAX } else { i16::MIN })
            .collect();
        let level = Level::of_i16(&square);
        assert!(near(level.rms, 1.0) && near(level.peak, 1.0));
    }

    #[test]
    fn half_scale() {
        let level = Level::of_i16(&[16384; 100]);
        assert!(near(level.rms, 0.5) && near(level.peak, 0.5));
    }

    #[test]
    fn float_samples_are_clamped() {
        let mut samples = vec![3.0f32; 10];
        samples.push(-5.0);
        let level = Level::of_f32(&samples);
        assert!(near(level.rms, 1.0));
        assert_eq!(level.peak, 1.0);
    }

    #[test]
    fn meter_reports_first_chunk_then_once_per_interval() {
        let mut meter = LevelMeter::new(100);
        let loud = [16384i16; 320];
        assert!(meter.add(&loud, 0).is_some());
        assert!(meter.add(&loud, 20).is_none());
        assert!(meter.add(&loud, 99).is_none());
        assert!(meter.add(&loud, 100).is_some());
        assert!(meter.add(&loud, 150).is_none());
    }

    #[test]
    fn meter_covers_the_whole_interval() {
        let mut meter = LevelMeter::new(100);
        let _ = meter.add(&[0; 320], 0);
        let mut spike = vec![i16::MAX];
        spike.extend([0; 319]);
        let _ = meter.add(&spike, 40);
        let level = meter.add(&[0; 320], 100).unwrap();
        assert!(near(level.peak, 1.0));
    }

    #[test]
    fn meter_ignores_empty_chunks() {
        assert!(LevelMeter::default().add(&[], 0).is_none());
    }
}
