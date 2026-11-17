//! The speech model on disk: where it lives, how it is downloaded and how it is trusted.
//!
//! Nothing is loaded unless every file matches the pinned size and SHA-256 (supply chain, plan risk R11): a
//! file that is missing, cut short or changed is deleted and downloaded again.
use super::Timings;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::time::{Duration, Instant};

pub struct ModelFile {
    pub name: &'static str,
    pub size: u64,
    pub sha256: &'static str,
}

pub struct ModelSpec {
    pub id: &'static str,
    /// Hugging Face commit the hashes below were taken from; a moving `main` is never downloaded.
    pub revision: &'static str,
    pub files: &'static [ModelFile],
}

/// Parakeet TDT 0.6B v2, English, int8 ONNX, converted for sherpa-onnx by k2-fsa.
/// Source model: nvidia/parakeet-tdt-0.6b-v2 (CC-BY-4.0, attribution in the app's About page).
pub const PARAKEET_TDT_V2_INT8: ModelSpec = ModelSpec {
    id: "parakeet-tdt-0.6b-v2-int8",
    revision: "84b478d541cdbf0c296a7ab5f1e20a6f8f998114",
    files: &[
        ModelFile {
            name: "encoder.int8.onnx",
            size: 652_282_309,
            sha256: "92a10bd9c23936ea0566c29f963bc57c2a5df4261b6a8921c39abea66557ca8b",
        },
        ModelFile {
            name: "decoder.int8.onnx",
            size: 7_257_753,
            sha256: "4d097bae3bac5c96018d5293ba39f1b657296102b142affda40378f38b020f41",
        },
        ModelFile {
            name: "joiner.int8.onnx",
            size: 1_739_080,
            sha256: "77a29f3e5ac7d37074e0af465391b80f314015d5b97f0f90c6c7767f1d56f428",
        },
        ModelFile {
            name: "tokens.txt",
            size: 9_384,
            sha256: "ec182b70dd42113aff6c5372c75cac58c952443eb22322f57bbd7f53977d497d",
        },
    ],
};

/// `resolve` URL prefix of the Hugging Face repository the files come from.
pub const DEFAULT_HUB: &str =
    "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/resolve";

/// Where models are kept: `%LOCALAPPDATA%\vn.cmcai.cuelingo\models` on Windows. `CUELINGO_MODELS_DIR`
/// overrides it (CI caches, tests).
pub fn models_root() -> PathBuf {
    if let Some(dir) = std::env::var_os("CUELINGO_MODELS_DIR") {
        return PathBuf::from(dir);
    }
    let base = if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/Application Support"))
    } else {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share"))
    };
    base.unwrap_or_else(std::env::temp_dir)
        .join("vn.cmcai.cuelingo")
        .join("models")
}

/// `<root>/<id>-<first 12 of the revision>`: where the files of `spec` live.
pub fn model_dir(spec: &ModelSpec, root: &Path) -> PathBuf {
    let short = spec.revision.get(..12).unwrap_or(spec.revision);
    root.join(format!("{}-{short}", spec.id))
}

/// Whether every file of `spec` is in place and matches its pin. Downloads nothing, and a file that was
/// verified before is not hashed again (see `is_good`). A half-finished download (`<name>.part`) or a
/// file of the wrong size counts as missing.
pub fn is_installed(spec: &ModelSpec, root: &Path) -> bool {
    let dir = model_dir(spec, root);
    spec.files
        .iter()
        .all(|file| is_good(&dir.join(file.name), file))
}

/// Bytes the whole model takes on disk.
pub fn total_bytes(spec: &ModelSpec) -> u64 {
    spec.files.iter().map(|file| file.size).sum()
}

/// The model that recognises `language` on this machine, if there is one (cloud languages have none).
pub fn spec_for(language: &str) -> Option<&'static ModelSpec> {
    match language {
        "en" => Some(&PARAKEET_TDT_V2_INT8),
        _ => None,
    }
}

/// Makes sure every file of `spec` is in `<root>/<id>-<revision>/` and matches its pin; returns that
/// directory. `progress` gets 0...1 of the bytes in place (files that were already good count as done).
pub fn ensure(
    spec: &ModelSpec,
    hub: &str,
    root: &Path,
    progress: &mut dyn FnMut(f64),
) -> Result<(PathBuf, Timings), String> {
    let dir = model_dir(spec, root);
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create the model folder: {e}"))?;
    let total: u64 = spec.files.iter().map(|f| f.size).sum();
    let mut done = 0u64;
    let mut timings = Timings::default();

    for file in spec.files {
        let path = dir.join(file.name);
        let started = Instant::now();
        let good = is_good(&path, file);
        timings.verify_ms += started.elapsed().as_millis() as u64;
        if good {
            done += file.size;
            progress(done as f64 / total as f64);
            continue;
        }
        let _ = fs::remove_file(&path);
        let started = Instant::now();
        let url = format!("{hub}/{}/{}", spec.revision, file.name);
        download_with_retries(&url, &path, file, &mut |bytes| {
            progress((done + bytes) as f64 / total as f64);
        })?;
        timings.download_ms += started.elapsed().as_millis() as u64;
        mark_verified(&path, file); // `download` checked the hash on the way in
        done += file.size;
    }
    Ok((dir, timings))
}

