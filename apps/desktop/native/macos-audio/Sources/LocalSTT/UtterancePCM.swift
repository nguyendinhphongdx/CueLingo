import Foundation

/// Turns the audio of a finished utterance into the payload sent for cloud recognition.
public enum UtterancePCM {
    /// Longest utterance for cloud recognition: 25 s of 16 kHz Int16 is 800,000 bytes, about 1,066,700 base64
    /// characters, under the API limit of 1,400,000.
    public static let maxUtteranceMs = 25_000
    /// Shorter speech than this is dropped (0.3 s).
    public static let minSpeechMs = 300

    /// Silence that ends a sentence for cloud recognition: a short breath inside a sentence does not cut it.
    public static let minSilenceMs = 700

    /// 16-bit little-endian mono PCM as base64. Samples are clamped to -1...1.
    public static func base64(_ samples: [Float]) -> String {
        var data = Data(capacity: samples.count * 2)
        for sample in samples {
            let value = Int16(max(-32768, min(32767, (sample * 32768).rounded())))
            let bits = UInt16(bitPattern: value)
            data.append(UInt8(bits & 0xFF))
            data.append(UInt8(bits >> 8))
        }
        return data.base64EncodedString()
    }

    /// The inverse of `base64`, for tests.
    public static func samples(fromBase64 text: String) -> [Float]? {
        guard let data = Data(base64Encoded: text), data.count % 2 == 0 else { return nil }
        let bytes = [UInt8](data)
        return stride(from: 0, to: bytes.count, by: 2).map { index in
            let bits = UInt16(bytes[index]) | UInt16(bytes[index + 1]) << 8
            return Float(Int16(bitPattern: bits)) / 32768
        }
    }
}
