## Twenty Minds — Honest activity layer for the Gear Ledger 3D world

**Decision:** Ship (A) the full honest activity layer — task-pointer flares, cross-agent collaboration pulses, assigned/verified ribbon arcs, all diffed client-side from re-polled live-data.json snapshots, publisher extended with display-safe `events_recent`, idle agents untouched, per-element kill rule — vs (B) pointer-flares only, the minimal guaranteed-truthful layer.

Facts (max 5):
1. live-data.json refreshes every 10 min from the real ledger store; the page currently fetches it once at load and never re-polls, so snapshot diffing (which stage-logic.js already supports via THINKING state) never fires in practice.
2. Real collaboration data exists: 43 of 44 tasks carry `state_history` with from/to/at/by; 15 tasks have created_by ≠ assigned_to; the store's `handoffs` array is empty.
3. Kill rule: any element that cannot be driven by real data is cut, not faked — idle agents stay honestly idle; the old wandering engine stays banned in LIVE mode.
4. This VM's Chromium cannot render the site (Fastly blocks it); Black's phone is the only visual authority, and he already said the world "doesn't look different."
5. Deploy is ghapi/Git Data API with `?v=` cache-busting on every changed module import; a static scope check must gate the inline module script (the DISTRICT_BEACONS ReferenceError lesson).

Pre-run lean: A (full layer — Black said YES to the activity layer and the data is real).

### Verdicts (one sentence + one risk each)
1. Skeptic — Ship A; the data hooks are real, but pulses and ribbons will fire so rarely on a quiet ledger that the "alive" world may still look still — the strongest argument for A is also its weakest evidence.
   Risk: we build an event-reactive system for events that barely happen, and Black sees no difference again.
2. Data scientist — Ship B; flares fire deterministically on pointer changes already present in the data, while pulses/ribbons depend on event sparsity we have not measured — ship the measurable signal first.
   Risk: pointer changes are themselves rare (two live pointers today), so B is also near-silent — the honest answer may be "the world is quiet because the work is quiet."
3. User advocate — Ship A; Black asked why the agents aren't walking around and said YES to the activity layer — he wants to see aliveness, and only the full layer gives three chances to see it.
   Risk: if he still sees nothing different, the credibility cost lands on the whole world, not just this layer.
4. Contrarian — Ship B, or nothing; the world is a ledger visualization, not a game — dressing quiet truth in pulses and ribbons is theater that risks the honesty brand Black just praised.
   Risk: B is so minimal it reads as "we did nothing," and Black's YES withers into another quiet scene.
5. Engineer — Ship A; all three effects share one differ plus one effect-spawner, the publisher extension adds display-safe fields only, and the kill rule gives a clean per-element cut path — one architecture, three honest signals.
   Risk: the re-poll timer plus differ plus effect lifecycle is the most code the page has added at once, and this VM cannot visually smoke-test it — a dead effect loop would sit invisible until Black's phone.
6. Economist — Ship A; the marginal cost of pulses/ribbons over flares is one pure module and one publisher field, but the marginal attention value is high — Black's phone is the command deck and visible aliveness is the asset.
   Risk: attention value collapses to zero if effects never trigger; then the engineering time is sunk with no return.
7. Security reviewer — Ship A, but strip free-text notes from events_recent; state_history entries carry free-text `note` fields and the map-live header already bans forwarding free text — one careless field and the page renders store-influenced text.
   Risk: the ribbon label tempts someone to include the task title — titles are also free text from the store; sanitize and truncate them.
8. Child-of-five explainer — Ship A; "when an agent really starts a job it glows, when two agents really work together a light travels between them, when a job really finishes a ribbon flies" — a five-year-old understands it.
   Risk: the child also asks "why is nobody doing anything," and the honest answer ("because nobody is") is the part we cannot animate away.
9. 10-year historian — Ship A; in 2036 the record shows CWI proved agent worlds can visualize only real work — the honesty constraint, kept under pressure from the owner to "make it lively," is the decision that matters.
   Risk: historians also record the quiet months, and a beautiful-but-still layer reads as a monument to inactivity.
10. Devil's accountant — Ship B; full-layer build plus tests plus deploy plus phone verification is a half-day of machine time for effects that may fire weekly — B is an hour and proves the pipeline.
    Risk: B's thrift looks like fear, and Black funds aliveness, not thrift — the cheapest option can be the most expensive politically.
