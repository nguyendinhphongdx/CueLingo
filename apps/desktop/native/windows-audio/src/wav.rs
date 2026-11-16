//! Minimal WAV support for `--file` and the tests: reads 16-bit PCM of any rate and channel count into
//! 16 kHz mono Int16, writes 16 kHz mono 16-bit PCM. Nothing here touches a device or the network.
use crate::resample::{Resampler, OUTPUT_RATE};

/// Reads a RIFF/WAVE file made of 16-bit PCM and returns it as 16 kHz mono Int16.
pub fn read_16k_mono(bytes: &[u8]) -> Result<Vec<i16>, String> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err("not a WAV file".into());
    }
    let mut format: Option<(u16, u16, u32, u16)> = None; // tag, channels, rate, bits
    let mut data: Option<&[u8]> = None;
    let mut at = 12;
    while at + 8 <= bytes.len() {
        let id = &bytes[at..at + 4];
        let size = u32::from_le_bytes([bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]])
            as usize;
        let body = at + 8;
        // A streamed file may claim more than it has; take what is there.
        let end = body.saturating_add(size).min(bytes.len());
        match id {
            b"fmt " if end - body >= 16 => {
                let b = &bytes[body..end];
                format = Some((
                    u16::from_le_bytes([b[0], b[1]]),
                    u16::from_le_bytes([b[2], b[3]]),
                    u32::from_le_bytes([b[4], b[5], b[6], b[7]]),
                    u16::from_le_bytes([b[14], b[15]]),
                ));
            }
            b"data" => data = Some(&bytes[body..end]),
            _ => {}
        }
        // Chunks are word aligned.
        at = end + (size & 1);
    }
    let (tag, channels, rate, bits) = format.ok_or("WAV has no fmt chunk")?;
    // 1 = PCM, 0xFFFE = extensible (the sub-format is PCM for everything we read).
    if !(tag == 1 || tag == 0xFFFE) || bits != 16 {
        return Err("only 16-bit PCM WAV is supported".into());
    }
    let data = data.ok_or("WAV has no data chunk")?;
    let samples: Vec<i16> = data
        .as_chunks::<2>()
        .0
        .iter()
        .map(|p| i16::from_le_bytes(*p))
        .collect();
    if rate == OUTPUT_RATE && channels == 1 {
        return Ok(samples);
    }
    let mut resampler = Resampler::new(rate, channels).ok_or("WAV has an unusable format")?;
    let mut out = Vec::with_capacity(samples.len() * OUTPUT_RATE as usize / rate as usize + 64);
    resampler.process_i16(&samples, &mut out);
    Ok(out)
}

/// 16 kHz mono 16-bit PCM WAV.
pub fn write_16k_mono(samples: &[i16]) -> Vec<u8> {
    let byte_count = (samples.len() * 2) as u32;
    let mut data = Vec::with_capacity(44 + samples.len() * 2);
    data.extend_from_slice(b"RIFF");
    data.extend_from_slice(&(36 + byte_count).to_le_bytes());
    data.extend_from_slice(b"WAVEfmt ");
    data.extend_from_slice(&16u32.to_le_bytes());
    data.extend_from_slice(&1u16.to_le_bytes()); // PCM
    data.extend_from_slice(&1u16.to_le_bytes()); // mono
    data.extend_from_slice(&OUTPUT_RATE.to_le_bytes());
    data.extend_from_slice(&(OUTPUT_RATE * 2).to_le_bytes());
    data.extend_from_slice(&2u16.to_le_bytes());
    data.extend_from_slice(&16u16.to_le_bytes());
    data.extend_from_slice(b"data");
    data.extend_from_slice(&byte_count.to_le_bytes());
    for s in samples {
        data.extend_from_slice(&s.to_le_bytes());
    }
    data
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_and_length() {
        let data = write_16k_mono(&[0, 1000, -1000]);
        assert_eq!(&data[0..4], b"RIFF");
        assert_eq!(data.len(), 44 + 6);
    }

    #[test]
    fn writes_what_it_reads() {
        let samples: Vec<i16> = (0..1000).map(|i| (i * 7 % 3000) as i16 - 1500).collect();
        assert_eq!(read_16k_mono(&write_16k_mono(&samples)).unwrap(), samples);
    }

    #[test]
    fn skips_chunks_it_does_not_know() {
        let plain = write_16k_mono(&[5, 6]);
        let mut with_list = plain[..36].to_vec(); // RIFF header + fmt chunk
        with_list.extend_from_slice(b"LIST\x03\x00\x00\x00abc\x00"); // odd size, padded
        with_list.extend_from_slice(&plain[36..]);
        assert_eq!(read_16k_mono(&with_list).unwrap(), vec![5, 6]);
    }

    #[test]
    fn other_rates_are_resampled_to_16k() {
        // 48 kHz stereo header over a half second of silence.
        let frames = 24_000usize;
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + frames as u32 * 4).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&[1, 0, 2, 0]);
        wav.extend_from_slice(&48_000u32.to_le_bytes());
        wav.extend_from_slice(&(48_000u32 * 4).to_le_bytes());
        wav.extend_from_slice(&[4, 0, 16, 0]);
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&(frames as u32 * 4).to_le_bytes());
        wav.extend(std::iter::repeat_n(0u8, frames * 4));
        let out = read_16k_mono(&wav).unwrap();
        assert!((out.len() as i64 - 8000).abs() <= 8, "{}", out.len());
    }

    #[test]
    fn refuses_what_it_cannot_read() {
        assert!(read_16k_mono(b"not a wav").is_err());
        let mut float = write_16k_mono(&[1, 2]);
        float[20] = 3; // IEEE float format tag
        assert!(read_16k_mono(&float).is_err());
        assert!(read_16k_mono(&write_16k_mono(&[1, 2])[..30]).is_err());
    }
}
