//! The two one-shot modes the app uses to manage on-device models without a meeting (onboarding, Settings):
//!
//! * `--model-status`: one `models` line with every on-device language and whether its model is in place.
//! * `--download-model` (language from `CUELINGO_LANGUAGE`): downloads and verifies it, printing the same
//!   `model` events a meeting prints (`downloading` with `progress`, then `ready` or `error`).
//!
//! Neither loads the recognizer, so they start fast and work in a build without the `stt` feature.
//! Contract: apps/docs/docs/04-modules/01-desktop/tauri-core.md. Nothing here prints a path or any content
//! of the person's meetings.
use crate::protocol::{self, Out, ProgressGate};
use crate::stt::{
    self,
    models::{self, ModelSpec},
};
use serde_json::json;
use std::path::Path;

/// The `models` line for every language this machine recognises on-device.
pub fn status_line(root: &Path) -> String {
    let entries: Vec<(&str, &ModelSpec)> = stt::LANGUAGES
        .iter()
        .filter_map(|language| models::spec_for(language).map(|spec| (*language, spec)))
        .collect();
    status_line_for(&entries, root)
}

/// `state` is `ready` only when every file of the model matches its pin; a half-finished download or a
/// damaged file is `missing`, so the app offers to download it again.
pub fn status_line_for(entries: &[(&str, &ModelSpec)], root: &Path) -> String {
    let models: Vec<_> = entries
        .iter()
        .map(|(language, spec)| {
            json!({
                "language": language,
                "state": if models::is_installed(spec, root) { "ready" } else { "missing" },
                "sizeBytes": models::total_bytes(spec),
            })
        })
        .collect();
    json!({ "type": "models", "models": models }).to_string()
}

/// Downloads the model for `language` into `root`. Returns the exit code: 0 when the model is in place,
/// 1 when it is not (cloud language, unknown language, or the download failed).
pub fn download(language: &str, hub: &str, root: &Path, out: &Out) -> i32 {
    if stt::is_cloud(language) {
        out.emit(protocol::model_error(
            language,
            "this language runs in the cloud: there is no model to download",
        ));
        return 1;
    }
    match models::spec_for(language) {
        Some(spec) => download_spec(language, spec, hub, root, out),
        None => {
            out.emit(protocol::model_error(language, "unsupported language"));
            1
        }
    }
}

/// Like `download` for a given model. A model that is already in place is not fetched again: it answers
/// `ready` at once.
pub fn download_spec(language: &str, spec: &ModelSpec, hub: &str, root: &Path, out: &Out) -> i32 {
    if models::is_installed(spec, root) {
        out.emit(protocol::model_ready(language));
        return 0;
    }
    let mut gate = ProgressGate::default();
    let result = models::ensure(spec, hub, root, &mut |fraction| {
        if gate.should_report(fraction) {
            out.emit(protocol::model_downloading(language, fraction));
        }
    });
    match result {
        Ok(_) => {
            out.emit(protocol::model_ready(language));
            0
        }
        Err(message) => {
            out.emit(protocol::model_error(language, &message));
            1
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stt::models::ModelFile;
    use sha2::{Digest, Sha256};
    use std::path::PathBuf;

    fn spec_of(name: &'static str, bytes: &[u8]) -> &'static ModelSpec {
        let sha: String = Sha256::digest(bytes)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        let files: &'static [ModelFile] = Box::leak(Box::new([ModelFile {
            name,
            size: bytes.len() as u64,
            sha256: Box::leak(sha.into_boxed_str()),
        }]));
        Box::leak(Box::new(ModelSpec {
            id: "ctl-test",
            revision: "0123456789abcdef0123456789abcdef01234567",
            files,
        }))
    }

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cuelingo-ctl-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    fn state_of(spec: &'static ModelSpec, root: &Path) -> (String, u64) {
        let line = status_line_for(&[("en", spec)], root);
        let value: serde_json::Value = serde_json::from_str(&line).unwrap();
        assert_eq!(value["type"], "models");
        let model = &value["models"][0];
        assert_eq!(model["language"], "en");
        (
            model["state"].as_str().unwrap().to_string(),
            model["sizeBytes"].as_u64().unwrap(),
        )
    }

    #[test]
    fn a_model_that_is_not_there_is_missing_and_reports_its_size() {
        let root = temp_root("none");
        let spec = spec_of("m.bin", b"twelve bytes");
        assert_eq!(state_of(spec, &root), ("missing".to_string(), 12));
    }

    #[test]
    fn a_model_with_every_file_in_place_is_ready() {
        let root = temp_root("ready");
        let spec = spec_of("m.bin", b"twelve bytes");
        let dir = models::model_dir(spec, &root);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("m.bin"), b"twelve bytes").unwrap();
        assert_eq!(state_of(spec, &root).0, "ready");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn a_damaged_or_half_downloaded_model_is_missing() {
        let root = temp_root("damaged");
        let spec = spec_of("m.bin", b"twelve bytes");
        let dir = models::model_dir(spec, &root);
        std::fs::create_dir_all(&dir).unwrap();
        // Same size, different bytes; and a download that never finished.
        std::fs::write(dir.join("m.bin"), b"TWELVE BYTES").unwrap();
        assert_eq!(state_of(spec, &root).0, "missing");
        std::fs::remove_file(dir.join("m.bin")).unwrap();
        std::fs::write(dir.join("m.bin.part"), b"twelve").unwrap();
        assert_eq!(state_of(spec, &root).0, "missing");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn the_real_status_lists_exactly_the_on_device_languages() {
        let line = status_line(&temp_root("real"));
        let value: serde_json::Value = serde_json::from_str(&line).unwrap();
        let languages: Vec<&str> = value["models"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| m["language"].as_str().unwrap())
            .collect();
        assert_eq!(languages, stt::LANGUAGES);
        assert!(value["models"][0]["sizeBytes"].as_u64().unwrap() > 600_000_000);
    }

    #[test]
    fn a_cloud_language_has_no_model_to_download() {
        let out = Out::new(Box::new(std::io::sink()));
        assert_eq!(
            download("ja", "http://127.0.0.1:1", &temp_root("cloud"), &out),
            1
        );
        assert_eq!(
            download("xx", "http://127.0.0.1:1", &temp_root("odd"), &out),
            1
        );
    }
}
