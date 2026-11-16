//! Converts whatever a device delivers (any rate, 1..n interleaved channels) into 16 kHz mono Int16, the
//! format recognition expects. Same job as `Resampler.swift`, which leans on AVAudioConverter; here it is a
//! streaming windowed-sinc filter so a 48 kHz source is low-passed before it is decimated.
//!
//! Streaming: feed chunks of any size, the output is the same as for one big chunk. Not thread-safe: one
//! instance per stream. After the first chunks `process_*` does not allocate when `out` has room.
use std::f64::consts::PI;

/// Rate the rest of the sidecar works at.
pub const OUTPUT_RATE: u32 = 16_000;

/// Zero crossings of the low-pass kept on each side of the centre tap.
const ZEROS: f64 = 8.0;
/// Kernel samples per input sample in the lookup table.
const RES: usize = 64;

pub struct Resampler {
    channels: usize,
    /// Input samples per output sample.
    ratio: f64,
    /// Half width of the kernel, in input samples.
    half: usize,
    table: Vec<f32>,
    /// Mono input not yet used up, starting with `half` samples of history (zeros at first).
    buf: Vec<f32>,
    /// Input samples already dropped from the front of `buf`.
    dropped: u64,
    /// Output samples produced so far.
    produced: u64,
}

impl Resampler {
    /// `None` when the device format makes no sense (zero rate or channels).
    pub fn new(input_rate: u32, channels: u16) -> Option<Self> {
        if input_rate == 0 || channels == 0 {
            return None;
        }
        let ratio = f64::from(input_rate) / f64::from(OUTPUT_RATE);
        // Cut off at the output Nyquist when decimating; keep everything when interpolating.
        let cutoff = (1.0 / ratio).min(1.0);
        let half = if ratio == 1.0 {
            0
        } else {
            (ZEROS / cutoff).ceil() as usize
        };
        let table = (0..=half * RES + 1)
            .map(|i| kernel(i as f64 / RES as f64, cutoff, half as f64) as f32)
            .collect();
        Some(Self {
            channels: usize::from(channels),
            ratio,
            half,
            table,
            buf: vec![0.0; half],
            dropped: 0,
            produced: 0,
        })
    }

    pub fn process_f32(&mut self, interleaved: &[f32], out: &mut Vec<i16>) {
        let n = self.channels;
        self.buf.extend(
            interleaved
                .chunks_exact(n)
                .map(|frame| frame.iter().sum::<f32>() / n as f32),
        );
        self.drain(out);
    }

    pub fn process_i16(&mut self, interleaved: &[i16], out: &mut Vec<i16>) {
        let n = self.channels;
        self.buf.extend(
            interleaved
                .chunks_exact(n)
                .map(|frame| frame.iter().map(|&s| f32::from(s)).sum::<f32>() / n as f32 / 32768.0),
        );
        self.drain(out);
    }

    fn drain(&mut self, out: &mut Vec<i16>) {
        let half = self.half as f64;
        loop {
            // Centre of the next output sample, in `buf` coordinates (`half` of history in front).
            let t = self.produced as f64 * self.ratio - self.dropped as f64 + half;
            let last = t.floor() + half;
            if last >= self.buf.len() as f64 {
                break;
            }
            out.push(to_i16(self.sample_at(t)));
            self.produced += 1;
        }
        // Keep only what the next output sample can still reach.
        let t = self.produced as f64 * self.ratio - self.dropped as f64 + half;
        let keep_from = ((t - half).floor().max(0.0)) as usize;
        if keep_from > 0 {
            self.buf.drain(..keep_from.min(self.buf.len()));
            self.dropped += keep_from as u64;
        }
    }

    fn sample_at(&self, t: f64) -> f32 {
        if self.half == 0 {
            return self.buf[t as usize];
        }
        let half = self.half as f64;
        let first = (t - half).ceil().max(0.0) as usize;
        let last = ((t + half).floor() as usize).min(self.buf.len() - 1);
        let mut sum = 0.0f32;
        for (i, &x) in self.buf.iter().enumerate().take(last + 1).skip(first) {
            let distance = (t - i as f64).abs() * RES as f64;
            let index = distance as usize;
            let frac = (distance - index as f64) as f32;
            let weight = self.table[index] * (1.0 - frac) + self.table[index + 1] * frac;
            sum += x * weight;
        }
        sum
    }
}

fn to_i16(sample: f32) -> i16 {
    (sample * 32768.0).round().clamp(-32768.0, 32767.0) as i16
}

