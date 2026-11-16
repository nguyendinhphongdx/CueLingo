//! Splits a 16 kHz mono stream into utterances with a plain energy VAD.
//! Port of `UtteranceSegmenter.swift`: emits a `Partial` snapshot every `partial_every_ms` while speech
//! continues and a `Final` after silence. The two copies share vectors in `native/fixtures/segmenter.json`.

/// One stretch of speech with the audio so far.
#[derive(Debug, Clone, PartialEq)]
pub struct Utterance {
    pub id: String,
    pub start_ms: i64,
    pub end_ms: i64,
    pub samples: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    Partial(Utterance),
    Final(Utterance),
}

/// Samples per millisecond at 16 kHz.
const PER_MS: usize = 16;
/// The VAD looks at 20 ms frames.
const FRAME: usize = 320;

pub struct Segmenter {
    threshold: f32,
    default_min_silence: usize,
    min_silence: usize,
    max_utterance: usize,
    min_speech: usize,
    partial_every: usize,
    pre_roll_len: usize,

    total: usize, // samples seen so far
    buffer: Vec<f32>,
    pre_roll: Vec<f32>,
    active: bool,
    id: String,
    start_sample: usize,
    silence_run: usize,
    speech: usize,
    since_partial: usize,
}

impl Default for Segmenter {
    fn default() -> Self {
        Self::new(0.012, 600, 15_000, 250, 700, 200)
    }
}

impl Segmenter {
    pub fn new(
        threshold: f32,
        min_silence_ms: usize,
        max_utterance_ms: usize,
        min_speech_ms: usize,
        partial_every_ms: usize,
        pre_roll_ms: usize,
    ) -> Self {
        Self {
            threshold,
            default_min_silence: min_silence_ms * PER_MS,
            min_silence: min_silence_ms * PER_MS,
            max_utterance: max_utterance_ms * PER_MS,
            min_speech: min_speech_ms * PER_MS,
            partial_every: partial_every_ms * PER_MS,
            pre_roll_len: pre_roll_ms * PER_MS,
            total: 0,
            buffer: Vec::new(),
            pre_roll: Vec::new(),
            active: false,
            id: String::new(),
            start_sample: 0,
            silence_run: 0,
            speech: 0,
            since_partial: 0,
        }
    }

    /// The defaults except the longest utterance (the tests use short ones).
    pub fn with_max_utterance_ms(max_utterance_ms: usize) -> Self {
        Self::new(0.012, 600, max_utterance_ms, 250, 700, 200)
    }

    /// Changes the longest utterance, the shortest speech worth keeping and the silence that ends a sentence
    /// (`None` = the value given at construction); applies from the next frame on.
    pub fn set_limits(
        &mut self,
        max_utterance_ms: usize,
        min_speech_ms: usize,
        min_silence_ms: Option<usize>,
    ) {
        self.min_silence = min_silence_ms.map_or(self.default_min_silence, |ms| ms * PER_MS);
        self.max_utterance = max_utterance_ms * PER_MS;
        self.min_speech = min_speech_ms * PER_MS;
    }

    /// Feed samples in any chunk size; returns the events this chunk produced.
    pub fn push(&mut self, chunk: &[i16]) -> Vec<Event> {
        let mut events = Vec::new();
        for frame in chunk.chunks(FRAME) {
            let floats: Vec<f32> = frame.iter().map(|&s| f32::from(s) / 32768.0).collect();
            let sum: f32 = floats.iter().map(|s| s * s).sum();
            let rms = (sum / floats.len().max(1) as f32).sqrt();
            self.handle(&floats, rms > self.threshold, &mut events);
            self.total += floats.len();
        }
        events
    }

    /// Flush a pending utterance (end of the session).
    pub fn flush(&mut self) -> Vec<Event> {
        if !self.active || self.speech < self.min_speech {
            self.reset();
            return Vec::new();
        }
        let event = Event::Final(self.snapshot());
        self.reset();
        vec![event]
    }

    fn handle(&mut self, floats: &[f32], voiced: bool, events: &mut Vec<Event>) {
        if !self.active {
            if voiced {
                self.active = true;
                self.id = uuid::Uuid::new_v4().to_string();
                self.start_sample = self.total - self.pre_roll.len();
                self.buffer = std::mem::take(&mut self.pre_roll);
                self.buffer.extend_from_slice(floats);
                self.silence_run = 0;
                self.speech = floats.len();
                self.since_partial = self.buffer.len();
            } else {
                self.pre_roll.extend_from_slice(floats);
                if self.pre_roll.len() > self.pre_roll_len {
                    let extra = self.pre_roll.len() - self.pre_roll_len;
                    self.pre_roll.drain(..extra);
                }
            }
            return;
        }
        self.buffer.extend_from_slice(floats);
        self.since_partial += floats.len();
        if voiced {
            self.silence_run = 0;
            self.speech += floats.len();
        } else {
            self.silence_run += floats.len();
        }
        if self.silence_run >= self.min_silence || self.buffer.len() >= self.max_utterance {
            if self.speech >= self.min_speech {
                events.push(Event::Final(self.snapshot()));
            }
            self.reset();
        } else if self.since_partial >= self.partial_every && self.speech >= self.min_speech {
            self.since_partial = 0;
            events.push(Event::Partial(self.snapshot()));
        }
    }

    fn snapshot(&self) -> Utterance {
        Utterance {
            id: self.id.clone(),
            start_ms: (self.start_sample / PER_MS) as i64,
            end_ms: ((self.start_sample + self.buffer.len()) / PER_MS) as i64,
            samples: self.buffer.clone(),
        }
    }