/// A file is good when it has the pinned size and SHA-256. Hashing 650 MB costs seconds on every start, so a
/// verified file gets a small marker (`<name>.ok`) holding its hash, size and modification time: while those
/// still match the file, the hash is not computed again. Any change to the file invalidates the marker.
fn is_good(path: &Path, file: &ModelFile) -> bool {
    let Ok(meta) = fs::metadata(path) else {
        return false;
    };
    if meta.len() != file.size {
        return false;
    }
    let marker = path.with_extension("ok");
    if fs::read_to_string(&marker).is_ok_and(|text| text.trim() == stamp(file, &meta)) {
        return true;
    }
    let good = sha256_of(path).is_ok_and(|hash| hash == file.sha256);
    if good {
        mark_verified(path, file);
    } else {
        let _ = fs::remove_file(&marker);
    }
    good
}

fn stamp(file: &ModelFile, meta: &fs::Metadata) -> String {
    format!("{}:{}:{}", file.sha256, meta.len(), modified_nanos(meta))
}

/// Records that the file as it is now matched its hash (a failure to write only costs a re-hash later).
fn mark_verified(path: &Path, file: &ModelFile) {
    if let Ok(meta) = fs::metadata(path) {
        let _ = fs::write(path.with_extension("ok"), stamp(file, &meta));
    }
}

fn modified_nanos(meta: &fs::Metadata) -> u128 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_nanos())
}

fn sha256_of(path: &Path) -> std::io::Result<String> {
    let mut reader = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut chunk = vec![0u8; 1 << 20];
    loop {
        let n = reader.read(&mut chunk)?;
        if n == 0 {
            break;
        }
        hasher.update(&chunk[..n]);
    }
    Ok(hex(&hasher.finalize()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

const ATTEMPTS: u32 = 3;

fn download_with_retries(
    url: &str,
    path: &Path,
    file: &ModelFile,
    progress: &mut dyn FnMut(u64),
) -> Result<(), String> {
    let mut last = String::new();
    for attempt in 1..=ATTEMPTS {
        match download(url, path, file, progress) {
            Ok(()) => return Ok(()),
            Err(error) => {
                last = error;
                if attempt < ATTEMPTS {
                    std::thread::sleep(Duration::from_secs(u64::from(attempt) * 2));
                }
            }
        }
    }
    Err(format!("download of {} failed: {last}", file.name))
}

/// Downloads to `<path>.part`, checks size and hash, and only then renames it into place.
fn download(
    url: &str,
    path: &Path,
    file: &ModelFile,
    progress: &mut dyn FnMut(u64),
) -> Result<(), String> {
    let part = path.with_extension("part");
    let result = fetch(url, &part, file, progress);
    if result.is_err() {
        let _ = fs::remove_file(&part);
        return result;
    }
    fs::rename(&part, path).map_err(|e| format!("cannot move the file into place: {e}"))
}

/// How long a download may go without a single byte before the attempt is given up (and retried).
static STALL_MS: AtomicU64 = AtomicU64::new(30_000);

/// Changes the stall limit; for tests, which cannot wait 30 s.
pub fn set_stall_timeout(limit: Duration) {
    STALL_MS.store(limit.as_millis() as u64, Ordering::Relaxed);
}

/// ureq has no read timeout, so a connection that goes quiet in the middle of the body would block forever.
/// The body is read on its own thread and the caller waits for each piece with a limit; on a stall the attempt
/// fails and the retry loop runs. The abandoned thread ends when its socket errors out or the process exits.
fn fetch(
    url: &str,
    part: &Path,
    file: &ModelFile,
    progress: &mut dyn FnMut(u64),
) -> Result<(), String> {
    // The operating system's TLS (SChannel on Windows) so company root certificates are trusted.
    let tls = ureq::tls::TlsConfig::builder()
        .provider(ureq::tls::TlsProvider::NativeTls)
        .build();
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .tls_config(tls)
        .timeout_connect(Some(Duration::from_secs(30)))
        .timeout_recv_response(Some(Duration::from_secs(60)))
        .build()
        .into();
    let response = agent.get(url).call().map_err(|e| e.to_string())?;
    let mut body = response.into_body().into_reader();
    let (tx, rx) = mpsc::sync_channel::<Result<Vec<u8>, String>>(4);
    std::thread::spawn(move || loop {
        let mut chunk = vec![0u8; 1 << 20];
        let piece = match body.read(&mut chunk) {
            Ok(n) => {
                chunk.truncate(n);
                Ok(chunk)
            }
            Err(e) => Err(e.to_string()),
        };
        let done = !matches!(&piece, Ok(c) if !c.is_empty());
        if tx.send(piece).is_err() || done {
            return;
        }
    });

    let stall = Duration::from_millis(STALL_MS.load(Ordering::Relaxed));
    let mut out = File::create(part).map_err(|e| format!("cannot write the model file: {e}"))?;
    let mut hasher = Sha256::new();
    let mut bytes = 0u64;
    loop {
        let piece = match rx.recv_timeout(stall) {
            Ok(piece) => piece?,
            Err(_) => return Err(format!("no data for {} s", stall.as_secs().max(1))),
        };
        if piece.is_empty() {
            break;
        }
        hasher.update(&piece);
        out.write_all(&piece)
            .map_err(|e| format!("cannot write the model file: {e}"))?;
        bytes += piece.len() as u64;
        if bytes > file.size {
            return Err("the file is larger than expected".into());
        }
        progress(bytes);
    }
    out.flush().map_err(|e| e.to_string())?;
    // On disk before the rename, so a power cut cannot leave a complete-looking file that is not.
    out.sync_all().map_err(|e| e.to_string())?;
    if bytes != file.size {
        return Err(format!("expected {} bytes, got {bytes}", file.size));
    }
    if hex(&hasher.finalize()) != file.sha256 {
        return Err("the checksum does not match".into());
    }
    Ok(())
}
