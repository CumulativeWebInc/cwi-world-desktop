#!/usr/bin/env python3
"""KingCode Console — ECAPA-TDNN embedding extractor (local sidecar).

Reads one wav file (16 kHz mono recommended), prints JSON:
  {"embedding": [float, ...], "dim": 192, "model": "ecapa-tdnn"}
Fully offline after the one-time model download. Never transmits audio.

Setup: bash setup-speaker-verify.sh   (installs torch CPU + speechbrain,
downloads the ECAPA model — one time, ~1-2 GB disk, $0)
"""
import json
import sys

WAV_PATH = sys.argv[1] if len(sys.argv) > 1 else None
if not WAV_PATH:
    print(json.dumps({"error": "no-wav"}))
    sys.exit(2)

try:
    import torchaudio
    from speechbrain.inference import EncoderClassifier
except ImportError as e:
    print(json.dumps({"error": "missing-deps", "detail": str(e)[:200]}))
    sys.exit(3)

MODEL = "speechbrain/spkrec-ecapa-voxceleb"
try:
    classifier = EncoderClassifier.from_hparams(source=MODEL, run_opts={"device": "cpu"})
except Exception as e:  # model download failed / offline first run
    print(json.dumps({"error": "model-unavailable", "detail": str(e)[:200]}))
    sys.exit(4)

try:
    signal, fs = torchaudio.load(WAV_PATH)
    if fs != 16000:
        signal = torchaudio.functional.resample(signal, fs, 16000)
    if signal.shape[0] > 1:
        signal = signal.mean(dim=0, keepdim=True)
    emb = classifier.encode_batch(signal).squeeze().tolist()
    print(json.dumps({"embedding": emb, "dim": len(emb), "model": "spkrec-ecapa-voxceleb"}))
except Exception as e:
    print(json.dumps({"error": "extract-failed", "detail": str(e)[:200]}))
    sys.exit(5)