/// Hann-windowed sinc low-pass; `cutoff` is the fraction of the input Nyquist... of the input rate (1 = none).
fn kernel(u: f64, cutoff: f64, half: f64) -> f64 {
    if u >= half {
        return 0.0;
    }
    let x = PI * u * cutoff;
    let sinc = if x == 0.0 { 1.0 } else { x.sin() / x };
    let window = 0.5 * (1.0 + (PI * u / half).cos());
    cutoff * sinc * window
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(rate: u32, hz: f64, seconds: f64, amplitude: f32) -> Vec<f32> {
        (0..(rate as f64 * seconds) as usize)
            .map(|i| amplitude * (2.0 * PI * hz * i as f64 / f64::from(rate)).sin() as f32)
            .collect()
    }

    fn rms(samples: &[i16]) -> f64 {
        let sum: f64 = samples
            .iter()
            .map(|&s| (f64::from(s) / 32768.0).powi(2))
            .sum();
        (sum / samples.len() as f64).sqrt()
    }

    fn convert(rate: u32, channels: u16, input: &[f32], chunk: usize) -> Vec<i16> {
        let mut r = Resampler::new(rate, channels).unwrap();
        let mut out = Vec::new();
        for piece in input.chunks(chunk) {
            r.process_f32(piece, &mut out);
        }
        out
    }

    #[test]
    fn nonsense_formats_are_refused() {
        assert!(Resampler::new(0, 1).is_none());
        assert!(Resampler::new(48_000, 0).is_none());
    }

    #[test]
    fn the_length_follows_the_rate() {
        let out = convert(48_000, 1, &sine(48_000, 440.0, 1.0, 0.5), 480);
        assert!((out.len() as i64 - 16_000).abs() <= 8, "{}", out.len());
        let out = convert(44_100, 1, &sine(44_100, 440.0, 1.0, 0.5), 441);
        assert!((out.len() as i64 - 16_000).abs() <= 8, "{}", out.len());
    }

    #[test]
    fn a_tone_in_the_speech_band_keeps_its_level() {
        // 0.5 amplitude sine: rms 0.3536.
        for rate in [48_000, 44_100, 32_000] {
            let out = convert(rate, 1, &sine(rate, 1000.0, 1.0, 0.5), 960);
            let level = rms(&out[200..out.len() - 200]);
            assert!((level - 0.3536).abs() < 0.01, "{rate}: {level}");
        }
    }

    #[test]
    fn a_tone_above_the_new_nyquist_is_filtered_out() {
        // 12 kHz cannot exist at 16 kHz; unfiltered decimation would fold it down to 4 kHz at full level.
        let out = convert(48_000, 1, &sine(48_000, 12_000.0, 1.0, 0.5), 960);
        assert!(rms(&out[200..out.len() - 200]) < 0.01);
    }

    #[test]
    fn the_output_does_not_depend_on_the_chunk_size() {
        let input = sine(48_000, 700.0, 0.5, 0.4);
        let whole = convert(48_000, 1, &input, input.len());
        for chunk in [1, 7, 480, 1000] {
            assert_eq!(convert(48_000, 1, &input, chunk), whole, "chunk {chunk}");
        }
    }

    #[test]
    fn channels_are_averaged_into_mono() {
        // Left a sine, right its opposite: the average is silence.
        let mono = sine(48_000, 500.0, 0.5, 0.5);
        let stereo: Vec<f32> = mono.iter().flat_map(|&s| [s, -s]).collect();
        assert!(rms(&convert(48_000, 2, &stereo, 960)) < 0.001);
        // Same sine in both channels keeps its level.
        let both: Vec<f32> = mono.iter().flat_map(|&s| [s, s]).collect();
        let level = rms(&convert(48_000, 2, &both, 960));
        assert!((level - 0.3536).abs() < 0.01, "{level}");
    }

    #[test]
    fn sixteen_khz_mono_passes_through() {
        let input = sine(16_000, 300.0, 0.25, 0.5);
        let out = convert(16_000, 1, &input, 100);
        assert_eq!(out.len(), input.len());
        for (a, b) in out.iter().zip(&input) {
            assert!((f32::from(*a) / 32768.0 - b).abs() < 0.001);
        }
    }

    #[test]
    fn clipping_is_clamped_not_wrapped() {
        let out = convert(16_000, 1, &[2.0, -2.0, 0.0], 3);
        assert_eq!(out, vec![32767, -32768, 0]);
    }

    #[test]
    fn integer_input_is_scaled_like_float_input() {
        let ints: Vec<i16> = (0..4800)
            .map(|i| (8000.0 * (i as f64 * 0.05).sin()) as i16)
            .collect();
        let floats: Vec<f32> = ints.iter().map(|&s| f32::from(s) / 32768.0).collect();
        let mut a = Vec::new();
        Resampler::new(48_000, 1)
            .unwrap()
            .process_i16(&ints, &mut a);
        let b = convert(48_000, 1, &floats, floats.len());
        assert_eq!(a.len(), b.len());
        assert!(a
            .iter()
            .zip(&b)
            .all(|(x, y)| (i32::from(*x) - i32::from(*y)).abs() <= 1));
    }
}
