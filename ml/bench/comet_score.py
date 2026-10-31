"""Score every results/mt_<model>.jsonl with COMET (Unbabel/wmt22-comet-da) and print a combined table."""
import glob
import json

import torch

from comet import download_model, load_from_checkpoint
from comet.encoders.xlmr import XLMREncoder


def _xlmr_forward(self, input_ids, attention_mask, **kwargs):
    # transformers 5 no longer returns hidden states as a 3-tuple with return_dict=False.
    out = self.model(input_ids=input_ids, attention_mask=attention_mask, output_hidden_states=True)
    return {"sentemb": out.last_hidden_state[:, 0, :], "wordemb": out.last_hidden_state,
            "all_layers": out.hidden_states, "attention_mask": attention_mask}


XLMREncoder.forward = _xlmr_forward

model = load_from_checkpoint(download_model("Unbabel/wmt22-comet-da")).eval()


def comet_system_score(data, batch_size=16):
    # Manual inference loop: model.predict() breaks on recent Lightning versions.
    scores = []
    with torch.no_grad():
        for i in range(0, len(data), batch_size):
            inputs = model.prepare_sample(data[i:i + batch_size], stage="predict")
            scores.extend(model.predict_step(inputs).scores.tolist())
    return sum(scores) / len(scores)

summary = {}
with open("results/mt_summary.jsonl") as f:
    for line in f:
        row = json.loads(line)
        summary[row["model"]] = row

for path in sorted(glob.glob("results/mt_*.jsonl")):
    if path.endswith("summary.jsonl"):
        continue
    key = path[len("results/mt_"):-len(".jsonl")]
    with open(path) as f:
        rows = [json.loads(line) for line in f]
    data = [{"src": r["en"], "mt": r["hyp"], "ref": r["vi"]} for r in rows]
    score = comet_system_score(data)
    summary.setdefault(key, {"model": key})["comet"] = round(score * 100, 2)

with open("results/mt_final.json", "w") as f:
    json.dump(list(summary.values()), f, indent=1, ensure_ascii=False)
for row in summary.values():
    print(row)
