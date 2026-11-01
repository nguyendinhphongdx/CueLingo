import AVFoundation

/// Converts whatever the device delivers into mono 16 kHz Int16, the format STT expects.
/// Not thread-safe: use one instance per stream, from one thread.
public final class Resampler {
    public static let outputFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)!

    private let converter: AVAudioConverter

    public init?(from input: AVAudioFormat) {
        guard let converter = AVAudioConverter(from: input, to: Self.outputFormat) else { return nil }
        self.converter = converter
    }

    public func convert(_ buffer: AVAudioPCMBuffer) -> [Int16] {
        let ratio = Self.outputFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 64
        guard let out = AVAudioPCMBuffer(pcmFormat: Self.outputFormat, frameCapacity: capacity) else { return [] }
        var consumed = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if consumed {
                status.pointee = .noDataNow
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return buffer
        }
        guard error == nil, let channel = out.int16ChannelData?[0] else { return [] }
        return Array(UnsafeBufferPointer(start: channel, count: Int(out.frameLength)))
    }
}
