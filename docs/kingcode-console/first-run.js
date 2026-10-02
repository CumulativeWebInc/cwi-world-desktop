/* KingCode Console — first-run wizard (renderer).
 * Mic test, speaker test, chat URL, voice model note, voiceprint/PIN prompts,
 * security-note acknowledgment. Runs once; state in app settings.
 * © 2026 Cumulative Web Inc. All rights reserved.
 */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }
  function bridge() { return window.cwiConsole; }
  var step = 0;

  var STEPS = [
    { t: 'Welcome to the KingCode Console',
      b: 'This is me — KingCode — living inside your 3D world. Talk to me by voice, or tap the tabs. Everything voice-related runs on this laptop; nothing is recorded or sent anywhere for recognition.',
      btn: 'next' },
    { t: 'Step 1 — Microphone test',
      b: 'Tap “test mic”, speak normally, and watch the meter move.',
      btn: 'test mic', fn: 'mic' },
    { t: 'Step 2 — Speaker test',
      b: 'Tap “test speaker”. You should hear my voice check.',
      btn: 'test speaker', fn: 'speaker' },
    { t: 'Step 3 — Connect chat',
      b: 'Open the Chat tab and paste your Muse web address. Sign in once — it stays connected.',
      btn: 'open chat tab', fn: 'chat' },
    { t: 'Step 4 — Voice model',
      b: 'The offline voice model downloads once (~40 MB, free). Without it, the mic buttons stay quiet but everything else works.',
      btn: 'next' },
    { t: 'Step 5 — Voiceprint (optional)',
      b: 'Enroll 5 short voice samples in the Security tab so the console knows your voice. Skippable — without it, voice commands ask for a tap instead.',
      btn: 'open security tab', fn: 'security' },
    { t: 'Step 6 — PIN (optional)',
      b: 'Set a PIN in the Security tab. Sensitive actions — publishing, credentials, money — always need your tap, plus PIN when set. Voice alone never authorizes them.',
      btn: 'finish', fn: 'done' },
  ];

  function render() {
    var s = STEPS[step];
    var w = el('cwi-wizard');
    if (!w) return;
    w.innerHTML = '<div class="cwi-wizard"><div class="cwi-card">' +
      '<h4>' + s.t + ' (' + (step + 1) + '/' + STEPS.length + ')</h4><p>' + s.b + '</p>' +
      (s.fn === 'mic' ? '<div class="cwi-meter"><div id="cwi-miclevel"></div></div>' : '') +
      '<div class="cwi-row"><button class="cwi-btn" id="cwi-wiz-btn">' + s.btn + '</button>' +
      (step > 0 ? '<button class="cwi-btn ghost" id="cwi-wiz-back">back</button>' : '') +
      '<button class="cwi-btn ghost" id="cwi-wiz-skip">skip tour</button></div></div></div>';
    el('cwi-wiz-btn').addEventListener('click', function () { doFn(s.fn); });
    var back = el('cwi-wiz-back');
    if (back) back.addEventListener('click', function () { step--; render(); });
    el('cwi-wiz-skip').addEventListener('click', finish);
  }

  function doFn(fn) {
    if (fn === 'mic') return testMic();
    if (fn === 'speaker') { if (bridge()) bridge().speak('KingCode Console voice check. Can you hear me?'); return next(); }
    if (fn === 'chat') { openTab('chat'); return next(); }
    if (fn === 'security') { openTab('security'); return next(); }
    if (fn === 'done') return finish();
    next();
  }
  function next() { step = Math.min(step + 1, STEPS.length - 1); render(); }
  function openTab(t) {
    var tab = document.querySelector('#cwi-console-panel .cwi-tab[data-tab="' + t + '"]');
    if (tab) tab.click();
  }
  function finish() {
    var w = el('cwi-wizard');
    if (w) w.innerHTML = '';
    if (bridge()) bridge().settingsSet('first-run-done', '1');
  }

  function testMic() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var src = ctx.createMediaStreamSource(stream);
      var an = ctx.createAnalyser(); an.fftSize = 256;
      src.connect(an);
      var data = new Uint8Array(an.frequencyBinCount);
      var bar = el('cwi-miclevel');
      var n = 0;
      var iv = setInterval(function () {
        an.getByteFrequencyData(data);
        var avg = data.reduce(function (a, b) { return a + b; }, 0) / data.length;
        if (bar) bar.style.width = Math.min(100, avg * 1.5) + '%';
        if (++n > 60) {
          clearInterval(iv);
          stream.getTracks().forEach(function (t) { t.stop(); });
          ctx.close();
          next();
        }
      }, 100);
    }).catch(function () {
      var w = el('cwi-wizard');
      if (w) w.insertAdjacentHTML('beforeend', '<div class="cwi-card"><p>Mic blocked — allow microphone access for this app, then run the tour again from the Voice tab.</p></div>');
    });
  }

  window.KCIFirstRun = {
    maybe: function (mountId) {
      if (!bridge()) return;
      bridge().settingsGet('first-run-done').then(function (v) {
        if (v === '1') return;
        var m = document.getElementById(mountId);
        if (!m) return;
        m.innerHTML = '<div id="cwi-wizard"></div>';
        // Open the console so Black sees it.
        var fab = document.getElementById('cwi-console-fab');
        var panel = document.getElementById('cwi-console-panel');
        if (fab && panel && !panel.classList.contains('open')) fab.click();
        render();
      });
    },
  };
})();
