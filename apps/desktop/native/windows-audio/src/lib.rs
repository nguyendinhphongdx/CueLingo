//! cuelingo-audio for Windows: speaks the line protocol of `native/macos-audio` (one JSON object per line on
//! stdout, `stop` / `vocab` / `language` lines on stdin), so `src-tauri/src/audio_bridge.rs` runs it unchanged.
//! Protocol: apps/docs/docs/05-engineering/scaffold/07-native-swift.md and
//! apps/docs/docs/04-modules/01-desktop/tauri-core.md.
//!
//! Everything here except `capture` platform code and `permissions` also builds and runs on a Mac, which is
//! how it is developed and tested. The logic modules are ports of the Swift ones; both copies are held to the
//! shared vectors in `native/fixtures`.
pub mod capture;
pub mod level;
pub mod memory;
pub mod pcm;
pub mod permissions;
pub mod pipeline;
pub mod protocol;
pub mod pump;
pub mod reopen;
pub mod resample;
pub mod segmenter;
pub mod session;
pub mod stats;
pub mod stt;
pub mod vocabulary;
#[cfg(windows)]
pub mod wasapi;
pub mod wav;
