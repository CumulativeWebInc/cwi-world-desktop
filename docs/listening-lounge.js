/* Listening Lounge — "🎧 Now Listening" panel, tune-in audio, master mute.
 *
 * Classic page script for the CWI World Desktop world page (app/index.html).
 * Depends on window.CWIListening (app/listening.js) — loaded before this file.
 *
 * HONESTY RULES (standing law, activity.js kill rule):
 *  - Favorites come ONLY from fetch('agent-favorites.json') (same-origin).
 *    If it fails to load or is malformed, the panel disables itself — it never
 *    renders invented rows.
 *  - Listening rows come ONLY from a live-data.json snapshot passed through
 *    onSnapshot() by the page's LIVE refresh hooks. In SAMPLE mode (no live
 *    feed) the panel says so and every 🎧 marker hides.
 *  - Audio is real and labeled honestly: kind 'file' = the literal song file
 *    played by the tune-in element; kind 'stream' = the agent's chosen
 *    favorite is NAMED, but the shared office radio (Radio 365 live
 *    broadcast) is what's actually playing — a live broadcast cannot play a
 *    specific song on demand. This label lives in the panel footer, not just
 *    in code.
 *
 * Master mute silences ALL lounge audio: the tune-in element AND the KingCode
 * Console Radio tab stream (via a minimal guarded public API on
 * window.KingCodeConsole — radioSetMuted/radioGetMuted; all touches wrapped
 * in try/catch so a console failure never kills the world).
 *
 * $0, no npm deps, no network except same-origin asset fetch (favorites json
 * + local audio files + the Radio 365 stream URL listening.js already ships).
 *
 * © 2026 Cumulative Web Inc. All rights reserved.
 */
