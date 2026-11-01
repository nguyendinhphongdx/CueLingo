import Foundation

/// Splits a 16 kHz mono stream into utterances with a plain energy VAD.
/// Emits a `partial` snapshot every `partialEveryMs` while speech continues and a `final` after silence.
public final class UtteranceSegmenter {
    public enum Event {
        case partial(Utterance)
        case final(Utterance)
    }

    public struct Utterance {
        public let id: UUID
        public let startMs: Int
        public let endMs: Int
        public let samples: [Float]
    }

    private let sampleRate = 16_000
    private let threshold: Float
    private let minSilenceSamples: Int
    private let maxUtteranceSamples: Int
    private let minSpeechSamples: Int
    private let partialEverySamples: Int
    private let preRollSamples: Int

    private var total = 0  // samples seen so far
    private var buffer: [Float] = []
    private var preRoll: [Float] = []
    private var active = false
    private var id = UUID()
    private var startSample = 0
    private var silenceRun = 0
    private var speechSamples = 0
    private var sincePartial = 0

    public init(
        threshold: Float = 0.012, minSilenceMs: Int = 600, maxUtteranceMs: Int = 15_000,
        minSpeechMs: Int = 250, partialEveryMs: Int = 700, preRollMs: Int = 200
    ) {
        self.threshold = threshold
        minSilenceSamples = minSilenceMs * 16
        maxUtteranceSamples = maxUtteranceMs * 16
        minSpeechSamples = minSpeechMs * 16
        partialEverySamples = partialEveryMs * 16
        preRollSamples = preRollMs * 16
    }

    /// Feed samples in any chunk size; returns events produced by this chunk.
    public func push(_ chunk: [Int16]) -> [Event] {
        var events: [Event] = []
        let frame = 320  // 20 ms
        var index = 0
        while index < chunk.count {
            let end = min(index + frame, chunk.count)
            let floats = chunk[index..<end].map { Float($0) / 32768 }
            index = end
            let rms = (floats.reduce(0) { $0 + $1 * $1 } / Float(max(floats.count, 1))).squareRoot()
            let voiced = rms > threshold
            handle(floats, voiced: voiced, into: &events)
            total += floats.count
        }
        return events
    }

    /// Flush a pending utterance (end of the session).
    public func flush() -> [Event] {
        guard active, speechSamples >= minSpeechSamples else { reset(); return [] }
        let event = Event.final(snapshot())
        reset()
        return [event]
    }

    private func handle(_ floats: [Float], voiced: Bool, into events: inout [Event]) {
        if !active {
            if voiced {
                active = true
                id = UUID()
                startSample = total - preRoll.count
                buffer = preRoll + floats
                preRoll = []
                silenceRun = 0
                speechSamples = floats.count
                sincePartial = buffer.count
            } else {
                preRoll.append(contentsOf: floats)
                if preRoll.count > preRollSamples { preRoll.removeFirst(preRoll.count - preRollSamples) }
            }
            return
        }
        buffer.append(contentsOf: floats)
        sincePartial += floats.count
        if voiced {
            silenceRun = 0
            speechSamples += floats.count
        } else {
            silenceRun += floats.count
        }
        if silenceRun >= minSilenceSamples || buffer.count >= maxUtteranceSamples {
            if speechSamples >= minSpeechSamples { events.append(.final(snapshot())) }
            reset()
        } else if sincePartial >= partialEverySamples && speechSamples >= minSpeechSamples {
            sincePartial = 0
            events.append(.partial(snapshot()))
        }
    }

    private func snapshot() -> Utterance {
        Utterance(
            id: id, startMs: startSample / 16, endMs: (startSample + buffer.count) / 16, samples: buffer)
    }

    private func reset() {
        active = false
        buffer = []
        silenceRun = 0
        speechSamples = 0
        sincePartial = 0
    }
}