    fn reset(&mut self) {
        self.active = false;
        self.buffer = Vec::new();
        self.silence_run = 0;
        self.speech = 0;
        self.since_partial = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pcm;

    fn tone(ms: usize) -> Vec<i16> {
        (0..ms * 16)
            .map(|i| (8000.0 * (i as f64 * 0.2).sin()) as i16)
            .collect()
    }

    fn silence(ms: usize) -> Vec<i16> {
        vec![0; ms * 16]
    }

    fn finals(events: &[Event]) -> usize {
        events
            .iter()
            .filter(|e| matches!(e, Event::Final(_)))
            .count()
    }

    #[test]
    fn silence_produces_nothing() {
        assert!(Segmenter::default().push(&silence(3000)).is_empty());
    }

    #[test]
    fn speech_then_silence_gives_partials_then_one_final() {
        let mut s = Segmenter::default();
        let mut events = s.push(&tone(2000));
        events.extend(s.push(&silence(1000)));
        let partials = events
            .iter()
            .filter(|e| matches!(e, Event::Partial(_)))
            .count();
        assert_eq!(finals(&events), 1);
        assert!(partials >= 2);
    }

    #[test]
    fn blip_shorter_than_min_speech_is_ignored() {
        let mut s = Segmenter::default();
        let mut events = s.push(&tone(100));
        events.extend(s.push(&silence(1000)));
        assert!(events.is_empty());
    }

    #[test]
    fn long_speech_is_forced_final() {
        let mut s = Segmenter::with_max_utterance_ms(3000);
        assert!(s
            .push(&tone(3500))
            .iter()
            .any(|e| matches!(e, Event::Final(_))));
    }

    /// Speech, a pause, speech, then a long silence; returns how many sentences came out.
    fn sentences(pause_ms: usize, cloud: bool) -> usize {
        let mut s = Segmenter::default(); // default min silence is 600
        if cloud {
            s.set_limits(
                pcm::MAX_UTTERANCE_MS,
                pcm::MIN_SPEECH_MS,
                Some(pcm::MIN_SILENCE_MS),
            );
        }
        let mut events = s.push(&tone(1000));
        events.extend(s.push(&silence(pause_ms)));
        events.extend(s.push(&tone(1000)));
        events.extend(s.push(&silence(1500)));
        finals(&events)
    }

    // The default is 600 ms, so a 400 ms breath splits in neither mode; 660 ms tells them apart.
    #[test]
    fn short_breath_does_not_split_in_either_mode() {
        assert_eq!(sentences(400, false), 1);
        assert_eq!(sentences(400, true), 1);
    }

    #[test]
    fn pause_between_default_and_cloud_silence_splits_only_with_default() {
        assert_eq!(sentences(660, false), 2);
        assert_eq!(sentences(660, true), 1);
    }

    #[test]
    fn long_pause_splits_in_both_modes() {
        assert_eq!(sentences(900, false), 2);
        assert_eq!(sentences(900, true), 2);
    }

    #[test]
    fn set_limits_without_silence_restores_the_default() {
        let mut s = Segmenter::default();
        s.set_limits(25_000, 300, Some(700));
        s.set_limits(15_000, 250, None);
        let mut events = s.push(&tone(1000));
        events.extend(s.push(&silence(660)));
        events.extend(s.push(&tone(1000)));
        assert_eq!(finals(&events), 1); // the first sentence ended at 600 ms
    }

    // From UtterancePCMTests.swift: the cap and the minimum speech of the cloud mode.
    #[test]
    fn cap_splits_long_speech_and_stays_under_the_api_limit() {
        let mut s = Segmenter::default();
        s.set_limits(pcm::MAX_UTTERANCE_MS, pcm::MIN_SPEECH_MS, None);
        let signal: Vec<i16> = (0..60 * 16_000)
            .map(|i| (8000.0 * (i as f64 * 0.2).sin()) as i16)
            .collect();
        let mut done = Vec::new();
        for chunk in signal.chunks(3200) {
            for event in s.push(chunk) {
                if let Event::Final(u) = event {
                    done.push(u);
                }
            }
        }
        assert!(done.len() >= 2);
        for u in done {
            assert!(u.samples.len() <= 25 * 16_000 + 320);
            assert!(pcm::base64(&u.samples).len() < 1_400_000);
        }
    }

    #[test]
    fn speech_under_three_tenths_of_a_second_is_dropped_for_the_cloud() {
        let mut s = Segmenter::default();
        s.set_limits(pcm::MAX_UTTERANCE_MS, pcm::MIN_SPEECH_MS, None);
        let mut events = s.push(&tone(280));
        events.extend(s.push(&silence(1000)));
        assert!(events.is_empty());
    }

    #[test]
    fn flush_gives_the_sentence_in_progress_once() {
        let mut s = Segmenter::default();
        let _ = s.push(&tone(500));
        assert_eq!(finals(&s.flush()), 1);
        assert!(s.flush().is_empty());
    }

    #[test]
    fn every_sentence_gets_its_own_id() {
        let mut s = Segmenter::default();
        let mut events = s.push(&tone(1000));
        events.extend(s.push(&silence(900)));
        events.extend(s.push(&tone(1000)));
        events.extend(s.push(&silence(900)));
        let ids: Vec<&str> = events
            .iter()
            .filter_map(|e| match e {
                Event::Final(u) => Some(u.id.as_str()),
                Event::Partial(_) => None,
            })
            .collect();
        assert_eq!(ids.len(), 2);
        assert_ne!(ids[0], ids[1]);
        assert_eq!(ids[0].len(), 36); // lowercase UUID, like the Swift side
    }
}
