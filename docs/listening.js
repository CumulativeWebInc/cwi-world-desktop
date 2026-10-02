/* Listening Lounge — listening-state logic (PURE: no DOM, no network, no randomness).
 * An agent is LISTENING exactly when they have a live task in progress:
 *   current_task_id != null AND current_task_state === 'in_progress'.
 * Idle agents are NOT listening — this module never fakes a listening state.
 * Favorite selection is deterministic (fnv-1a over the task id), so every
 * surface shows the same "current favorite" for a given task.
 *
 * Revenue-canon note (read 2026-10-01): this module carries no conversion leg —
 * it is pre-conversion UI logic. No prices, no checkout, no monetization hooks.
 *
 * © 2026 Cumulative Web Inc. All rights reserved.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CWIListening = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* HONEST AUDIO LABELING                                               */
  /*                                                                     */
  /* The Radio 365 stream is a LIVE broadcast: it cannot play a specific  */
  /* song on demand. So a {kind:'stream'} label names the agent's chosen  */
  /* favorite — the song the agent is listening to — while the shared     */
  /* office radio plays whatever is live on air. A {kind:'file'} label    */
  /* is different: it is the literal audio file played in tune-in mode.   */
  /* Never present a stream label as if it plays that exact song.        */
  /* ------------------------------------------------------------------ */
  var RADIO_STREAM_URL = 'https://stream.cumulativeweb.com:8443/radio';

  /* true iff the row describes an agent with a live task in progress.
   * Malformed input coerces to false — never throws. */
  function isListening(agentRow) {
    if (agentRow === null || agentRow === undefined || typeof agentRow !== 'object') return false;
    return agentRow.current_task_id != null && agentRow.current_task_state === 'in_progress';
  }

  /* fnv-1a 32-bit string hash. Simple, deterministic, portable. */
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /* Deterministic 0..count-1 index from an arbitrary seed; count<=0 -> -1. */
  function favoriteIndex(count, seed) {
    count = Number(count);
    if (!isFinite(count) || Math.floor(count) !== count || count <= 0) return -1;
    var s = String(seed);
    return fnv1a(s) % count;
  }

  /* The agent's current favorite for a task: the deterministic pick from
   * their favorites entry. Returns null when there is no usable entry. */
  function currentFavorite(favEntry, taskId) {
    if (favEntry === null || favEntry === undefined || typeof favEntry !== 'object') return null;
    var favs = favEntry.favorites;
    if (!Array.isArray(favs) || favs.length === 0) return null;
    var idx = favoriteIndex(favs.length, taskId);
    if (idx < 0 || idx >= favs.length) return null;
    var song = favs[idx];
    if (song === null || song === undefined || typeof song !== 'object') return null;
    return song;
  }

  /* Every agent currently listening who has a favorites entry:
   * [{ urn, task_id, title, artist, audio }]. Rows and favorites map are
   * never mutated; missing/malformed entries are skipped, not thrown. */
  function nowListening(agentRows, favoritesByUrn) {
    var out = [];
    if (!Array.isArray(agentRows)) return out;
    if (favoritesByUrn === null || favoritesByUrn === undefined || typeof favoritesByUrn !== 'object') return out;
    for (var i = 0; i < agentRows.length; i++) {
      var row = agentRows[i];
      if (!isListening(row)) continue;
      var urn = (row.urn != null) ? row.urn : row.agent_id;
      if (urn === null || urn === undefined) continue;
      var entry = favoritesByUrn[urn];
      if (entry === null || entry === undefined) continue;
      var song = currentFavorite(entry, row.current_task_id);
      if (song === null) continue;
      out.push({
        urn: urn,
        task_id: row.current_task_id,
        title: song.title,
        artist: song.artist,
        audio: song.audio,
      });
    }
    return out;
  }

  /* Describe how a song is played. A non-empty audio string = a real file
   * (tune-in mode). Anything else = the live shared radio stream. */
  function describeAudio(song) {
    if (song !== null && song !== undefined && typeof song === 'object' &&
        typeof song.audio === 'string' && song.audio.length > 0) {
      return { kind: 'file', src: song.audio };
    }
    return { kind: 'stream', src: RADIO_STREAM_URL };
  }

  return {
    isListening: isListening,
    favoriteIndex: favoriteIndex,
    currentFavorite: currentFavorite,
    nowListening: nowListening,
    describeAudio: describeAudio,
    RADIO_STREAM_URL: RADIO_STREAM_URL,
  };
}));
