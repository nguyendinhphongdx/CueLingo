import Foundation

/// Collects how long each recognition took so a session can report p50 and p95 per language.
public struct LatencyStats {
    private var samples: [Double] = []

    public init() {}

    public var count: Int { samples.count }

    public mutating func record(_ milliseconds: Double) {
        samples.append(milliseconds)
    }

    /// Nearest-rank percentile (`p` in 0...100); nil when nothing was recorded.
    public func percentile(_ p: Double) -> Double? {
        guard !samples.isEmpty else { return nil }
        let sorted = samples.sorted()
        let rank = Int((p / 100 * Double(sorted.count)).rounded(.up))
        return sorted[min(max(rank, 1), sorted.count) - 1]
    }
}