(function () {
  'use strict';

  var PANEL_ID = 'loungepanel';
  var BODY_ID = 'lounge-body';
  var MUTE_ID = 'lounge-mute';
  var STATUS_ID = 'lounge-status';

  var favMap;               // undefined=loading, null=failed/unavailable, object=loaded
  var latestRows = [];        // last computed listening rows
  var liveModeSeen = false;   // a LIVE snapshot arrived at least once
  var masterMuted = false;    // master mute state
  var tuneAudio = null;       // active tune-in Audio element
  var tuneKey = null;         // urn|task_id of the active tune-in
  var initialized = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(id) { return document.getElementById(id); }

  function consoleApi() {
    try { return window.KingCodeConsole || null; } catch (e) { return null; }
  }
  function listening() {
    try { return window.CWIListening || null; } catch (e) { return null; }
  }

  /* ---------------- master mute ---------------- */
  /* One control silences everything the lounge touches: the tune-in element
   * and the Radio tab's stream element (via console.js's minimal API). */
  function setMasterMuted(m) {
    masterMuted = !!m;
    try {
      if (tuneAudio) tuneAudio.muted = masterMuted;
      var KC = consoleApi();
      if (KC && typeof KC.radioSetMuted === 'function') KC.radioSetMuted(masterMuted);
    } catch (e) { /* a console failure never kills the world */ }
    paintMute();
  }
  function paintMute() {
    var b = el(MUTE_ID);
    if (b) {
      b.textContent = masterMuted ? '🔇 unmute all' : '🔊 mute all';
      b.classList.toggle('muted', masterMuted);
      b.title = masterMuted
        ? 'Master mute ON — tune-in audio and the Radio tab stream are silenced.'
        : 'Mute ALL lounge audio (tune-in + Radio tab stream).';
    }
  }
  function status(msg) {
    var s = el(STATUS_ID);
    if (s) s.textContent = msg || '';
  }

  /* ---------------- tune-in ---------------- */
  function stopTune() {
    try {
      if (tuneAudio) { tuneAudio.pause(); tuneAudio.src = ''; tuneAudio.load(); }
    } catch (e) { /* best effort */ }
    tuneAudio = null;
    tuneKey = null;
  }
  /* Click a row to TUNE IN. file-kind = literal audio file; stream-kind =
   * the shared live Radio 365 broadcast (honest: the named favorite is the
   * agent's chosen song, NOT what the live broadcast is guaranteed to play).
   * Clicking the active row again stops tune-in. */
  function tuneIn(row) {
    var L = listening();
    if (!L) return;
    var key = String(row.urn) + '|' + String(row.task_id);
    if (tuneKey === key) { stopTune(); status('tune-in stopped.'); renderRows(); return; }
    stopTune();
    var desc;
    try { desc = L.describeAudio(row); } catch (e) { status('could not describe audio.'); return; }
    var a;
    try {
      a = new Audio();
      a.preload = 'none';
      a.src = desc.src;
      a.muted = masterMuted;
    } catch (e) { status('audio unavailable.'); return; }
    a.onerror = function () {
      stopTune();
      status(desc.kind === 'file' ? 'song file unavailable — tune-in stopped.' : 'stream unreachable — tune-in stopped.');
      renderRows();
    };
    tuneAudio = a;
    tuneKey = key;
    var pr;
    try { pr = a.play(); } catch (e) { pr = null; }
    if (pr && typeof pr.catch === 'function') {
      pr.catch(function () {
        if (tuneKey === key) {
          stopTune();
          status('playback blocked by the browser — tune-in stopped. (Tap the row to retry.)');
          renderRows();
        }
      });
    }
    status(desc.kind === 'file'
      ? '🎧 tuned in — playing the song file: “' + row.title + '”.'
      : '🎧 tuned in — shared office radio live. “' + row.title + '” is the agent’s favorite, not what’s on air.');
    renderRows();
  }

  /* ---------------- panel rendering ---------------- */
  /* Renders ONLY from latestRows (live snapshot × loaded favorites).
   * Empty states are honest: no fake agents, no fake songs. */
  function renderRows() {
    var box = el(BODY_ID);
    if (!box) return;
    if (!listening()) {
      box.innerHTML = '<div class="lrow empty"><span class="arole">Listening engine unavailable.</span></div>';
      return;
    }
    if (favMap === undefined) {
      box.innerHTML = '<div class="lrow empty"><span class="arole">Loading agent favorites…</span></div>';
      return;
    }
    if (favMap === null) {
      box.innerHTML = '<div class="lrow empty"><span class="arole">Favorites file unavailable — the lounge is disabled until agent-favorites.json loads. No data shown.</span></div>';
      return;
    }
    if (!liveModeSeen) {
      box.innerHTML = '<div class="lrow empty"><span class="arole">Waiting for the live ledger feed — listening state only reflects live tasks.</span></div>';
      return;
    }
    if (!latestRows.length) {
      box.innerHTML = '<div class="lrow empty"><span class="arole">No agents are listening right now. (An agent listens only while a task is in progress.)</span></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < latestRows.length; i++) {
      var r = latestRows[i];
      var desc;
      try { desc = listening().describeAudio(r); } catch (e) { desc = { kind: 'stream' }; }
      var name = String(r.urn || '').replace(/^agent:/, '');
      var key = esc(r.urn) + '|' + esc(r.task_id);
      var active = (tuneKey === String(r.urn) + '|' + String(r.task_id));
      html += '<button class="lrow' + (active ? ' active' : '') + '" data-key="' + key + '" data-i="' + i + '">' +
        '<span class="lagent">🎧 ' + esc(name) + '</span>' +
        '<span class="lsong">“' + esc(r.title) + '” — ' + esc(r.artist) + '</span>' +
        '<span class="lkind ' + desc.kind + '">' + (desc.kind === 'file' ? 'FILE · literal audio' : 'STREAM · office radio') + '</span>' +
        '<span class="ltune">' + (active ? '⏹ stop' : '▶ tune in') + '</span>' +
        '</button>';
    }
    box.innerHTML = html;
    var btns = box.querySelectorAll('.lrow');
    for (var j = 0; j < btns.length; j++) {
      (function (b) {
        b.addEventListener('click', function () {
          var idx = parseInt(b.getAttribute('data-i'), 10);
          if (isFinite(idx) && latestRows[idx]) tuneIn(latestRows[idx]);
        });
      })(btns[j]);
    }
  }

  /* ---------------- 3D markers ---------------- */
  /* Rebuilds a form's 🎧 sprite only when the labeled text changed (cheap),
   * disposes the replaced texture, and hides the marker when the agent is
   * not listening. makeSprite is the page's labelSprite factory. */
  function refreshListenSprite(F, song, makeSprite) {
    if (!F || !F.listenSprite) return;
    var sp = F.listenSprite;
    if (!song) {
      sp.visible = false;
      F._listenKey = null;
      return;
    }
    if (F._listenKey === song) { sp.visible = true; return; }
    F._listenKey = song;
    try {
      var ns = makeSprite('🎧 ' + song, { size: 26, fg: '#7EF0C1' });
      var oldMap = sp.material.map;
      sp.material.map = ns.material.map;
      sp.scale.copy(ns.scale);
      ns.material.dispose();            /* map moved to sp; drop the shell */
      if (oldMap) oldMap.dispose();     /* drop the replaced texture */
      sp.visible = true;
    } catch (e) { /* marker failure never kills the world */ }
  }

  /* ---------------- snapshot entry point ---------------- */
  /* Called from the page's LIVE refresh hooks with the same live-data.json
   * snapshot the rest of the world consumes. Recomputes listening state
   * through CWIListening (pure logic) and repaints the 🎧 markers. Never
   * fires on SAMPLE data — the mode gate below keeps it honest. */
  function onSnapshot(json, forms, makeSprite) {
    var WC = null;
    try { WC = window.WorldClient || null; } catch (e) { WC = null; }
    var live = !!(WC && WC.mode === 'LIVE');
    if (live) liveModeSeen = true;
    var L = listening();
    var rows = [];
    if (live && L && favMap && json) {
      try { rows = L.nowListening(json.agents || [], favMap) || []; } catch (e) { rows = []; }
    }
    latestRows = rows;
    renderRows();
    if (Array.isArray(forms)) {
      var byUrn = {};
      for (var i = 0; i < rows.length; i++) byUrn[rows[i].urn] = rows[i];
      for (var j = 0; j < forms.length; j++) {
        var F = forms[j];
        var urn = (F && F.spec) ? F.spec.agent_id : null;
        var hit = (urn != null) ? byUrn[urn] : null;
        refreshListenSprite(F, hit ? hit.title : null, makeSprite);
      }
    }
  }

  /* ---------------- boot ---------------- */
  function init() {
    if (initialized) return;
    initialized = true;
    var mBtn = el(MUTE_ID);
    if (mBtn) mBtn.addEventListener('click', function () { setMasterMuted(!masterMuted); });
    /* Sync with any pre-existing console radio mute state (guarded). */
    try {
      var KC = consoleApi();
      if (KC && typeof KC.radioGetMuted === 'function' && KC.radioGetMuted() === true) masterMuted = true;
    } catch (e) { /* keep default */ }
    paintMute();
    renderRows();
    /* Same-origin favorites asset. Any failure disables the lounge honestly. */
    try {
      fetch('agent-favorites.json', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (j) {
          if (!j || !Array.isArray(j.agents)) throw new Error('bad schema');
          var m = {};
          for (var i = 0; i < j.agents.length; i++) {
            var a = j.agents[i];
            if (a && a.urn) m[a.urn] = { favorites: Array.isArray(a.favorites) ? a.favorites : [] };
          }
          favMap = m;
          renderRows();
        })
        .catch(function () { favMap = null; renderRows(); });
    } catch (e) { favMap = null; renderRows(); }
  }

  function toggle(force) {
    var p = el(PANEL_ID);
    if (!p) return;
    var open = (force === undefined) ? !p.classList.contains('open') : !!force;
    p.classList.toggle('open', open);
    var b = document.getElementById('b-lounge');
    if (b) b.classList.toggle('active', open);
  }

  window.ListeningLounge = {
    init: init,
    toggle: toggle,
    onSnapshot: onSnapshot,
    setMasterMuted: setMasterMuted,
    isMuted: function () { return masterMuted; },
    rows: function () { return latestRows.slice(); },
  };
})();
