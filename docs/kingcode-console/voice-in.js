/* KingCode Console — voice input (renderer).
 * Mic button + always-on wake word ("Hey KingCode") + offline STT.
 * Recognition: Vosk WASM (Apache 2.0), model bundled — nothing leaves the machine.
 * Wake detection: transcript keyword spotter (CWIVoiceMath) over the live
 * Vosk stream — local, offline. openWakeWord can replace the spotter via the
 * `setWakeEngine` adapter without changing the rest of the pipeline.
 * Speech output: main-process TTS via window.cwiConsole.speak.
 * © 2026 Cumulative Web Inc. All rights reserved.
 */
(function () {
  'use strict';
  var M = window.CWIVoiceMath;

  var S = {
    model: null, voiceError: null, listening: false, wakeOn: true,
    commandMode: false, commandTimer: null, micStream: null,
    audioCtx: null, procNode: null, recognizer: null,
    wakeEngine: null, // optional openWakeWord-style adapter: {onWake(cb)}
  };

  function el(id) { return document.getElementById(id); }
  function bridge() { return window.cwiConsole; }
  function caption(t) { var c = el('cwi-vcap'); if (c) c.textContent = t; }
  function setStatus(t, mode) {
    var x = el('cwi-vtext'); if (x) x.textContent = t;
    var d = el('cwi-vdot'); if (d) d.className = mode || '';
    var fab = document.getElementById('cwi-console-fab');
    if (fab) fab.classList.toggle('listening', S.listening);
  }
  function speak(t) { if (bridge() && bridge().speak) bridge().speak(t); }

  function ensureAudioCtx() {
    if (!S.audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      S.audioCtx = new AC({ sampleRate: 16000 });
    }
    return S.audioCtx;
  }

  function loadModel() {
    if (S.model || S.voiceError) return Promise.resolve(S.model);
    setStatus('loading voice model…');
    return window.Vosk.createModel('kingcode-console/voice/model.tar.gz').then(function (model) {
      S.model = model;
      model.on('error', function (e) {
        S.voiceError = String((e && e.error) || e);
        setStatus('voice unavailable', 'err');
      });
      setStatus(S.wakeOn ? 'say “Hey KingCode” or tap 🎙' : 'tap 🎙 to talk', 'ok');
      return model;
    }).catch(function (e) {
      S.voiceError = String((e && e.message) || e);
      setStatus('voice unavailable (model failed)', 'err');
      return null;
    });
  }

  function onCommand(text) {
    caption('🎙 ' + text);
    // Route the command through the console: draft into chat or run policy check.
    if (window.KingCodeConsole) {
      var dec = window.CWIPolicy.authorize({ action: text, voiceVerified: sessionVerified(), tapConfirmed: false });
      window.KingCodeConsole.audit(dec);
      if (dec.sensitivity === 'sensitive') {
        speak('That needs your tap to confirm. I put it in the console for you.');
        window.KingCodeConsole.toast('Sensitive command held for tap confirm', text);
        return;
      }
      if (!dec.allowed) {
        speak('I didn’t catch a verified voice. Tap the mic or verify in Security.');
        return;
      }
      speak('On it.');
      window.KingCodeConsole.toast('Voice command (routine, verified)', text);
    }
  }

  function sessionVerified() {
    return !!(window.KingCodeConsole && window.KingCodeConsole._verifiedNow && window.KingCodeConsole._verifiedNow());
  }

  function attachMic(onFinal, onPartial) {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 },
      video: false,
    }).then(function (stream) {
      S.micStream = stream;
      var ctx = ensureAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      var rec = new S.model.KaldiRecognizer();
      rec.on('result', function (msg) {
        var t = msg && msg.result && msg.result.text;
        if (t) onFinal(t);
      });
      rec.on('partialresult', function (msg) {
        var t = msg && msg.result && msg.result.partial;
        if (t) onPartial(t);
      });
      var src = ctx.createMediaStreamSource(stream);
      var proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = function (ev) {
        try { rec.acceptWaveform(ev.inputBuffer); } catch (e) {}
      };
      src.connect(proc); proc.connect(ctx.destination);
      S.procNode = proc; S.recognizer = rec;
      return rec;
    });
  }

  function detachMic() {
    try { if (S.procNode) S.procNode.disconnect(); } catch (e) {}
    try { if (S.recognizer) S.recognizer.remove(); } catch (e) {}
    S.procNode = null; S.recognizer = null;
    if (S.micStream) { S.micStream.getTracks().forEach(function (t) { t.stop(); }); S.micStream = null; }
  }

  function enterCommandMode() {
    S.commandMode = true;
    setStatus('yes? — listening…', 'hot');
    speak('Yes?');
    clearTimeout(S.commandTimer);
    S.commandTimer = setTimeout(function () {
      S.commandMode = false;
      setStatus('say “Hey KingCode” or tap 🎙', 'ok');
    }, 12000);
  }

  function handleFinal(text) {
    var kind = M.spot(text, S.commandMode ? 'command' : 'idle');
    if (kind === 'wake') { enterCommandMode(); return; }
    if (S.commandMode) {
      S.commandMode = false; clearTimeout(S.commandTimer);
      setStatus('working…'); onCommand(text);
      setStatus('say “Hey KingCode” or tap 🎙', 'ok');
    }
  }

  function startWakeLoop() {
    if (S.listening || !S.model) return;
    attachMic(handleFinal, function (partial) {
      if (!S.commandMode) caption('… ' + partial);
      // Partial-result fast path for the wake word.
      if (!S.commandMode && M.spot(partial, 'idle') === 'wake') {
        try { S.recognizer.remove(); } catch (e) {}
        S.procNode = null; S.recognizer = null;
        attachMic(handleFinal, function () {}).then(function () { enterCommandMode(); });
      }
    }).then(function () {
      S.listening = true;
      setStatus('say “Hey KingCode” or tap 🎙', 'ok');
    }).catch(function () {
      setStatus('mic blocked — check permission', 'err');
      speak('Microphone is blocked. Allow microphone access, then tap the talk button.');
    });
  }

  function stopAll() {
    S.listening = false; S.commandMode = false;
    clearTimeout(S.commandTimer); detachMic();
    setStatus('voice off', '');
  }

  /* One-shot capture for enrollment / challenge / verification. */
  function captureOnce(ms, cb) {
    loadModel().then(function (m) {
      if (!m) { cb(''); return; }
      var chunks = [];
      attachMic(function (t) { chunks.push(t); }, function () {}).then(function () {
        setTimeout(function () {
          var text = chunks.join(' ');
          detachMic();
          cb(text);
        }, ms);
      }).catch(function () { cb(''); });
    });
  }

  /* Raw PCM capture for voiceprint enrollment (4s @16kHz mono). */
  function capturePcm(seconds, cb) {
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 } })
      .then(function (stream) {
        var ctx = ensureAudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        var src = ctx.createMediaStreamSource(stream);
        var proc = ctx.createScriptProcessor(4096, 1, 1);
        var data = [];
        proc.onaudioprocess = function (ev) {
          data.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
        };
        src.connect(proc); proc.connect(ctx.destination);
        setTimeout(function () {
          proc.disconnect(); src.disconnect();
          stream.getTracks().forEach(function (t) { t.stop(); });
          var total = data.reduce(function (n, a) { return n + a.length; }, 0);
          var out = new Float32Array(total), o = 0;
          data.forEach(function (a) { out.set(a, o); o += a.length; });
          cb(Array.from(out));
        }, seconds * 1000);
      }).catch(function () { cb(null); });
  }

  function buildVoiceTab() {
    var body = el('cwi-body-voice');
    if (!body || body.dataset.built) return;
    body.dataset.built = '1';
    body.innerHTML =
      '<div class="cwi-card"><div class="cwi-vstatus"><span id="cwi-vdot">●</span><span id="cwi-vtext">voice warming up…</span></div>' +
      '<div id="cwi-vcap" aria-live="polite"></div>' +
      '<div class="cwi-row" style="justify-content:center;margin:14px 0"><button class="cwi-micbtn" id="cwi-ptt" title="Tap to talk">🎙</button></div>' +
      '<div class="cwi-row"><button class="cwi-btn ghost" id="cwi-wake-t">wake word: on</button>' +
      '<button class="cwi-btn ghost" id="cwi-vtest">test speaker</button></div>' +
      '<p style="font-size:11px">Wake word “Hey KingCode” is detected on this laptop only — audio never leaves the machine for recognition.</p></div>';
    el('cwi-ptt').addEventListener('click', function () {
      if (S.commandMode) return;
      loadModel().then(function (m) {
        if (!m) return;
        enterCommandMode();
      });
    });
    el('cwi-wake-t').addEventListener('click', function () {
      S.wakeOn = !S.wakeOn;
      this.textContent = S.wakeOn ? 'wake word: on' : 'wake word: off';
      if (bridge()) bridge().settingsSet('wake', S.wakeOn ? '1' : '0');
      if (S.wakeOn) { loadModel().then(startWakeLoop); } else { stopAll(); }
    });
    el('cwi-vtest').addEventListener('click', function () { speak('KingCode Console voice check. Can you hear me?'); });
  }

  window.KCIVoiceIn = {
    init: function () {
      buildVoiceTab();
      loadModel().then(function (m) {
        if (!m) return;
        var w = bridge() && bridge().settingsGet ? null : null;
        if (bridge()) bridge().settingsGet('wake').then(function (v) {
          if (v !== '0') startWakeLoop();
          else { S.wakeOn = false; var t = el('cwi-wake-t'); if (t) t.textContent = 'wake word: off'; }
        });
      });
      // First click unlocks audio (autoplay policy).
      document.addEventListener('click', function unlock() {
        try { ensureAudioCtx(); if (S.audioCtx && S.audioCtx.state === 'suspended') S.audioCtx.resume(); } catch (e) {}
        document.removeEventListener('click', unlock);
      });
    },
    ui: buildVoiceTab,
    captureOnce: captureOnce,
    capturePcm: capturePcm,
    setWakeEngine: function (eng) { S.wakeEngine = eng; }, // openWakeWord adapter hook
    verifySession: function (cb) {
      // Capture 3s, send to main for embedding verify.
      capturePcm(3, function (pcm) {
        if (!pcm || !bridge()) { cb(false, null); return; }
        bridge().voiceprintVerifyPcm(pcm).then(function (r) { cb(!!(r && r.pass), r && r.score); });
      });
    },
  };
})();
