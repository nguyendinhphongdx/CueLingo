import Foundation

/// Minimal 16 kHz mono 16-bit WAV writer, used by the spike and tests only.
public enum Wav {
    public static func data(samples: [Int16], sampleRate: Int = 16_000) -> Data {
        var data = Data()
        func u32(_ v: UInt32) { withUnsafeBytes(of: v.littleEndian) { data.append(contentsOf: $0) } }
        func u16(_ v: UInt16) { withUnsafeBytes(of: v.littleEndian) { data.append(contentsOf: $0) } }
        let byteCount = UInt32(samples.count * 2)
        data.append(contentsOf: Array("RIFF".utf8)); u32(36 + byteCount)
        data.append(contentsOf: Array("WAVEfmt ".utf8)); u32(16); u16(1); u16(1)
        u32(UInt32(sampleRate)); u32(UInt32(sampleRate * 2)); u16(2); u16(16)
        data.append(contentsOf: Array("data".utf8)); u32(byteCount)
        samples.withUnsafeBufferPointer { data.append(UnsafeBufferPointer(start: $0.baseAddress, count: $0.count)) }
        return data
    }

    public static func rms(_ samples: [Int16]) -> Double {
        guard !samples.isEmpty else { return 0 }
        let sum = samples.reduce(0.0) { $0 + Double($1) * Double($1) }
        return (sum / Double(samples.count)).squareRoot() / 32768
    }
}
