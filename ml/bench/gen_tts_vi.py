"""Synthesise Vietnamese sentences with English terms using Gemini TTS, for a preliminary mixed-language test.

Reads data/vi_mixed_src/sentences.txt, writes name.wav (16 kHz mono) and refs.tsv next to it.
Needs GEMINI_API_KEY in the environment. The sentences are synthetic, so nothing private is sent.
"""
import base64, json, os, ssl, sys, time, urllib.error, urllib.request

import certifi
from pathlib import Path

import librosa
import soundfile as sf

MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir", "Leda"]
SRC = Path(__file__).parent / "data" / "vi_mixed_src"


def synth(text: str, voice: str, key: str) -> bytes:
    body = {
        "contents": [{"parts": [{"text": f"Say this naturally, as a Vietnamese speaker in a work meeting: {text}"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    ctx = ssl.create_default_context(cafile=certifi.where())
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:600]
            if e.code != 429 or attempt == 5:
                sys.exit(f"HTTP {e.code}: {detail}")
            print(f"429, waiting 25 s (attempt {attempt + 1}): {detail[:200]}", flush=True)
            time.sleep(25)
    part = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
    return base64.b64decode(part)  # PCM s16le, 24 kHz, mono


def main() -> None:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY is not set")
    lines = [l.strip() for l in (SRC / "sentences.txt").read_text(encoding="utf-8").splitlines() if l.strip()]
    rows = []
    for i, text in enumerate(lines, 1):
        name = f"tts_{i:02d}.wav"
        out = SRC / name
        if not out.exists():
            import numpy as np

            pcm = np.frombuffer(synth(text, VOICES[i % len(VOICES)], key), dtype=np.int16).astype("float32") / 32768
            sf.write(out, librosa.resample(pcm, orig_sr=24000, target_sr=16000), 16000)
            print("ok", name, flush=True)
        rows.append(f"{name}\t{text}")
    (SRC / "refs.tsv").write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(f"{len(rows)} clips -> {SRC / 'refs.tsv'}")


if __name__ == "__main__":
    main()
