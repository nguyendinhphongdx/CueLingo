"""STT benchmark: WER (Whisper English normalizer) and real-time factor on AMI + Earnings-22 clips.

Usage: python stt_bench.py <model_key> [<model_key> ...]
"""
import json
import sys
import time

import jiwer
import soundfile as sf
from transformers.models.whisper.english_normalizer import EnglishTextNormalizer

SETS = ["ami", "earnings22"]
normalize = EnglishTextNormalizer({})


def load_set(name):
    with open(f"data/{name}.jsonl") as f:
        return [json.loads(line) for line in f]


def mlx_whisper_runner(repo):
    import mlx_whisper

    def run(path):
        return mlx_whisper.transcribe(path, path_or_hf_repo=repo, language="en")["text"]

    return run


def parakeet_runner(repo):
    from parakeet_mlx import from_pretrained

    model = from_pretrained(repo)

    def run(path):
        return model.transcribe(path).text

    return run


def faster_whisper_runner(size):
    from faster_whisper import WhisperModel

    model = WhisperModel(size, device="cpu", compute_type="int8")

    def run(path):
        audio, _ = sf.read(path, dtype="float32")
        segments, _ = model.transcribe(audio, language="en", beam_size=1)
        return " ".join(s.text for s in segments)

    return run


MODELS = {
    "whisper-large-v3-turbo": lambda: mlx_whisper_runner("mlx-community/whisper-large-v3-turbo"),
    "whisper-small": lambda: mlx_whisper_runner("mlx-community/whisper-small-mlx"),
    "parakeet-tdt-0.6b-v3": lambda: parakeet_runner("mlx-community/parakeet-tdt-0.6b-v3"),
    "faster-whisper-small-cpu": lambda: faster_whisper_runner("small"),
}


def bench(key):
    run = MODELS[key]()
    first = load_set(SETS[0])[0]["path"]
    run(first)  # warm-up: model load + kernel compile
    result = {"model": key}
    for name in SETS:
        rows = load_set(name)
        refs, hyps, audio_s, proc_s = [], [], 0.0, 0.0
        for r in rows:
            t0 = time.perf_counter()
            hyp = run(r["path"])
            proc_s += time.perf_counter() - t0
            audio_s += sf.info(r["path"]).duration
            refs.append(normalize(r["ref"]))
            hyps.append(normalize(hyp))
            r["hyp"] = hyp
        pairs = [(a, b) for a, b in zip(refs, hyps) if a.strip()]
        wer = jiwer.wer([a for a, _ in pairs], [b for _, b in pairs])
        result[name] = {"wer": round(wer * 100, 2), "rtf": round(proc_s / audio_s, 4), "n": len(rows)}
        with open(f"results/stt_{key}_{name}.jsonl", "w") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(json.dumps(result), flush=True)
    with open("results/stt_summary.jsonl", "a") as f:
        f.write(json.dumps(result) + "\n")


if __name__ == "__main__":
    import os

    os.makedirs("results", exist_ok=True)
    for key in sys.argv[1:]:
        bench(key)
