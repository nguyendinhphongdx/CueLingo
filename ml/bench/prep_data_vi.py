"""Prepare Vietnamese evaluation clips for on-device STT.

Two sets, both written as data/<name>.jsonl with {"path", "ref", "dur"} rows (16 kHz mono wav):

  vi        80 read sentences from FLEURS vi_vn (validation split, 275 MB download, public data)
  vi_mixed  the owner's own recordings of Vietnamese with English words mixed in. Put the audio and a
            tab-separated refs file in data/vi_mixed_src/ (name.wav<TAB>reference text per line, UTF-8)

Usage: python prep_data_vi.py [vi] [vi_mixed]      (no argument: both; vi_mixed is skipped if its source is missing)
"""
import io
import json
import os
import random
import sys

import librosa
import numpy as np
import pyarrow.parquet as pq
import soundfile as sf
from huggingface_hub import hf_hub_download

OUT = "data"
N_CLIPS = 80
MIN_S, MAX_S = 3.0, 25.0
MIXED_SRC = f"{OUT}/vi_mixed_src"
random.seed(0)


def to_16k_mono(arr, sr):
    if arr.ndim > 1:
        arr = arr.mean(axis=1)
    if sr != 16000:
        arr = librosa.resample(arr, orig_sr=sr, target_sr=16000)
    return arr.astype(np.float32)


def write_set(name, items):
    """items: iterable of (float32 mono 16 kHz array, reference text)."""
    os.makedirs(f"{OUT}/{name}", exist_ok=True)
    rows = []
    for arr, ref in items:
        dur = len(arr) / 16000
        if not (MIN_S <= dur <= MAX_S) or not ref.strip():
            continue
        path = f"{OUT}/{name}/{len(rows):03d}.wav"
        sf.write(path, arr, 16000)
        rows.append({"path": path, "ref": ref.strip(), "dur": round(dur, 2)})
    with open(f"{OUT}/{name}.jsonl", "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(name, len(rows), "clips", round(sum(r["dur"] for r in rows) / 60, 1), "min", flush=True)


def prep_vi():
    path = hf_hub_download(
        "google/fleurs", "parquet-data/vi_vn/validation-00000-of-00001.parquet", repo_type="dataset"
    )
    rows = pq.read_table(path).to_pylist()
    random.shuffle(rows)

    def items():
        for ex in rows[: N_CLIPS * 3]:
            arr, sr = sf.read(io.BytesIO(ex["audio"]["bytes"]), dtype="float32")
            yield to_16k_mono(arr, sr), ex["raw_transcription"]

    # write_set filters by duration, so over-read and cut at N_CLIPS afterwards.
    kept = []
    for arr, ref in items():
        if MIN_S <= len(arr) / 16000 <= MAX_S:
            kept.append((arr, ref))
        if len(kept) >= N_CLIPS:
            break
    write_set("vi", kept)


def prep_mixed():
    refs_path = f"{MIXED_SRC}/refs.tsv"
    if not os.path.exists(refs_path):
        print(f"vi_mixed: skipped, no {refs_path} yet (see the docstring)")
        return
    items = []
    with open(refs_path, encoding="utf-8") as f:
        for line in f:
            name, _, ref = line.rstrip("\n").partition("\t")
            if not name or not ref:
                continue
            arr, sr = sf.read(f"{MIXED_SRC}/{name}", dtype="float32")
            items.append((to_16k_mono(arr, sr), ref))
    write_set("vi_mixed", items)


if __name__ == "__main__":
    wanted = sys.argv[1:] or ["vi", "vi_mixed"]
    if "vi" in wanted:
        prep_vi()
    if "vi_mixed" in wanted:
        prep_mixed()
