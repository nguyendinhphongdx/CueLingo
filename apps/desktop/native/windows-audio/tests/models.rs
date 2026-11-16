//! Model download and verification against a tiny HTTP server on localhost: no network, no real model.
use cuelingo_audio::stt::models::{ensure, ModelFile, ModelSpec};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

struct Server {
    base: String,
    requests: Arc<AtomicUsize>,
    /// How many of the next responses carry flipped bytes instead of the real content.
    corrupt: Arc<AtomicUsize>,
    /// How many of the next responses send the headers and half the body, then go silent.
    stall: Arc<AtomicUsize>,
}

fn serve(files: HashMap<String, Vec<u8>>) -> Server {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let requests = Arc::new(AtomicUsize::new(0));
    let corrupt = Arc::new(AtomicUsize::new(0));
    let stall = Arc::new(AtomicUsize::new(0));
    let (r, c, st) = (requests.clone(), corrupt.clone(), stall.clone());
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let mut head = [0u8; 2048];
            let n = stream.read(&mut head).unwrap_or(0);
            let head = String::from_utf8_lossy(&head[..n]).to_string();
            let path = head.split_whitespace().nth(1).unwrap_or("/").to_string();
            r.fetch_add(1, Ordering::SeqCst);
            let name = path.rsplit('/').next().unwrap_or("").to_string();
            let (status, mut body) = match files.get(&name) {
                Some(b) => ("200 OK", b.clone()),
                None => ("404 Not Found", b"missing".to_vec()),
            };
            if status == "200 OK" && c.load(Ordering::SeqCst) > 0 {
                c.fetch_sub(1, Ordering::SeqCst);
                body[0] ^= 0xFF;
            }
            let _ = write!(
                stream,
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            if status == "200 OK" && st.load(Ordering::SeqCst) > 0 {
                st.fetch_sub(1, Ordering::SeqCst);
                let _ = stream.write_all(&body[..body.len() / 2]);
                let _ = stream.flush();
                // Hold the connection open and say nothing, like a dead proxy.
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(30));
                    drop(stream);
                });
                continue;
            }
            let _ = stream.write_all(&body);
        }
    });
    Server {
        base,
        requests,
        corrupt,
        stall,
    }
}

