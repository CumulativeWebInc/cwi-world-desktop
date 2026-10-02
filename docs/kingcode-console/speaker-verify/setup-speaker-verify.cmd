@echo off
REM KingCode Console — speaker-verification sidecar setup for Windows (one time, $0).
REM Installs PyTorch (CPU) + SpeechBrain and downloads the ECAPA-TDNN model.
REM If you skip this, the console still works — voiceprint verification simply
REM reports "not set up" and sensitive actions keep requiring tap/PIN.
echo ==^> KingCode Console speaker-verification setup
echo     One-time download (~1-2 GB). Press Ctrl-C to skip.
python -m pip install --user --upgrade pip
python -m pip install --user torch torchaudio --index-url https://download.pytorch.org/whl/cpu
python -m pip install --user speechbrain
echo ==^> Downloading ECAPA-TDNN model...
python -c "from speechbrain.inference import EncoderClassifier; EncoderClassifier.from_hparams(source='speechbrain/spkrec-ecapa-voxceleb', run_opts={'device':'cpu'}); print('model ready')"
echo ==^> Done. Restart CWI World Desktop and enroll your voice in the Console ^> Security tab.
pause
