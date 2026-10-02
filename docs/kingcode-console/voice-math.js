/* KingCode Console — wake-word spotter + speaker-verification math (PURE).
 * Wake word: "Hey KingCode" (also matches bare "KingCode").
 * Verification math: cosine similarity over embedding vectors.
 * © 2026 Cumulative Web Inc. All rights reserved.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CWIVoiceMath = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WAKE_RES = [
    /\bhey[,\s]+king\s?code\b/i,
    /\bking\s?code\b/i,
  ];

  /* Returns 'wake' | 'command' | null for a transcript chunk.
   * In idle mode only WAKE fires; in command mode everything is a command. */
  function spot(transcript, mode) {
    var t = String(transcript || '').trim();
    if (!t) return null;
    var isWake = WAKE_RES.some(function (re) { return re.test(t); });
    if (mode === 'idle') return isWake ? 'wake' : null;
    return 'command';
  }

  function dot(a, b) {
    var s = 0, n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) s += a[i] * b[i];
    return s;
  }
  function norm(a) { return Math.sqrt(dot(a, a)); }

  function cosine(a, b) {
    if (!a || !b || !a.length || !b.length) return 0;
    var n = norm(a) * norm(b);
    if (n === 0) return 0;
    return dot(a, b) / n;
  }

  /* Mean embedding across enrollment samples. */
  function meanEmbedding(samples) {
    if (!samples.length) return [];
    var dim = samples[0].length;
    var m = new Array(dim).fill(0);
    samples.forEach(function (s) {
      for (var i = 0; i < dim; i++) m[i] += (s[i] || 0);
    });
    return m.map(function (v) { return v / samples.length; });
  }

  /* Verify a fresh embedding against the enrolled mean.
   * Returns { score, pass } — pass at threshold (default 0.60). */
  function verifyEmbedding(mean, fresh, threshold) {
    threshold = (typeof threshold === 'number') ? threshold : 0.60;
    var score = cosine(mean, fresh);
    return { score: score, pass: score >= threshold, threshold: threshold };
  }

  /* Enrollment state machine: needs 5 samples. */
  function enrollmentNext(state) {
    state = state || {};
    var n = (typeof state.samples === 'number' ? state.samples : 0) + 1;
    return { samples: n, complete: n >= 5, remaining: Math.max(0, 5 - n) };
  }

  return {
    spot: spot, WAKE_RES: WAKE_RES,
    cosine: cosine, meanEmbedding: meanEmbedding,
    verifyEmbedding: verifyEmbedding, enrollmentNext: enrollmentNext,
  };
}));
