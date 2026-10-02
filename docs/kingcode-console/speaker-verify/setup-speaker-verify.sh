#!/usr/bin/env bash
# KingCode Console — speaker-verification sidecar setup (one time, $0).
# Installs PyTorch (CPU) + SpeechBrain and downloads the ECAPA-TDNN
# speaker-embedding model (~1-2 GB disk total). Fully offline afterwards.
# If you skip this, the console still works — voiceprint verification simply
# reports "not set up" and sensitive actions keep requiring tap/PIN.
set -euo pipefail
echo "==> KingCode Console speaker-verification setup"
echo "    This installs PyTorch CPU + SpeechBrain (~1-2 GB) and downloads the"
echo "    ECAPA-TDNN model. One time only. Press Ctrl-C to skip."
python3 -m pip install --user --upgrade pip
python3 -m pip install --user torch torchaudio --index-url https://download.pytorch.org/whl/cpu
python3 -m pip install --user speechbrain
echo "==> Downloading ECAPA-TDNN model (speechbrain/spkrec-ecapa-voxceleb)…"
python3 -c "from speechbrain.inference import EncoderClassifier; EncoderClassifier.from_hparams(source='speechbrain/spkrec-ecapa-voxceleb', run_opts={'device':'cpu'}); print('model ready')"
echo "==> Done. Restart CWI World Desktop and enroll your voice in the Console > Security tab."