11. Field operator — Ship A; my worst Tuesday is Black screenshotting a frozen world because a re-poll timer died silently — so the layer needs the bridge's honest fallback: on poll failure, keep the last good snapshot and say so.
    Risk: effect objects (rings, arcs, sprites) leak GPU memory across polls if disposal is not airtight — my Tuesday becomes a slideshow.
12. Systems thinker — Ship A; the differ creates a feedback loop: visible events make the agents' work legible, legibility earns Black's trust, trust funds more work, more work fires more events — the layer feeds the machine it visualizes.
    Risk: the loop runs in reverse too — a quiet week makes the world look dead, which reads as failure, which starves the work.
13. Risk underwriter — Ship B; the tail risk in A is a false-positive flare — a pointer diff firing on a stale-vs-fresh snapshot mismatch tells Black an agent started work when nothing happened — one lie burns the honesty brand.
    Risk: B carries the same tail risk on its single signal; the underwriter prices the differ's guards, not the layer's size.
14. Open-source maintainer — Ship A; a stranger forking the world should find activity.js with pure data-in/data-out functions, a schema comment, and the kill rule written in the code, not just the docs.
    Risk: three effect types with hand-rolled THREE code is a lot for a stranger to audit — the module must stay dependency-free and small.
15. Negotiator — Ship A; the other side is Black's expectation of aliveness — A's three signals give walk-away room: if pulses never fire, cut pulses and keep flares, and the deal (an honest lively world) still holds.
    Risk: negotiating against our own kill rule — once we cut two of three, we shipped B at A's price.
16. Time traveler (2036) — Ship A; looking back, the full layer was the move — the flare/pulse/ribbon vocabulary became the house language for every CWI visualization, and it started here, with real data only.
    Risk: nostalgia for the plan, not the outcome — the traveler remembers the vocabulary but forgets the months it sat unfired.
17. First-principles physicist — Ship A; irreducible facts: snapshots differ, diffs are computable, state_history transitions are timestamped real events — every element reduces to data that exists; nothing must be invented.
    Risk: "exists" is not "flows" — the physics is right but the current is near zero.
18. Ethicist — Ship A; no agent is depicted doing work it is not doing — the layer visualizes only attested events, and idle agents stay idle — this is the only lively design that does not lie.
    Risk: the design's honesty is invisible to a casual viewer, who reads stillness as brokenness — the HUD owes a line explaining "quiet = no new work," not just the effects.
19. Competitor analyst — Ship A; the strongest competitor's agent world fakes ambient activity to look alive — our moat is the one world that refuses to, and the activity layer is the proof that honesty can still move.
    Risk: the competitor's world looks alive on day one; ours looks alive only when the machine works — in a demo, the faker wins.
20. Black's chair — Ship A; results only, $0 path, verify before asserting — the data is real, the pipeline is free, the kill rule is written down; fire the full layer and cut what cannot be fed.
    Risk: his YES was for aliveness — if the phone shows nothing new, "honest" sounds like an excuse; the HUD must show the layer is listening (last-check time, event counts).

### Synthesis
- Decision: Ship A — the full honest activity layer: pointer-change flares, cross-agent collaboration pulses, assigned/verified/delivered ribbon arcs; client-side differ over re-polled live-data.json snapshots (5-min cadence, fresh-LIVE-only diffs, no first-snapshot flares, honest poll-failure fallback); publisher extended with display-safe `events_recent` (real state_history transitions only, no free-text notes); idle agents untouched; per-element kill rule.
- Why: the ethicist's no-lie constraint (the only lively design that does not fake work), the physicist's reducibility (every element computes from data that exists — 43/44 tasks with timestamped transitions, 15 cross-agent created_by/assigned_to pairs), and Black's chair (results-only, $0 path, kill rule written down).
- Dissent recorded: the contrarian's — a ledger visualization dressed in pulses risks theater; and the underwriter's tail risk — one false flare burns the honesty brand, so the differ's guards are load-bearing, not decorative.
- Confidence: medium — the fact that would change it: if the publisher extension cannot ship or `events_recent` proves undeployable, fall back to B (pointer flares only, driven by data already in the feed).
- Changed the pre-run lean? no (lean was A; kill-criterion no-change count: 1).
