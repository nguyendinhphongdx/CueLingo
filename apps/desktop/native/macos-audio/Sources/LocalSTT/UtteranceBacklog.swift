/// Finished utterances heard while the speech model is still loading, kept in memory (never on disk) so
/// capture can start at once. The total is capped at `maxSamples`; when it overflows the oldest utterances
/// are dropped, so a long load loses the start of the meeting rather than the part that is happening now.
public struct UtteranceBacklog {
    /// 60 seconds of 16 kHz mono audio.
    public static let defaultMaxSamples = 16_000 * 60

    public let maxSamples: Int
    private var items: [UtteranceSegmenter.Utterance] = []
    private var total = 0

    public init(maxSamples: Int = UtteranceBacklog.defaultMaxSamples) {
        self.maxSamples = maxSamples
    }

    public var sampleCount: Int { total }
    public var isEmpty: Bool { items.isEmpty }

    /// Adds an utterance and returns how many older ones were dropped to stay under the cap.
    /// A single utterance longer than the cap is kept alone (it was already cut at the segmenter's limit).
    @discardableResult
    public mutating func push(_ utterance: UtteranceSegmenter.Utterance) -> Int {
        items.append(utterance)
        total += utterance.samples.count
        var dropped = 0
        while total > maxSamples, items.count > 1 {
            total -= items.removeFirst().samples.count
            dropped += 1
        }
        return dropped
    }

    /// Everything kept so far, oldest first, leaving the backlog empty.
    public mutating func drain() -> [UtteranceSegmenter.Utterance] {
        defer { items = []; total = 0 }
        return items
    }
}
