"""Download small evaluation subsets: AMI + Earnings-22 for STT, IWSLT'15 en-vi for MT.

Reads parquet shards directly and decodes audio bytes with soundfile (no torchcodec needed).
"""
import io
import json
import os
import random

import librosa
import numpy as np
import pyarrow.parquet as pq
import soundfile as sf
from huggingface_hub import HfApi, hf_hub_download

OUT = "data"
N_PER_SET = 80
MIN_S, MAX_S = 3.0, 25.0
random.seed(0)
api = HfApi()


def parquet_files(repo, prefix, revision=None):
    files = [f for f in api.list_repo_files(repo, repo_type="dataset", revision=revision)
             if f.startswith(prefix) and f.endswith(".parquet")]
    return sorted(files)


def decode(audio):
    arr, sr = sf.read(io.BytesIO(audio["bytes"]), dtype="float32")
    if arr.ndim > 1:
        arr = arr.mean(axis=1)
    if sr != 16000:
        arr = librosa.resample(arr, orig_sr=sr, target_sr=16000)
    return arr


def dump_stt(name, repo, prefix, text_key, n_shards):
    os.makedirs(f"{OUT}/{name}", exist_ok=True)
    candidates = []
    for fname in parquet_files(repo, prefix)[:n_shards]:
        table = pq.read_table(hf_hub_download(repo, fname, repo_type="dataset"))
        candidates.extend(table.to_pylist())
    random.shuffle(candidates)
    rows = []
    for ex in candidates:
        text = ex[text_key].strip()
        if len(text.split()) < 5:
            continue
        arr = decode(ex["audio"])
        dur = len(arr) / 16000
        if not (MIN_S <= dur <= MAX_S):
            continue
        path = f"{OUT}/{name}/{len(rows):03d}.wav"
        sf.write(path, arr, 16000)
        rows.append({"path": path, "ref": text, "dur": round(dur, 2)})
        if len(rows) >= N_PER_SET:
            break
    with open(f"{OUT}/{name}.jsonl", "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(name, len(rows), "clips", round(sum(r["dur"] for r in rows) / 60, 1), "min", flush=True)


dump_stt("ami", "edinburghcstr/ami", "ihm/test", "text", n_shards=2)
dump_stt("earnings22", "distil-whisper/earnings22", "chunked/test", "transcription", n_shards=1)

MT_REV = "refs/convert/parquet"
mt_file = parquet_files("IWSLT/mt_eng_vietnamese", "iwslt2015-en-vi/test", MT_REV)
mt = pq.read_table(hf_hub_download("IWSLT/mt_eng_vietnamese", mt_file[0], repo_type="dataset", revision=MT_REV)).to_pylist()
pairs = [p["translation"] for p in mt if 6 <= len(p["translation"]["en"].split()) <= 40]
pairs = random.sample(pairs, 200)
with open(f"{OUT}/iwslt_envi.jsonl", "w") as f:
    for p in pairs:
        f.write(json.dumps({"en": p["en"], "vi": p["vi"]}, ensure_ascii=False) + "\n")
print("iwslt", len(pairs), "pairs")
