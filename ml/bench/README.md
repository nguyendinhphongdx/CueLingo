# STT + EN→VI translation benchmark

Local benchmark on Apple Silicon (MLX). Results from 2026-10-31 on an M1 Pro 16 GB are in `results/`
(`stt_summary.jsonl`, `mt_final.json`, plus per-clip / per-sentence outputs).

## Run

```bash
uv venv .venv --python 3.12 && source .venv/bin/activate
uv pip install mlx-whisper parakeet-mlx faster-whisper soundfile librosa jiwer sacrebleu transformers \
  sentencepiece mlx-lm huggingface_hub pandas unbabel-comet "setuptools<81" "pyarrow<18"
export HF_HOME=$PWD/.hf

python prep_data.py                       # AMI + Earnings-22 clips, IWSLT'15 en-vi pairs -> data/
python stt_bench.py parakeet-tdt-0.6b-v3 whisper-large-v3-turbo whisper-small faster-whisper-small-cpu
python mt_bench.py opus-mt-en-vi translategemma-4b-4bit qwen3-4b-instruct-4bit translategemma-12b-4bit
python comet_score.py                     # adds COMET to results/mt_final.json
```

MLX needs the Metal GPU, so these must run outside a sandboxed shell.
`comet_score.py` patches COMET's XLM-R encoder and bypasses Lightning so it works with transformers 5.