fn sha(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn spec(contents: &[(&'static str, Vec<u8>)]) -> &'static ModelSpec {
    let files: Vec<ModelFile> = contents
        .iter()
        .map(|(name, bytes)| ModelFile {
            name,
            size: bytes.len() as u64,
            sha256: Box::leak(sha(bytes).into_boxed_str()),
        })
        .collect();
    Box::leak(Box::new(ModelSpec {
        id: "test-model",
        revision: "0123456789abcdef0123456789abcdef01234567",
        files: Box::leak(files.into_boxed_slice()),
    }))
}

fn payload(seed: u8, len: usize) -> Vec<u8> {
    (0..len)
        .map(|i| (i as u8).wrapping_mul(seed).wrapping_add(seed))
        .collect()
}

fn temp_root(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "cuelingo-models-test-{name}-{}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

type Fixture = (
    &'static ModelSpec,
    Server,
    PathBuf,
    Vec<(&'static str, Vec<u8>)>,
);

fn setup(name: &str) -> Fixture {
    let contents = vec![
        ("a.onnx", payload(3, 300_000)),
        ("b.onnx", payload(5, 70_000)),
        ("tokens.txt", payload(7, 900)),
    ];
    let server = serve(
        contents
            .iter()
            .map(|(n, b)| (n.to_string(), b.clone()))
            .collect(),
    );
    (spec(&contents), server, temp_root(name), contents)
}

#[test]
fn downloads_every_file_and_reports_progress_up_to_one() {
    let (spec, server, root, contents) = setup("fresh");
    let seen = Mutex::new(Vec::new());
    let (dir, timings) = ensure(spec, &server.base, &root, &mut |p| {
        seen.lock().unwrap().push(p)
    })
    .unwrap();
    for (name, bytes) in &contents {
        assert_eq!(&std::fs::read(dir.join(name)).unwrap(), bytes);
    }
    let seen = seen.into_inner().unwrap();
    assert!(
        seen.windows(2).all(|w| w[0] <= w[1]),
        "progress goes forward"
    );
    assert_eq!(*seen.last().unwrap(), 1.0);
    assert_eq!(server.requests.load(Ordering::SeqCst), 3);
    assert!(timings.download_ms < 10_000);
    assert!(dir.ends_with("test-model-0123456789ab"));
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn files_already_in_place_are_not_downloaded_again() {
    let (spec, server, root, _) = setup("cached");
    ensure(spec, &server.base, &root, &mut |_| {}).unwrap();
    let before = server.requests.load(Ordering::SeqCst);
    let mut last = 0.0;
    ensure(spec, &server.base, &root, &mut |p| last = p).unwrap();
    assert_eq!(server.requests.load(Ordering::SeqCst), before);
    assert_eq!(last, 1.0);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn a_file_that_changed_or_was_cut_short_is_downloaded_again() {
    let (spec, server, root, contents) = setup("damaged");
    let (dir, _) = ensure(spec, &server.base, &root, &mut |_| {}).unwrap();
    // Same size, one byte different; and another cut short.
    let mut flipped = contents[0].1.clone();
    flipped[100] ^= 1;
    std::fs::write(dir.join("a.onnx"), flipped).unwrap();
    std::fs::write(dir.join("b.onnx"), &contents[1].1[..1000]).unwrap();
    let before = server.requests.load(Ordering::SeqCst);
    ensure(spec, &server.base, &root, &mut |_| {}).unwrap();
    assert_eq!(server.requests.load(Ordering::SeqCst), before + 2);
    assert_eq!(std::fs::read(dir.join("a.onnx")).unwrap(), contents[0].1);
    assert_eq!(std::fs::read(dir.join("b.onnx")).unwrap(), contents[1].1);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn a_bad_download_is_retried_and_the_second_try_wins() {
    let (spec, server, root, contents) = setup("retry");
    server.corrupt.store(1, Ordering::SeqCst);
    let (dir, _) = ensure(spec, &server.base, &root, &mut |_| {}).unwrap();
    assert_eq!(std::fs::read(dir.join("a.onnx")).unwrap(), contents[0].1);
    assert_eq!(server.requests.load(Ordering::SeqCst), 4); // one extra try
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn a_download_that_never_matches_fails_and_leaves_no_file_behind() {
    let (spec, server, root, _) = setup("hostile");
    server.corrupt.store(100, Ordering::SeqCst);
    let error = ensure(spec, &server.base, &root, &mut |_| {}).unwrap_err();
    assert!(
        error.contains("a.onnx") && error.contains("checksum"),
        "{error}"
    );
    let dir = root.join("test-model-0123456789ab");
    let left: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .flatten()
        .map(|e| e.file_name())
        .collect();
    assert!(left.is_empty(), "{left:?}");
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn a_missing_file_is_an_error_naming_it() {
    let (spec, server, root, _) = setup("missing");
    let other = spec_with_name(spec);
    let error = ensure(other, &server.base, &root, &mut |_| {}).unwrap_err();
    assert!(error.contains("not-there.onnx"), "{error}");
    let _ = std::fs::remove_dir_all(root);
}

fn spec_with_name(_: &ModelSpec) -> &'static ModelSpec {
    let files = vec![ModelFile {
        name: "not-there.onnx",
        size: 10,
        sha256: "00",
    }];
    Box::leak(Box::new(ModelSpec {
        id: "test-model",
        revision: "0123456789abcdef0123456789abcdef01234567",
        files: Box::leak(files.into_boxed_slice()),
    }))
}

#[test]
fn a_verified_file_is_not_hashed_again_until_it_changes() {
    let (spec, server, root, contents) = setup("marker");
    let (dir, _) = ensure(spec, &server.base, &root, &mut |_| {}).unwrap();
    assert!(
        dir.join("a.ok").exists(),
        "a marker is written once the hash was checked"
    );
    // Replace the content with different bytes of the same size: the marker no longer matches.
    let mut other = contents[0].1.clone();
    other[5] ^= 0x55;
    std::thread::sleep(std::time::Duration::from_millis(20));
    std::fs::write(dir.join("a.onnx"), other).unwrap();
    let before = server.requests.load(Ordering::SeqCst);
    ensure(spec, &server.base, &root, &mut |_| {}).unwrap();
    assert_eq!(server.requests.load(Ordering::SeqCst), before + 1);
    assert_eq!(std::fs::read(dir.join("a.onnx")).unwrap(), contents[0].1);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn a_connection_that_goes_silent_fails_the_attempt_and_the_retry_wins() {
    let (spec, server, root, contents) = setup("stall");
    cuelingo_audio::stt::models::set_stall_timeout(std::time::Duration::from_secs(1));
    server.stall.store(1, Ordering::SeqCst);
    let started = std::time::Instant::now();
    let (dir, _) = ensure(spec, &server.base, &root, &mut |_| {}).unwrap();
    assert_eq!(std::fs::read(dir.join("a.onnx")).unwrap(), contents[0].1);
    assert!(started.elapsed() < std::time::Duration::from_secs(20));
    assert_eq!(server.requests.load(Ordering::SeqCst), 4); // the stalled try plus three files
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn a_connection_that_stays_silent_for_every_try_is_an_error_not_a_hang() {
    let (spec, server, root, _) = setup("stall-always");
    cuelingo_audio::stt::models::set_stall_timeout(std::time::Duration::from_secs(1));
    server.stall.store(100, Ordering::SeqCst);
    let error = ensure(spec, &server.base, &root, &mut |_| {}).unwrap_err();
    assert!(
        error.contains("a.onnx") && error.contains("no data"),
        "{error}"
    );
    let _ = std::fs::remove_dir_all(root);
}
