/* KingCode Console — privacy tiers (PURE, no DOM, no node).
 * PUBLIC / PRIVATE / SECRET with default-deny: any content type not
 * explicitly classified is PRIVATE. Masking + presenter-mode guards.
 * © 2026 Cumulative Web Inc. All rights reserved.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CWIPrivacy = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TIERS = { PUBLIC: 0, PRIVATE: 1, SECRET: 2 };
  var TIER_NAMES = ['PUBLIC', 'PRIVATE', 'SECRET'];

  /* Explicit classification table. Anything not listed here is PRIVATE
   * (default-deny). Add new types here deliberately — never silently. */
  var TYPE_TIERS = {
    // Public by design
    'agent-display-name': 0, 'agent-status': 0, 'task-title-public': 0,
    'world-scene-label': 0, 'playlist-placement': 0, 'public-url': 0,
    'marketing-copy': 0, 'release-title': 0, 'artist-name': 0,
    // Private: operational, masked until verified
    'task-detail': 1, 'task-content': 1, 'chat-transcript': 1,
    'notification-body': 1, 'voice-transcript': 1, 'prompt-text': 1,
    'email-address': 1, 'phone-number': 1, 'personal-name': 1,
    'dm-content': 1, 'outbox-draft': 1, 'audit-log': 1,
    // Secret: never rendered remotely, never in 3D scene
    'api-key': 2, 'credential': 2, 'password': 2, 'auth-code': 2,
    'wallet-address': 2, 'private-key': 2, 'seed-phrase': 2,
    'financial-figure': 2, 'voiceprint-embedding': 2, 'pin': 2,
  };

  /* Content sniffing: even PUBLIC-typed text gets escalated if it looks
   * like a secret. Never downgrade on a sniff — only escalate. */
  var SECRET_PATTERNS = [
    /\b[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}\b/,          // token-ish
    /\b0x[a-fA-F0-9]{40}\b/,                                  // eth address
    /\b(sk|pk|rk|whsec|xoxb|xoxp|ghp|gho|AKIA)[-_A-Za-z0-9]{8,}\b/,
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,             // card-ish
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,     // email -> PRIVATE min
  ];
  var EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

  function classify(type, text) {
    var tier = Object.prototype.hasOwnProperty.call(TYPE_TIERS, type)
      ? TYPE_TIERS[type] : 1; // DEFAULT-DENY: unlisted => PRIVATE
    if (typeof text === 'string') {
      for (var i = 0; i < SECRET_PATTERNS.length; i++) {
        if (SECRET_PATTERNS[i].test(text)) {
          if (i === 4) tier = Math.max(tier, 1); // email => at least PRIVATE
          else tier = 2;                          // secret-looking => SECRET
          break;
        }
      }
    }
    return tier;
  }

  var MASK = '•••';

  /* Decide what to render for a value.
   * ctx: { verified: bool (voiceprint or tap/PIN this session),
   *        presenterMode: bool }
   * Returns { visible: bool, text: string, tier: number } */
  function render(type, text, ctx) {
    ctx = ctx || {};
    var tier = classify(type, text);
    if (ctx.presenterMode) {
      // Presenter/outsider mode: PUBLIC only, everything else hidden.
      if (tier === 0) return { visible: true, text: String(text), tier: tier };
      return { visible: false, text: '', tier: tier };
    }
    if (tier === 0) return { visible: true, text: String(text), tier: tier };
    if (ctx.verified) return { visible: true, text: String(text), tier: tier };
    return { visible: true, text: MASK, tier: tier, masked: true };
  }

  function tierName(t) { return TIER_NAMES[t] || 'PRIVATE'; }

  /* 3D scene labels must never carry non-public text. */
  function sceneLabel(text) {
    var tier = classify('world-scene-label', text);
    if (tier !== 0) return { visible: true, text: MASK, tier: tier, masked: true };
    return { visible: true, text: String(text), tier: 0 };
  }

  return {
    TIERS: TIERS, tierName: tierName,
    classify: classify, render: render, sceneLabel: sceneLabel, MASK: MASK,
  };
}));
