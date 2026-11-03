import Foundation

/// Loudness of a stretch of audio, both 0...1.
public struct AudioLevel: Equatable {
    public let rms: Float
    public let peak: Float

    /// RMS and peak of 16-bit samples normalised to 0...1 (full scale = 1, clamped). Empty input is silence.
    public static func of(_ samples: [Int16]) -> AudioLevel {
        var sumSquares: Float = 0
        var peak: Float = 0
        for sample in samples {
            let value = min(abs(Float(sample)) / 32768, 1)
            sumSquares += value * value
            peak = max(peak, value)
        }
        guard !samples.isEmpty else { return AudioLevel(rms: 0, peak: 0) }
        return AudioLevel(rms: min((sumSquares / Float(samples.count)).squareRoot(), 1), peak: peak)
    }

    /// Same for float samples in -1...1; values outside are clamped.
    public static func of(_ samples: [Float]) -> AudioLevel {
        var sumSquares: Float = 0
        var peak: Float = 0
        for sample in samples {
            let value = min(abs(sample), 1)
            sumSquares += value * value
            peak = max(peak, value)
        }
        guard !samples.isEmpty else { return AudioLevel(rms: 0, peak: 0) }
        return AudioLevel(rms: min((sumSquares / Float(samples.count)).squareRoot(), 1), peak: peak)
    }
}

/// Collects audio chunks and reports one level per `intervalMs` of wall time (not per chunk), covering
/// everything heard since the last report. Time is passed in so it is testable. Not thread-safe: one per stream.
public struct LevelMeter {
    private let intervalMs: Int
    private var lastReportMs: Int?
    private var sumSquares: Float = 0
    private var count = 0
    private var peak: Float = 0

    public init(intervalMs: Int = 100) { self.intervalMs = intervalMs }

    /// Adds a chunk; returns a level when a report is due (the first chunk reports at once).
    public mutating func add(_ samples: [Int16], nowMs: Int) -> AudioLevel? {
        for sample in samples {
            let value = min(abs(Float(sample)) / 32768, 1)
            sumSquares += value * value
            peak = max(peak, value)
        }
        count += samples.count
        guard count > 0 else { return nil }
        if let last = lastReportMs, nowMs - last < intervalMs { return nil }
        let level = AudioLevel(rms: min((sumSquares / Float(count)).squareRoot(), 1), peak: peak)
        lastReportMs = nowMs
        sumSquares = 0
        count = 0
        peak = 0
        return level
    }
}
