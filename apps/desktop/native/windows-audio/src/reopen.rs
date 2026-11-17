//! When a capture stream breaks (headset unplugged, Bluetooth switching to hands-free, driver restart) or the
//! default device changes, the capture thread reopens it. This is the policy for how long to wait and when to
//! give up. Pure on purpose: no device, no clock, so it is tested directly.
use std::time::Duration;

/// How long to wait before reopening after `attempt` failed tries in a row (0 = the first retry), or `None`
/// to stop trying and report the problem. `attempt` goes back to 0 once the stream delivers audio again.
///
/// A loopback stream on a quiet system delivers nothing, so "no data" is not a failure: this is only asked
/// after a real error or a device change.
pub fn retry_delay(attempt: u32) -> Option<Duration> {
    if attempt >= MAX_ATTEMPTS {
        return None;
    }
    // Quick first retry (a headset switching profile is usually back in a second or two), then doubling.
    let millis = FIRST_RETRY_MS.saturating_mul(1u64 << attempt.min(10));
    Some(Duration::from_millis(millis.min(MAX_WAIT_MS)))
}

const FIRST_RETRY_MS: u64 = 300;
const MAX_WAIT_MS: u64 = 5_000;
/// About 44 s in total (0.3 + 0.6 + 1.2 + 2.4 + 4.8 s, then 7 x 5 s), then the person is told.
const MAX_ATTEMPTS: u32 = 12;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_retry_is_quick() {
        assert_eq!(retry_delay(0), Some(Duration::from_millis(300)));
    }

    #[test]
    fn the_wait_doubles_and_stops_growing_at_the_cap() {
        assert_eq!(retry_delay(1), Some(Duration::from_millis(600)));
        assert_eq!(retry_delay(4), Some(Duration::from_millis(4_800)));
        assert_eq!(retry_delay(5), Some(Duration::from_millis(5_000)));
        assert_eq!(retry_delay(11), Some(Duration::from_millis(5_000)));
    }

    #[test]
    fn it_gives_up_after_about_45_seconds() {
        assert_eq!(retry_delay(MAX_ATTEMPTS), None);
        assert_eq!(retry_delay(u32::MAX), None);
        let total: Duration = (0..MAX_ATTEMPTS).filter_map(retry_delay).sum();
        assert!(total >= Duration::from_secs(40) && total <= Duration::from_secs(50));
    }
}
