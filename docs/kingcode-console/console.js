/* KingCode Console — in-world panel (renderer).
 * Tabs: Chat (embedded Muse client via webview) | Voice | Pings | Security.
 * Every rendered value passes through CWIPrivacy; sensitive actions pass
 * through CWIPolicy. Presenter mode hides all non-public panels instantly.
 * © 2026 Cumulative Web Inc. All rights reserved.
 */
(function () {
  'use strict';

  var P = window.CWIPrivacy, POL = window.CWIPolicy;
  var S = {
    open: false, tab: 'chat', verified: false, verifyTtl: 0,
    presenter: false, pinSet: false, chatUrl: '', pings: [],
    alpha: 0.72,
  };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function bridge() { return window.cwiConsole; }

  /* ---------- privacy-aware rendering ---------- */
  function ctx() {
    var verified = S.verified && Date.now() < S.verifyTtl;
    return { verified: verified, presenterMode: S.presenter };
  }
  function rv(type, text) { return P.render(type, text, ctx()); }
  function tierBadge(tier) {
    return '<span class="cwi-tier ' + P.tierName(tier).toLowerCase() + '">' + P.tierName(tier) + '</span>';
  }

  /* ---------- shell ---------- */
  function buildShell() {
    var fab = document.createElement('button');
    fab.id = 'cwi-console-fab';
    fab.title = 'KingCode Console';
    fab.innerHTML = '👑<span class="cwi-mic-live"></span>';
    fab.addEventListener('click', toggle);
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id = 'cwi-console-panel';
    panel.innerHTML =
      '<div class="cwi-chead">' +
        '<div class="cwi-title">👑 KingCode Console<small>chat · voice · pings · security</small></div>' +
        '<input type="range" id="cwi-alpha" min="25" max="100" value="72" step="5" title="Crystal glass — fade the whole console to watch the world behind it">' +
        '<button class="cwi-pbtn" id="cwi-presenter" title="Hide all non-public panels (screen-share safe)">🎥 presenter</button>' +
        '<button class="cwi-pbtn" id="cwi-close" title="Close">✕</button>' +
      '</div>' +
      '<div class="cwi-tabs">' +
        '<button class="cwi-tab active" data-tab="chat">💬 Chat</button>' +
        '<button class="cwi-tab" data-tab="radio">📻 Radio</button>' +
        '<button class="cwi-tab" data-tab="voice">🎙 Voice</button>' +
        '<button class="cwi-tab" data-tab="pings">🔔 Pings<span class="cwi-badge" id="cwi-ping-badge" style="display:none"></span></button>' +
        '<button class="cwi-tab cwi-nonpublic" data-tab="security">🔒 Security</button>' +
      '</div>' +
      '<div class="cwi-body active" id="cwi-body-chat"></div>' +
      '<div class="cwi-body" id="cwi-body-radio"></div>' +
      '<div class="cwi-body" id="cwi-body-voice"></div>' +
      '<div class="cwi-body cwi-nonpublic" id="cwi-body-pings"></div>' +
      '<div class="cwi-body cwi-nonpublic" id="cwi-body-security"></div>';
    document.body.appendChild(panel);

    var tz = document.createElement('div');
    tz.className = 'cwi-toast-zone'; tz.id = 'cwi-toast-zone';
    document.body.appendChild(tz);

    el('cwi-close').addEventListener('click', toggle);
    el('cwi-presenter').addEventListener('click', togglePresenter);
    el('cwi-alpha').addEventListener('input', function () {
      S.alpha = el('cwi-alpha').value / 100;
      applyAlpha();
      if (bridge()) bridge().settingsSet('console-alpha', String(el('cwi-alpha').value));
    });
    panel.querySelectorAll('.cwi-tab').forEach(function (t) {
      t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'p' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); togglePresenter(); }
    });
  }

  function toggle() {
    S.open = !S.open;
    el('cwi-console-panel').classList.toggle('open', S.open);
    applyAlpha();
    if (S.open) refreshAll();
  }
  function applyAlpha() {
    var p = el('cwi-console-panel');
    if (!p) return;
    p.style.setProperty('--cwi-glass', S.alpha.toFixed(2));
    var w = el('cwi-chat-webview');
    if (w) w.style.opacity = S.alpha >= 0.7 ? 1 : (0.3 + S.alpha).toFixed(2);
  }
  function showTab(name) {
    S.tab = name;
    document.querySelectorAll('#cwi-console-panel .cwi-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('#cwi-console-panel .cwi-body').forEach(function (b) {
      b.classList.toggle('active', b.id === 'cwi-body-' + name);
    });
    if (name === 'pings') renderPings();
    if (name === 'radio') renderRadio();
    if (name === 'security') renderSecurity();
    if (name === 'voice' && window.KCIVoiceIn) window.KCIVoiceIn.ui();
  }
  function togglePresenter() {
    S.presenter = !S.presenter;
    el('cwi-console-panel').classList.toggle('presenter', S.presenter);
    var b = el('cwi-presenter');
    b.classList.toggle('presenter-on', S.presenter);
    b.textContent = S.presenter ? '🎥 presenter ON' : '🎥 presenter';
    if (bridge() && bridge().setPresenter) bridge().setPresenter(S.presenter); // OS capture protection
    toast('Presenter mode ' + (S.presenter ? 'ON — only public content visible' : 'off'), '');
    refreshAll();
  }

  /* ---------- chat tab ---------- */
  function renderChat() {
    var body = el('cwi-body-chat');
    if (S.chatUrl) {
      body.innerHTML = '<div class="cwi-chat-wrap">' +
        '<webview id="cwi-chat-webview" src="' + esc(S.chatUrl) + '" partition="persist:kingcode" allowpopups></webview>' +
        '<div class="cwi-row"><button class="cwi-btn ghost" id="cwi-chat-change">change chat URL</button>' +
        '<button class="cwi-btn ghost" id="cwi-chat-reload">↻ reload</button></div></div>';
      el('cwi-chat-change').addEventListener('click', function () { S.chatUrl = ''; renderChat(); });
      el('cwi-chat-reload').addEventListener('click', function () {
        var w = el('cwi-chat-webview'); if (w && w.reload) w.reload();
      });
      return;
    }
    body.innerHTML = '<div class="cwi-card"><h4>Connect your KingCode chat</h4>' +
      '<p>Paste the web address of the Muse chat you use. The app signs in once and keeps you connected from inside the world.</p>' +
      '<div class="cwi-row"><input class="cwi-input" id="cwi-chat-url" placeholder="https://…" inputmode="url"></div>' +
      '<div class="cwi-row"><button class="cwi-btn" id="cwi-chat-save">connect</button></div>' +
      '<p style="font-size:11px">Stored only on this laptop. ' + tierBadge(1) + '</p></div>';
    el('cwi-chat-save').addEventListener('click', function () {
      var u = el('cwi-chat-url').value.trim();
      if (!/^https:\/\//i.test(u)) { toast('Use a full https:// address.', ''); return; }
      S.chatUrl = u;
      if (bridge()) bridge().settingsSet('chat-url', u);
      renderChat();
    });
  }

  /* ---------- radio tab ---------- */
  var RADIO_URL = 'https://stream.cumulativeweb.com:8443/radio';
  function radioAudio() {
    if (!S.radioEl) {
      var a = new Audio();
      a.src = RADIO_URL;
      a.preload = 'none';
      S.radioEl = a;
      S.radioOn = false;
    }
    return S.radioEl;
  }
  function renderRadio() {
    var body = el('cwi-body-radio');
    body.innerHTML = '<div class="cwi-card"><h4><span class="cwi-live-dot" id="cwi-radio-dot"></span> 📻 Cumulative Radio 365</h4>' +
      '<p id="cwi-radio-status">Our station — indie artists & producers, live 24/7.</p>' +
      '<div class="cwi-row"><button class="cwi-btn" id="cwi-radio-toggle">▶ play</button>' +
      '<input type="range" id="cwi-radio-vol" min="0" max="100" value="80" title="Volume" style="flex:1;accent-color:#f5c542"></div>' +
      '<p style="font-size:11px">Streaming live from inside the world. Music keeps playing while you roam.</p></div>';
    var a = radioAudio(), btn = el('cwi-radio-toggle');
    function paint() {
      btn.textContent = S.radioOn ? '⏸ stop' : '▶ play';
      el('cwi-radio-dot').classList.toggle('on', !!S.radioOn);
      el('cwi-radio-status').textContent = S.radioOn ? 'ON AIR — Radio 365 is playing.' : 'Our station — indie artists & producers, live 24/7.';
    }
    btn.addEventListener('click', function () {
      if (S.radioOn) { a.pause(); S.radioOn = false; }
      else {
        a.volume = el('cwi-radio-vol').value / 100;
        var pr = a.play();
        if (pr && pr.catch) pr.catch(function () { toast('Radio could not start — check your connection.', ''); });
        S.radioOn = true;
      }
      paint();
    });
    el('cwi-radio-vol').addEventListener('input', function () { a.volume = el('cwi-radio-vol').value / 100; });
    a.onended = function () { S.radioOn = false; paint(); };
    a.onerror = function () { if (S.radioOn) { S.radioOn = false; paint(); toast('Radio stream dropped.', ''); } };
    paint();
  }

  /* ---------- pings tab ---------- */
  function renderPings() {
    var body = el('cwi-body-pings');
    function row(p) {
      var t = rv('notification-body', p.title), b = rv('notification-body', p.body);
      var h = '<div class="cwi-card"><h4>' + esc(t.text) + ' ' + tierBadge(t.tier) + '</h4>' +
        '<p class="' + (b.masked ? 'cwi-masked' : '') + '">' + esc(b.text) + '</p>';
      if (p.url) h += '<p style="font-size:12px">' + esc(p.url) + '</p>';
      if (!p.answered) {
        h += '<div class="cwi-row">';
        if (p.kind === 'browser-request' || p.kind === 'confirm') {
          h += '<button class="cwi-btn" data-ans="yes" data-id="' + esc(p.id) + '">yes, do it</button>' +
               '<button class="cwi-btn ghost" data-ans="no" data-id="' + esc(p.id) + '">not now</button>';
        } else {
          h += '<button class="cwi-btn ghost" data-ans="seen" data-id="' + esc(p.id) + '">got it</button>';
        }
        h += '</div>';
      } else {
        h += '<p style="font-size:11px;color:#7de2a3">answered: ' + esc(p.answered.answer) + '</p>';
      }
      return h + '</div>';
    }
    var list = S.pings.slice().reverse();
    body.innerHTML = '<div class="cwi-card"><h4>🔔 KingCode pings</h4>' +
      '<p style="font-size:12px">When KingCode needs you — e.g. “open a browser for a login tap” — it lands here, as an in-world toast and a system notification. Answer by click or voice.</p></div>' +
      (list.length ? list.map(row).join('') : '<div class="cwi-card"><p>No pings. You’re all clear.</p></div>');
    body.querySelectorAll('[data-ans]').forEach(function (btn) {
      btn.addEventListener('click', function () { answerPing(btn.getAttribute('data-id'), btn.getAttribute('data-ans')); });
    });
  }

  function answerPing(id, answer) {
    var p = S.pings.find(function (x) { return x.id === id; });
    // Sensitive ping actions (open browser etc.) go through the policy engine.
    if (p && p.kind !== 'info') {
      var dec = POL.authorize({ action: p.action || p.kind, voiceVerified: false, tapConfirmed: true });
      audit(dec);
      if (!dec.allowed) { toast('Blocked: ' + dec.reason, ''); return; }
    }
    if (bridge()) bridge().pingAnswer(id, answer).then(function () {
      if (p && p.kind === 'browser-request' && answer === 'yes' && p.url && bridge()) bridge().openExternal(p.url);
      refreshPings();
    });
  }

  function refreshPings() {
    if (!bridge()) return;
    bridge().pingList().then(function (list) {
      S.pings = list || [];
      var un = S.pings.filter(function (p) { return !p.answered; }).length;
      var badge = el('cwi-ping-badge');
      badge.style.display = un ? '' : 'none'; badge.textContent = un;
      if (S.tab === 'pings') renderPings();
      // Raise toasts for fresh unanswered pings.
      S.pings.forEach(function (p) {
        if (!p.answered && !p._toasted) {
          p._toasted = true;
          var t = rv('notification-body', p.title), b = rv('notification-body', p.body);
          if (t.visible) toast(t.text, b.text);
        }
      });
    });
  }

  function toast(title, body) {
    var z = el('cwi-toast-zone');
    var d = document.createElement('div');
    d.className = 'cwi-toast';
    d.innerHTML = '<div class="cwi-tt">' + esc(title) + '</div>' +
      (body ? '<div class="cwi-tb">' + esc(body) + '</div>' : '') +
      '<div class="cwi-row"><button class="cwi-btn ghost" data-x>dismiss</button></div>';
    d.querySelector('[data-x]').addEventListener('click', function () { d.remove(); });
    z.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 20000);
  }

  /* ---------- security tab ---------- */
  function renderSecurity() {
    var body = el('cwi-body-security');
    var vstate = S.verified && Date.now() < S.verifyTtl ? 'verified (this session)' : 'not verified';
    body.innerHTML =
      '<div class="cwi-card"><h4>🔒 Voiceprint</h4><p>Status: <b>' + esc(vstate) + '</b></p>' +
      '<div class="cwi-row"><button class="cwi-btn" id="cwi-enroll">enroll my voice (5 samples)</button>' +
      '<button class="cwi-btn ghost" id="cwi-verify-now">verify now</button></div>' +
      '<div class="cwi-row"><button class="cwi-btn ghost" id="cwi-challenge">challenge-response test</button>' +
      '<button class="cwi-btn danger" id="cwi-voice-delete">delete voiceprint</button></div>' +
      '<p style="font-size:11px">Embedding stored only on this laptop, encrypted. ' + tierBadge(2) + '</p></div>' +
      '<div class="cwi-card"><h4>🔑 PIN</h4><p>' + (S.pinSet ? 'A PIN is set. Sensitive actions need tap + PIN.' : 'No PIN set. Sensitive actions need tap confirm.') + '</p>' +
      '<div class="cwi-row"><button class="cwi-btn ghost" id="cwi-pin">set / change PIN</button></div></div>' +
      '<div class="cwi-card"><h4>🎥 Presenter mode</h4><p>One tap hides every non-public panel — for screen shares, demos, streams, or shoulders.</p>' +
      '<div class="cwi-row"><button class="cwi-btn ghost" id="cwi-presenter2">toggle presenter mode</button></div></div>' +
      '<div class="cwi-card"><h4>📜 Authorization audit</h4><div class="cwi-audit" id="cwi-audit"></div></div>' +
      '<div class="cwi-card"><h4>🛡 Security note</h4><p><a href="#" id="cwi-secnote" style="color:#f5c542">Read what this protects against — and what it doesn’t.</a></p></div>';
    el('cwi-enroll').addEventListener('click', function () { if (window.KCIEnroll) window.KCIEnroll.start(); });
    el('cwi-verify-now').addEventListener('click', verifyNow);
    el('cwi-challenge').addEventListener('click', challengeResponse);
    el('cwi-voice-delete').addEventListener('click', function () {
      if (confirm('Delete your voiceprint from this laptop?')) {
        if (bridge()) bridge().voiceprintDelete().then(function () { S.verified = false; renderSecurity(); toast('Voiceprint deleted.', ''); });
      }
    });
    el('cwi-pin').addEventListener('click', setPin);
    el('cwi-presenter2').addEventListener('click', togglePresenter);
    el('cwi-secnote').addEventListener('click', function (e) { e.preventDefault(); window.open('kingcode-console/security-note.html', '_blank'); });
    renderAudit();
  }

  function verifyNow() {
    if (window.KCIVoiceIn) window.KCIVoiceIn.verifySession(function (ok, score) {
      if (ok) { S.verified = true; S.verifyTtl = Date.now() + 30 * 60 * 1000; toast('Voice verified' + (score != null ? ' (score ' + score.toFixed(2) + ')' : ''), 'Routine commands unlocked for 30 minutes.'); }
      else toast('Voice not recognized. ' + (score != null ? 'Score ' + score.toFixed(2) + ' below threshold.' : 'No voiceprint enrolled.'), '');
      renderSecurity();
    });
  }

  function challengeResponse() {
    if (!bridge()) return;
    toast('Challenge starting — listen and repeat the digits.', '');
    bridge().challengeStart().then(function (r) {
      if (!r || !r.ok) { toast('Challenge unavailable: ' + ((r && r.error) || 'unknown'), ''); return; }
      // voice-in captures the reply; main verifies transcript + voiceprint.
      if (window.KCIVoiceIn) window.KCIVoiceIn.captureOnce(8000, function (text) {
        bridge().challengeAnswer(text || '').then(function (v) {
          if (v && v.ok) { S.verified = true; S.verifyTtl = Date.now() + 30 * 60 * 1000; toast('Challenge passed — elevated verification granted.', ''); }
          else toast('Challenge failed.', '');
          renderSecurity();
        });
      });
    });
  }

  function setPin() {
    var p1 = prompt('Enter a new PIN (4+ digits). Cancel to leave unchanged:');
    if (p1 == null) return;
    if (!/^\d{4,}$/.test(p1)) { toast('PIN must be 4+ digits.', ''); return; }
    var p2 = prompt('Repeat the PIN:');
    if (p1 !== p2) { toast('PINs did not match.', ''); return; }
    if (bridge()) bridge().pinSet(p1).then(function () { S.pinSet = true; renderSecurity(); toast('PIN set.', ''); });
  }

  function audit(dec) {
    if (bridge()) bridge().auditAppend(dec);
    renderAudit();
  }

  function renderAudit() {
    var box = el('cwi-audit');
    if (!box || !bridge()) return;
    bridge().auditList(30).then(function (rows) {
      box.innerHTML = (rows || []).map(function (r) {
        return '<div class="' + (r.allowed ? 'allow' : 'deny') + '">' + esc(r.at) + ' ' +
          (r.allowed ? 'ALLOW' : 'DENY') + ' [' + esc(r.sensitivity) + '] ' + esc(r.action) +
          ' — ' + esc(r.reason) + '</div>';
      }).join('') || '<div>no audit records yet</div>';
    });
  }

  function refreshAll() {
    renderChat();
    if (window.KCIVoiceIn && S.tab === 'voice') window.KCIVoiceIn.ui();
    refreshPings();
    if (S.tab === 'security') renderSecurity();
  }

  /* ---------- public API ---------- */
  window.KingCodeConsole = {
    init: function () {
      buildShell();
      if (bridge()) {
        bridge().settingsGet('chat-url').then(function (v) { if (v) { S.chatUrl = v; } });
        bridge().settingsGet('presenter').then(function (v) { if (v === '1' && !S.presenter) togglePresenter(); });
        bridge().settingsGet('console-alpha').then(function (v) {
          var n = parseInt(v, 10);
          if (n >= 25 && n <= 100) {
            S.alpha = n / 100;
            var s = el('cwi-alpha'); if (s) s.value = n;
            applyAlpha();
          }
        });
        bridge().pinStatus().then(function (s) { S.pinSet = !!(s && s.pinSet); });
      }
      setInterval(refreshPings, 5000);
      refreshPings();
      if (window.KCIVoiceIn) window.KCIVoiceIn.init();
    },
    toast: toast,
    audit: audit,
    setVerified: function (v, ttlMs) { S.verified = v; S.verifyTtl = Date.now() + (ttlMs || 1800000); },
    isPresenter: function () { return S.presenter; },
    render: rv, tierBadge: tierBadge,
    /* Listening Lounge master-mute API (2026-10-01): guarded, minimal —
     * muting never stops playback, only silences the radio stream element.
     * window.CWIListening.RADIO_STREAM_URL names the same station. */
    radioGetMuted: function () { try { var a = radioAudio(); return !!(a && a.muted); } catch (e) { return null; } },
    radioGetVolume: function () { try { var a = radioAudio(); return a ? a.volume : null; } catch (e) { return null; } },
    radioSetMuted: function (m) { try { var a = radioAudio(); a.muted = !!m; } catch (e) { /* never break the caller */ } },
  };
})();
