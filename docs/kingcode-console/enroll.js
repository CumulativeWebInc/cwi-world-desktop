/* KingCode Console — voiceprint enrollment UI (renderer).
 * 5 short samples -> main process extracts ECAPA embeddings -> mean stored
 * encrypted. If the sidecar isn't installed, enrollment explains the one-time
 * setup instead of pretending. © 2026 Cumulative Web Inc.
 */
(function () {
  'use strict';
  var M = window.CWIVoiceMath;

  var PHRASES = [
    'Say: “KingCode, this is Black.”',
    'Say: “Open the task board.”',
    'Say: “What’s the status of the release?”',
    'Say: “Play the new single.”',
    'Say: “Good — that’s my voice.”',
  ];

  function bridge() { return window.cwiConsole; }
  function toast(t, b) { if (window.KingCodeConsole) window.KingCodeConsole.toast(t, b); }

  function start() {
    if (!bridge()) return;
    bridge().voiceprintStatus().then(function (st) {
      if (!st.sidecar) {
        toast('Voiceprint needs the one-time setup',
          'Run setup-speaker-verify (in the app folder kingcode-console/speaker-verify) once, then restart. Until then, sensitive actions keep requiring your tap.');
        return;
      }
      if (st.enrolled) {
        if (!confirm('A voiceprint is already enrolled. Replace it with a new one?')) return;
      }
      runEnrollment({ samples: 0 });
    });
  }

  function runEnrollment(state) {
    var step = M.enrollmentNext(state);
    if (step.complete) { finish(); return; }
    var phrase = PHRASES[state.samples] || PHRASES[0];
    toast('Voiceprint sample ' + (state.samples + 1) + ' of 5', phrase + ' — recording 4 seconds…');
    if (window.KCIVoiceIn) window.KCIVoiceIn.capturePcm(4, function (pcm) {
      if (!pcm) { toast('Mic capture failed — check permission.', ''); return; }
      bridge().voiceprintEnrollSample(pcm).then(function (r) {
        if (r && r.ok) runEnrollment(step);
        else toast('Sample rejected: ' + ((r && r.error) || 'unknown'), 'Try again in a quieter spot.');
      });
    });
  }

  function finish() {
    bridge().voiceprintEnrollFinish().then(function (r) {
      if (r && r.ok) {
        toast('Voiceprint enrolled.', 'Routine voice commands are now unlocked for your voice. Sensitive actions still need your tap — always.');
        if (window.KingCodeConsole) window.KingCodeConsole.setVerified(true);
      } else toast('Enrollment failed: ' + ((r && r.error) || 'unknown'), '');
    });
  }

  window.KCIEnroll = { start: start };
})();
