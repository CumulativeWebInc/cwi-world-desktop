/* KingCode Console — tiered authorization policy (PURE, no DOM, no node).
 *
 * HARD RULE (Black's standing law, enforced in code):
 *   Voice alone NEVER authorizes a sensitive action.
 *   Sensitive = publish, credentials, logins, money, wallet, signing,
 *   external sends, installs. These ALWAYS require an in-app tap confirm
 *   (plus PIN when one is set), regardless of voiceprint verification.
 *   Voiceprint unlocks ROUTINE commands only.
 *
 * © 2026 Cumulative Web Inc. All rights reserved.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CWIPolicy = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Sensitive action matchers. Voice can NEVER authorize these alone.
   * New capabilities must be registered here before they can run. */
  var SENSITIVE_RES = [
    /publish|post\b|deploy|release/i,
    /credential|password|api[-_ ]?key|secret|token/i,
    /login|sign[-_ ]?in|oauth|auth(?!or)/i,
    /pay|spend|wallet|sign\b|transaction|withdraw|transfer|buy|purchase|money|usdc|crypto/i,
    /\bsend\b|email|dm\b|message.*external|blast/i,
    /install|uninstall|delete.*account|reset.*password/i,
  ];

  var ROUTINE_RES = [
    /status|list|show|read|search|find/i,
    /open|navigate|go to/i,
    /ask|question|explain|summar/i,
    /play|pause|stop.*audio/i,
  ];

  function sensitivityOf(action) {
    var a = String(action || '');
    for (var i = 0; i < SENSITIVE_RES.length; i++) {
      if (SENSITIVE_RES[i].test(a)) return 'sensitive';
    }
    return 'routine';
  }

  /* authorize({ action, voiceVerified, tapConfirmed, pinSet, pinOk })
   * Returns { allowed, sensitivity, reason }.
   * Audit every call — the caller persists the record. */
  function authorize(o) {
    o = o || {};
    var sensitivity = sensitivityOf(o.action);
    var rec = {
      at: new Date().toISOString(),
      action: String(o.action || ''),
      sensitivity: sensitivity,
      voiceVerified: !!o.voiceVerified,
      tapConfirmed: !!o.tapConfirmed,
    };
    if (sensitivity === 'sensitive') {
      // HARD RULE: voice is never sufficient. Tap confirm mandatory.
      if (!o.tapConfirmed) {
        rec.allowed = false;
        rec.reason = 'sensitive action requires in-app tap confirm; voice alone is never enough';
        return rec;
      }
      if (o.pinSet && !o.pinOk) {
        rec.allowed = false;
        rec.reason = 'sensitive action requires PIN in addition to tap confirm';
        return rec;
      }
      rec.allowed = true;
      rec.reason = 'sensitive action authorized by tap confirm' + (o.pinSet ? ' + PIN' : '');
      return rec;
    }
    // Routine: voiceprint OR tap.
    if (o.voiceVerified || o.tapConfirmed) {
      rec.allowed = true;
      rec.reason = o.voiceVerified ? 'routine action authorized by voiceprint' : 'routine action authorized by tap';
      return rec;
    }
    rec.allowed = false;
    rec.reason = 'routine action needs voiceprint verification or tap confirm';
    return rec;
  }

  return { sensitivityOf: sensitivityOf, authorize: authorize };
}));
