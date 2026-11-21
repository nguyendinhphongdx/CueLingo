"""Vietnamese STT benchmark: WER, real-time factor, time per clip and peak memory.

Usage: python stt_bench_vi.py <model_key> [<model_key> ...]     (run each model in its own process for a true peak RSS)
Sets:  data/vi.jsonl (FLEURS read speech) and data/vi_mixed.jsonl (own recordings with English words), see prep_data_vi.py.

Models:
  gemini               the product's current recognizer (ADR 0014): GEMINI_API_KEY, optional GEMINI_STT_MODEL (default gemini-3.5-flash-lite)
  zipformer-vi         sherpa-onnx Vietnamese transducer: VI_ZIPFORMER_DIR holds encoder/decoder/joiner (*.onnx) and tokens.txt
  parakeet-ctc-vi      nvidia/parakeet-ctc-0.6b-Vietnamese through NeMo (heavy install, see README)

Output: results/stt_vi_<model>_<set>.jsonl (ref + hyp per clip) and one line per model in results/stt_vi_summary.jsonl.
"""
import base64
import glob
import io
import json
import os
import re
import resource
import statistics
import sys
import time
import unicodedata
import urllib.request

import jiwer
import soundfile as sf

SETS = ["vi", "vi_mixed"]
HAS_DIGIT = re.compile(r"\d")

# Same intent as the product prompt (packages/prompts/src/stt/v4.ts, "text" rules) without the speaker part,
# plus the Vietnamese hint from the language registry (packages/shared/src/languages.ts).
GEMINI_PROMPT = (
    "You are a speech-to-text engine. The audio is one utterance from a business meeting, spoken in Vietnamese.\n"
    'Reply with ONE JSON object and nothing else: {"text": string}.\n'
    "- Transcribe exactly what is said, in Vietnamese, word for word. Do not translate, summarise or correct.\n"
    "- Do not add words that are not in the audio. Plain text only: no timestamps, no commentary, no Markdown.\n"
    "- Use normal punctuation and capitalisation. Keep names, product names and English terms as spoken.\n"
    '- If there is no intelligible speech, "text" is an empty string.\n'
    "Vietnamese rules:\n"
    "- Keep every diacritic (dấu) exact: tone marks and vowel marks must match what is said. Do not drop or guess them.\n"
    '- Write numbers, dates, times and amounts as plain digits where that is natural (for example "15 tháng 3", "2 giờ chiều", "30%"); keep small counts in words when they read better.\n'
    "- Keep proper names and English technical or product terms as they are spoken; do not translate them into Vietnamese and do not respell them."
)


def normalize(text):
    """NFC, lower case, punctuation removed, tone marks kept; numbers such as 400.000 or 3,5 stay one token."""
    text = unicodedata.normalize("NFC", text).lower()
    text = re.sub(r"(?<=\d)[.,](?=\d{3}(?!\d))", "", text)  # thousands: 400.000 -> 400000
    text = re.sub(r"(?<=\d)[.,](?=\d)", "\ue000", text)  # decimals survive punctuation removal: 3,5 and 3.5 match
    text = "".join(" " if unicodedata.category(c)[0] in "PS" else c for c in text)
    return " ".join(text.split())


def gemini_runner():
    key = os.environ["GEMINI_API_KEY"]
    model = os.environ.get("GEMINI_STT_MODEL", "gemini-3.5-flash-lite")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def run(path):
        audio = base64.b64encode(open(path, "rb").read()).decode()
        body = {
            "contents": [{"parts": [{"text": GEMINI_PROMPT}, {"inline_data": {"mime_type": "audio/wav", "data": audio}}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
        }
        req = urllib.request.Request(
            url, json.dumps(body).encode(), {"Content-Type": "application/json", "x-goog-api-key": key}
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            out = json.load(res)
        raw = out["candidates"][0]["content"]["parts"][0]["text"]
        try:
            return json.loads(raw).get("text", "")
        except json.JSONDecodeError:
            return raw

    return run


def zipformer_runner():
    import numpy as np
    import sherpa_onnx

    d = os.environ["VI_ZIPFORMER_DIR"]
    pick = lambda name: sorted(glob.glob(f"{d}/{name}*int8*.onnx") or glob.glob(f"{d}/{name}*.onnx"))[0]
    recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=pick("encoder"), decoder=pick("decoder"), joiner=pick("joiner"),
        tokens=f"{d}/tokens.txt", num_threads=4, sample_rate=16000, decoding_method="greedy_search",
    )

    def run(path):
        audio, sr = sf.read(path, dtype="float32")
        stream = recognizer.create_stream()
        stream.accept_waveform(sr, np.asarray(audio, dtype=np.float32))
        recognizer.decode_stream(stream)
        return stream.result.text

    return run


def parakeet_ctc_runner():
    import nemo.collections.asr as nemo_asr

    model = nemo_asr.models.ASRModel.from_pretrained("nvidia/parakeet-ctc-0.6b-Vietnamese")

    def run(path):
        out = model.transcribe([path])
        first = out[0]
        return first if isinstance(first, str) else first.text

    return run


MODELS = {"gemini": gemini_runner, "zipformer-vi": zipformer_runner, "parakeet-ctc-vi": parakeet_ctc_runner}


def load_set(name):
    path = f"data/{name}.jsonl"
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def percentile(values, q):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(q * (len(ordered) - 1)))]


def wer_of(pairs):
    pairs = [(a, b) for a, b in pairs if a.strip()]
    return round(jiwer.wer([a for a, _ in pairs], [b for _, b in pairs]) * 100, 2) if pairs else None


def bench(key):
    run = MODELS[key]()
    sets = {name: rows for name in SETS if (rows := load_set(name))}
    first = next(iter(sets.values()))[0]["path"]
    run(first)  # warm-up: model load and kernel compile stay out of the timing
    if key == "zipformer-vi":  # the same runner serves several model folders
        key = f"{key}-{os.path.basename(os.environ['VI_ZIPFORMER_DIR'].rstrip('/'))}"
    result = {"model": key, "cloud": key == "gemini", "machine": os.environ.get("BENCH_MACHINE", "")}
    for name, rows in sets.items():
        pairs, no_digit, proc, ratios, audio_s = [], [], [], [], 0.0
        for r in rows:
            t0 = time.perf_counter()
            r["hyp"] = run(r["path"])
            took = time.perf_counter() - t0
            dur = sf.info(r["path"]).duration
            proc.append(took)
            ratios.append(took / dur)
            audio_s += dur
            pair = (normalize(r["ref"]), normalize(r["hyp"]))
            pairs.append(pair)
            if not HAS_DIGIT.search(r["ref"]):
                no_digit.append(pair)
        result[name] = {
            "wer": wer_of(pairs),
            "wer_no_digits": wer_of(no_digit),
            "rtf": round(sum(proc) / audio_s, 4),
            "clip_s_p50": round(statistics.median(proc), 3),
            "clip_s_p95": round(percentile(proc, 0.95), 3),
            "n": len(rows),
        }
        with open(f"results/stt_vi_{key}_{name}.jsonl", "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    # ru_maxrss is bytes on macOS and kilobytes on Linux.
    rss_divisor = (1 << 20) if sys.platform == "darwin" else (1 << 10)
    result["peak_rss_mb"] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / rss_divisor, 0)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    with open("results/stt_vi_summary.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(result, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    os.makedirs("results", exist_ok=True)
    for key in sys.argv[1:]:
        bench(key)
