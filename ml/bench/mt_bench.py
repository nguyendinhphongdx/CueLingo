"""EN->VI translation benchmark on IWSLT'15 (TED talks, spoken style): BLEU, chrF++, per-sentence latency.

Each sentence is translated on its own, as live captions would be.
Usage: python mt_bench.py <model_key> [<model_key> ...]
"""
import json
import os
import statistics
import sys
import time

import sacrebleu

N = int(os.environ.get("MT_N", "200"))


def load_pairs():
    with open("data/iwslt_envi.jsonl") as f:
        return [json.loads(line) for line in f][:N]


def opus_runner():
    import torch
    from transformers import MarianMTModel, MarianTokenizer

    repo = "Helsinki-NLP/opus-mt-en-vi"
    tok = MarianTokenizer.from_pretrained(repo)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = MarianMTModel.from_pretrained(repo).to(device).eval()

    def run(text):
        batch = tok([text], return_tensors="pt").to(device)
        with torch.no_grad():
            out = model.generate(**batch, num_beams=1, max_new_tokens=256)
        return tok.decode(out[0], skip_special_tokens=True)

    return run


def mlx_llm_runner(repo, translategemma):
    from mlx_lm import generate, load

    model, tok = load(repo)
    if translategemma:
        tok.add_eos_token("<end_of_turn>")

    def prompt_for(text):
        if translategemma:
            msgs = [{"role": "user", "content": [{"type": "text", "source_lang_code": "en",
                                                   "target_lang_code": "vi", "text": text}]}]
        else:
            msgs = [
                {"role": "system", "content": "You are a professional English-to-Vietnamese interpreter for business meetings. "
                                              "Translate the user's sentence into natural Vietnamese. Output only the translation."},
                {"role": "user", "content": text},
            ]
        return tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)

    def run(text):
        out = generate(model, tok, prompt=prompt_for(text), max_tokens=256, verbose=False)
        return out.split("<end_of_turn>")[0].strip().split("\n")[0].strip()

    return run


MODELS = {
    "opus-mt-en-vi": opus_runner,
    "translategemma-4b-4bit": lambda: mlx_llm_runner("mlx-community/translategemma-4b-it-4bit", True),
    "translategemma-12b-4bit": lambda: mlx_llm_runner("mlx-community/translategemma-12b-it-4bit", True),
    "qwen3-4b-instruct-4bit": lambda: mlx_llm_runner("mlx-community/Qwen3-4B-Instruct-2507-4bit", False),
}


def bench(key):
    pairs = load_pairs()
    run = MODELS[key]()
    run(pairs[0]["en"])  # warm-up
    hyps, lat = [], []
    for p in pairs:
        t0 = time.perf_counter()
        hyps.append(run(p["en"]))
        lat.append(time.perf_counter() - t0)
    refs = [p["vi"] for p in pairs]
    bleu = sacrebleu.corpus_bleu(hyps, [refs]).score
    chrf = sacrebleu.corpus_chrf(hyps, [refs], word_order=2).score
    lat_sorted = sorted(lat)
    result = {
        "model": key, "n": len(pairs), "bleu": round(bleu, 2), "chrf++": round(chrf, 2),
        "lat_p50_s": round(statistics.median(lat), 3), "lat_p95_s": round(lat_sorted[int(0.95 * len(lat)) - 1], 3),
    }
    with open(f"results/mt_{key}.jsonl", "w") as f:
        for p, h, l in zip(pairs, hyps, lat):
            f.write(json.dumps({**p, "hyp": h, "lat": round(l, 3)}, ensure_ascii=False) + "\n")
    print(json.dumps(result), flush=True)
    with open("results/mt_summary.jsonl", "a") as f:
        f.write(json.dumps(result) + "\n")


if __name__ == "__main__":
    os.makedirs("results", exist_ok=True)
    for key in sys.argv[1:]:
        bench(key)
