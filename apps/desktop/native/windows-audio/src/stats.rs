//! Collects how long each recognition took so a session can report p50 and p95 per language.
//! Port of `LatencyStats.swift`.

#[derive(Debug, Clone, Default)]
pub struct LatencyStats {
    samples: Vec<f64>,
}

impl LatencyStats {
    pub fn count(&self) -> usize {
        self.samples.len()
    }

    pub fn record(&mut self, milliseconds: f64) {
        self.samples.push(milliseconds);
    }

    /// Nearest-rank percentile (`p` in 0...100); `None` when nothing was recorded.
    pub fn percentile(&self, p: f64) -> Option<f64> {
        percentile(&self.samples, p)
    }
}

/// Nearest-rank percentile of any list of numbers.
pub fn percentile(samples: &[f64], p: f64) -> Option<f64> {
    if samples.is_empty() {
        return None;
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(f64::total_cmp);
    let rank = (p / 100.0 * sorted.len() as f64).ceil() as usize;
    Some(sorted[rank.clamp(1, sorted.len()) - 1])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_has_no_percentile() {
        assert_eq!(LatencyStats::default().percentile(50.0), None);
    }

    #[test]
    fn nearest_rank_of_ten_samples() {
        let mut stats = LatencyStats::default();
        for ms in [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0] {
            stats.record(ms);
        }
        assert_eq!(stats.count(), 10);
        assert_eq!(stats.percentile(50.0), Some(50.0));
        assert_eq!(stats.percentile(95.0), Some(100.0));
        assert_eq!(stats.percentile(0.0), Some(10.0));
    }

    #[test]
    fn one_sample_is_every_percentile() {
        let mut stats = LatencyStats::default();
        stats.record(42.0);
        assert_eq!(stats.percentile(50.0), Some(42.0));
        assert_eq!(stats.percentile(95.0), Some(42.0));
    }
}
