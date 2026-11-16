//! Turns the audio of a finished utterance into the payload sent for cloud recognition.
//! Port of `UtterancePCM.swift`.
use base64::engine::general_purpose::STANDARD;
use base64::Engine;

/// Longest utterance for cloud recognition: 25 s of 16 kHz Int16 is 800,000 bytes, about 1,066,700 base64
/// characters, under the API limit of 1,400,000.
pub const MAX_UTTERANCE_MS: usize = 25_000;
/// Shorter speech than this is dropped (0.3 s).
pub const MIN_SPEECH_MS: usize = 300;
/// Silence that ends a sentence for cloud recognition: a short breath inside a sentence does not cut it.
pub const MIN_SILENCE_MS: usize = 700;

/// 16-bit little-endian mono PCM as base64. Samples are clamped to -1...1.
pub fn base64(samples: &[f32]) -> String {
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    for &sample in samples {
        // `as i16` saturates, which is the clamp; `round` is half away from zero like Swift's `.rounded()`.
        let value = (sample * 32768.0).round() as i16;
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    STANDARD.encode(bytes)
}

/// The inverse of `base64`, for tests.
pub fn samples_from_base64(text: &str) -> Option<Vec<f32>> {
    let bytes = STANDARD.decode(text).ok()?;
    if bytes.len() % 2 != 0 {
        return None;
    }
    Some(
        bytes
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| f32::from(i16::from_le_bytes(*pair)) / 32768.0)
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_keeps_int16_samples() {
        let ints: [i16; 6] = [0, 1, -1, 1234, -32768, 32767];
        let floats: Vec<f32> = ints.iter().map(|&i| f32::from(i) / 32768.0).collect();
        assert_eq!(samples_from_base64(&base64(&floats)), Some(floats));
    }

    #[test]
    fn clamps_out_of_range_and_is_little_endian() {
        use ::base64::Engine;
        let bytes = STANDARD.decode(base64(&[2.0, -2.0, 0.5])).unwrap();
        assert_eq!(bytes, [0xFF, 0x7F, 0x00, 0x80, 0x00, 0x40]);
    }

    #[test]
    fn rejects_text_that_is_not_pcm() {
        assert_eq!(samples_from_base64("not base64!"), None);
        assert_eq!(samples_from_base64("AQ=="), None); // one byte: half a sample
    }
}
