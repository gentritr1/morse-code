# Frontend architecture

Morse Trainer is a zero-dependency static web application. It uses native ES modules and modern CSS so it can run from any static host without a build step.

The interface shows exactly one surface: the machine. Everything else — settings, the first-run guide, the letters drawer on handsets — is summoned over it and returns focus when it closes.

## JavaScript boundaries

```text
src/
├── app.js                     Composition root and initial state
├── config.js                  Stable product configuration
├── data/
│   ├── morse.js               Morse domain data and pattern helpers
│   └── words.js               Common words built from the starter pool
├── features/
│   ├── events.js              Append-only attempt log and retention windows
│   ├── guide.js               First-run guide dialog
│   ├── performance-profile.js Pure retention scheduling and recognition
│   ├── placement.js           Pure same-or-different placement trial
│   ├── progress.js            Pure progression rules and the round policy
│   ├── send.js                Paddle, transmission readout, and scoring
│   ├── settings.js            Settings popover / sheet
│   └── trainer.js             Learn and Sprint rounds, the moment cards, the HUD
├── platform/
│   ├── morse-audio.js         Web Audio boundary and Farnsworth timing
│   └── storage.js             Resilient localStorage boundary
└── ui/
    ├── elements.js            Required DOM contract
    ├── letters.js             Letters drawer rendering and sheet state
    └── signals.js             Shared signal rendering and `animateMarks`
```

`src/app.js` is the composition root. It creates one shared context, wires feature controllers, and owns the single top-level render function. Feature modules receive their dependencies instead of importing one another, which keeps the dependency direction explicit and prevents circular imports.

**Progression is a pure module.** `src/features/progress.js` owns the whole learning path — the Koch teaching order, the lane order, the new-letter brake, and `pickRound({ profile, progress, events, history })`, the policy that decides what the next exercise is. It touches no DOM, no timers and no globals, so "the trainer chooses the exercise" is one function that can be reasoned about, changed, or tested on its own. `trainer.js` calls it and renders the result.

**Placement is a pure module too.** `src/features/placement.js` owns the starting-speed measurement: `buildTrials(random)` lays out twelve same-or-different pairs — four at each preset, two same and two different, shuffled — and `placeFrom(log)` turns the answered log into `{ chosen, effOffset, acc, lat, replayed, trials }`. Accuracy picks the fastest character speed the learner could still tell apart; the median time to decide at that speed picks the spacing offset, floored so the effective speed can never fall below `MIN_EFFECTIVE_WPM`. It touches no DOM, no audio and no storage, so the rule that decides where a learner starts is one function that can be read on its own.

The trial itself lives inside the guide dialog (`guide.js`), not on a page of its own: it is one more thing the second step can do, and it plays through the same audio boundary and the same overlap guard as everything else. Its only outputs are `morse-trainer-difficulty`, `progress.effOffset` and `progress.placement`. It never writes to the performance profile, the attempt log, the confusion maps, or any first-listen field — a measurement of hearing is not evidence of practice, and letting it into the scheduler would buy intervals nobody earned. A pair the learner was away for is replayed from the top on return and dropped from the log rather than counted either way.

`pickRound` is **phase-driven**. A session is twenty rounds shaped in five parts — arrive (1–4), repair (5–8), new (9), mix (10–16), use (17–20) — declared once as `SESSION_PHASES` in `src/config.js` and read by both the policy and the rail in the header. The very first session runs on `SEED_SESSION_PHASES` instead: its opening run *is* the arrive phase (five rounds, ending on the transmission it opened with), and repair only needs two rounds to contrast the pair it has just taught, so new material arrives at round 8 and the first sitting is the same twenty rounds as every one after it. Which table a sitting uses is decided once when it starts, because the seed run flips `progress.seeded` halfway through and the rail must not change shape underneath the learner. Inside each part the choice comes from **lanes, then score**. Lanes are checked before anything is scored, so a character the learner has actually forgotten never has to out-argue one that is merely new:

```text
0  relearning after a lapse
1  a review that is genuinely due
2  acquiring
3  fragile (stability <= 1) or caught in a live confusion
4  everything else
```

Within a lane, `score = 0.5 x recall risk + 0.2 x lapse strength + 0.15 x slowness + 0.15 x confusion strength`, and recall risk is a half-life model, `1 − 2^(−elapsed / interval)`. Arrive takes the top of that order one round at a time; repair works the strongest live confusion pair according to *why* it is missed (below), or alternates the top two when there is none; new hands over an earned character; mix draws weighted by score while a coverage floor keeps any character from starving; use spends the alphabet on bursts and words from `src/data/words.js`. When round 9 arrives with nothing to hand over, the phase costs one ordinary round and the rail marks that segment skipped rather than done.

**Same-session repetition cannot buy a long-term interval.** This is the rule the whole scheduler exists to enforce, and it lives in `gradeLetter(metrics, { hit, rt, replayed, hint, interrupted, now, baseline })` in `performance-profile.js`. Each character carries a phase — `acq` (acquiring), `rev` (long-term review) or `rel` (relearning) — beside its stability index, due time, acquisition step, lapse timestamps and clean response times. Acquisition graduates to review only on two qualifying answers at least `ACQ_MIN_GAP` (three minutes) apart, and lands at twenty hours — never deeper. Stability then climbs `STAB_INTERVALS` (20 h, 3 d, 7 d, 14 d, 30 d, 60 d) only when `now >= dueAt` and the answer is clean and not slow; a correct answer before the due date is recorded as practice and changes nothing, and a correct but slow or replayed one is *held back* to a ten-minute follow-up. A miss drops one level, or two if it repeats inside three days, and always enters `rel`. Nothing advances without `qualifies`: correct, unreplayed, unhinted, uninterrupted, and inside `SLOW_FACTOR` of the baseline measured *before* this attempt joins it.

**Skills are kept apart.** `gradeLetter` is reached only by an isolated single-character round. A word or burst is a different skill — reading a character in context — and one wrong position in a five-letter word must never push five characters into relearning, so those rounds write to an additive per-character `profile.context[letter] = { att, elig, ok, indep }` (positions seen, of those not interrupted, of those correct, of those also clean) and to the event log with `ctx: "word"`, and touch no scheduler field at all. A legacy `{ n, ok }` record maps `n` onto both `att` and `elig`, so an accuracy read from it can never divide by a counter that restarted at zero. The whole word's elapsed time is kept in `rtLog.word` when the copy was clean, which is what "slow in a word" is later measured against.

**Answers before the last tone are refused.** The answer window opens exactly when the transmission ends, which is also when `roundStartedAt` is stamped. Until then the answer keys stay where they are at 40 % opacity with `aria-disabled="true"`, and clicks, `A–Z` and the hint are dropped in silence. A pre-emptive tap was otherwise recorded as an exceptionally fast correct answer, which is the one thing a latency baseline must never contain.

**Not every round is evidence.** Two kinds of trial are excluded from every count the scheduler and the brake read, and both are recorded rather than discarded — the character was heard, it just did not prove anything.

- **Interrupted** (window blur, tab hidden, or a response over `RT_CAP`): nothing moves except `exposures` and `lastSeenAt`. No attempt, no stability, no phase, no due time, no `lastOk`, no response time, no lapse. It returns `scored: false` and a 3–6 round retry, so a coffee break brings the character back rather than scoring it as forgetting.
- **Replay-assisted hits**: practice, not retrieval. No scored credit, and `lastOk` is deliberately left alone so the forgetting curve is not flattened by a character the learner could only name on the second listen. A retry lands 4–7 rounds later. A replayed *miss* still counts — failing to name a character you have just heard twice is a fact — but it does not compound into the double stability drop, because the replay rather than the interval is what the evidence is about.

`attempts` and `correct` therefore count scored trials only, and `exposures` counts every round; the drawer reads `exposures` so a character met only through interrupted or replayed rounds never claims to be `Unheard`. Events carry `scored` and, when relevant, `reason: "interrupted"`, and `cleanAccuracy` and `retention` read scored trials only.

`gradeLetter` returns a `retry { min, max }` whenever the character has to come back inside the same sitting — 3–6 rounds after a lapse, 4–7 after an acquisition answer that did not graduate. `scheduleRetry` splices it that far ahead, capped at two per character per session, so the session grows past twenty rounds while the rail keeps showing the phase of the round actually being played.

**Motivation is stated from evidence, never inferred.** Every encouraging line in the product is derived from something that was recorded, and is omitted when the record does not support it. The helpers live beside the data they read and never write to it: `latencyTrend(events, now)` and `survivedNight(events)` in `src/features/events.js`, `dueNow`, `returningSoon`, `whyReturning`, `arrivalLines`, `cabinMemory` and `checkMilestones` in `src/features/progress.js`. `latencyTrend` returns a pace only when both its seven-day windows hold at least eight clean responses, and the sentence that would quote it is dropped when the two medians differ by less than 200 ms — a tenth of a second is measurement noise, not progress. `survivedNight` counts the same way `retention` does: scored attempts only, and only the span between one correct answer and the next correct answer on the same target, so repeating something inside one sitting can never produce it.

`checkMilestones({ profile, progress, now })` returns `{ milestones, earned }`. Four milestones exist — `sevenDay` (a character reaching a seven-day interval), `unaidedWord` (the first whole word decoded with no replay, hint or interruption), `firstInstant` and `allTen` — each earned at most once and stamped into `progress.milestones` as a timestamp. It is called once, at the end of a session; `progress.unaidedWords` is the only other counter it depends on, and the trainer increments that on a clean unaided word round. The session-end passage shows at most one of them, and when it does the card's tag reads `MILESTONE` and the scoreboard streak plays its one-shot pop.

**Two more moments share the stage's card slot.** The slot already held the intro card and the session-end card; it now also holds an **arrival card** and the **incoming transmission**. Neither is a round: nothing is scored, nothing is scheduled, and `cardOpen()` in `trainer.js` is the single predicate that keeps answers, backspace and interruption bookkeeping out of all four.

The arrival card greets a returning learner — `progress.sessions >= 1`, no session in progress, and the last scored attempt at least `ARRIVAL_IDLE_MS` old — with at most two lines from `arrivalLines`: what came due, which characters have survived a night, or the pair that is still blurring. When it names a pair it also passes `history.openWith` into `pickRound`, so the promise that "this round opens with them" is kept rather than asserted. It is shown once per visit behind an in-memory flag; nothing about it is persisted.

**The first session is seeded, not scheduled.** A scheduler with no data has nothing to schedule, so `needsSeeding(progress)` (true while `sessions === 0` and `seeded` is false) puts a fixed run at the front of the very first session. It opens with a transmission the learner cannot read — the **incoming** card, which plays `K M` with Farnsworth spacing behind uniform placeholder marks — then the intro card for each starting character, then the contrast run `K M M K`, then the *same* transmission handed back as an ordinary Burst round, and finally `M K` as Repair. The burst carries `firstRead`, which is the one round in the product with its own success string (`You read it. Two minutes ago that was noise.`); to the scheduler it is an ordinary burst that writes `context` and nothing else, which is exactly why reading it counts. Those intro cards teach without unlocking — both characters were already in play. `progress.seeded` is written as soon as the run has been handed out, so a reload does not start the introduction again, and `markSeededFromHistory` marks any profile that already carries evidence as seeded so a returning learner is never re-introduced to the characters they have been practising.

**New material is gated on workload, not on a count.** `readyForNew(profile, progress, now, events)` pauses when overdue reviews reach `max(4, ceil(0.3 x unlocked))`, when more than two characters are acquiring or relearning, or when clean accuracy over the last thirty attempts drops below 0.85; it resumes only at forty percent of the pause threshold with accuracy at 0.88 or better. The hysteresis is the point — one boundary would flicker on and off. `progress.newPaused` is the single field it writes, and the trainer persists the record where the decision is made. The intro card appears in the **new** phase when the brake allows, and immediately if the brake releases between rounds.

**Confusions decay, can be cured, and carry a cause.** `profile.confusions["A>N"]` is a list of timestamps rather than a count, and `profile.pairWins["A>N"]` records a clean answer on the pair's target while that pair is the one being repaired. `confStrength = max(0, decayed(conf, 7 d) − 0.6 x decayed(wins, 7 d))`, so a confusion the learner has fixed falls out of the repair phase instead of steering it forever. Both writes take the same evidence test as the scheduler: nothing is recorded for an interrupted trial, and only a clean hit counts as a cure.

`profile.confCause["A>N"] = { discrimination, hesitation, uncertain }` records *why* each scored miss happened, decided from the same meta the scheduler used — `uncertain` when the answer was replayed or hinted, `hesitation` when an unaided answer arrived past `SLOW_FACTOR` of the baseline, `discrimination` otherwise. Repair reads the largest of the three, because drilling the pair is the right cure for only one of them: `discrimination` alternates A B A B (`Listening · A and N blur together`), `hesitation` serves the target alone since the pair is not the problem (`Listening · you know A, but slowly`), and `uncertain` shows the intro card for the target once as a refresher before drilling (`Listening · A slipped, even with a replay`). A profile with no causes recorded falls back to `Listening · you mix this with N`.

**Leaving a live round pauses it.** Opening settings, the letters drawer or the guide, or the page becoming hidden, stops the audio, cancels the pending auto-advance and the mark animation, and puts `Paused` on the status line. What coming back owes the learner depends on whether they had already heard the whole signal: if they had, the answer window simply reopens and the trial is marked interrupted (`Listening · not counted — you stepped away`), since anything they answer now is a memory of a signal that was on screen while they were elsewhere; if the pause cut the transmission short, the signal plays again from the top, is not charged as a replay, and the round is scored normally. An already-answered round advances after 400 ms. `MorseAudio.stop()` silences every oscillator it has scheduled, and `playPattern`/`playText` call it before scheduling, so two signals can never sound at once; a replay asked for while one is still sounding is dropped rather than layered, and does not spend the round's first listen.

**The station has a name.** `progress.callsign` is two letters and three digits, minted by `genCallsign()` on the first read that finds none and persisted by the write `app.js` performs at startup. It replaces the invented suffix in every machine's subtitle — `AMBER TERMINAL · KX-412`, `BROADCAST TELETEXT · KX-412`, `POCKET TRAINER · KX-412` — and appears nowhere else. Reset regenerates it.

**The drawer remembers one thing.** `cabinMemory(profile, progress, events)` returns the most recent of four dated facts — the first signal read unaided, the first unaided word, the first seven-day interval, the first instant character — and the Letters footer prints it as one line (`22 Aug · first word read unaided`). Nothing is authored: if it appears, it happened, and it carries the date it happened. It is hidden until there is something to say.

**Retention is counted, not inferred.** `morse-trainer-events-v1` is an append-only attempt log capped at `EVENT_CAP` (4000): `{ ts, target, correct, ctx, rt, replay, hint, interrupted }`. Counters can only describe how a character is doing *now*; whether it survived a night is a claim about a gap, and `retention(events, minH, maxH)` in `src/features/events.js` counts an opportunity whenever a clean attempt lands `minH..maxH` hours after a previous correct answer on the same target. `r24` and `r7` reach the learner only as words in the end-of-session passage (`3 of 4 signals survived a night.`), never as a percentage and never on the stage. The same log backs the accuracy term in the new-letter brake.

**Spacing adapts; characters never do.** `progress.effOffset` moves the preset's *effective* WPM only: two consecutive missed group rounds widen the gaps by 2 wpm, five consecutive clean ones walk the offset back toward zero, and the floor keeps the effective speed at or above `MIN_EFFECTIVE_WPM`. `charWpm` is untouched, Settings keeps showing the preset the learner chose, and the end-of-session passage says `Gaps widened a little.` when it moved.

**Mastery is per character and first-listen.** An answer only counts toward mastery when the round was answered with no replay and no hint, and the response is measured from the END of the transmission — stamping it at playback start would make every long character look slow. `letterBaseline` is the character's own median once it has four clean samples, otherwise the median of the last forty pooled clean responses, otherwise 2600 ms. The drawer labels (`Unheard`, `New`, `Settling`, `Steady`, `Stable`, `Instant`) are read off phase and stability, and `instantRate`, the internal north-star share, is never rendered as a number.

**Retention drives brightness.** `retentionOf(metrics, now)` is `1 − recallRisk`, and a drawer row burns at `0.55 + 0.45 x retention`; `retentionState` maps the schedule onto the three words the rest of the product speaks — `fresh` while a character is acquiring or relearning, `stable` in review, `fading` once its review is overdue, which is also the only state that shows the dim dot. There is no legend: brighter simply means it will last.

**Farnsworth lives in the audio boundary.** `src/platform/morse-audio.js` exports the pure `speedTiming(speed)`, `scheduleText(text, speed)` and `scheduleDurationMs(text, speed)` beside the `MorseAudio` class. Characters are always keyed at the preset's character speed (`unit = 1.2 / charWpm`); only the gaps stretch, using the ARRL split of PARIS into 31 element units and 19 gap units. Because the schedule is pure, the same array drives the oscillator, the on-screen marks and a `node` unit test, so what is heard and what is seen cannot drift apart.

`animateMarks(containers, schedule)` in `src/ui/signals.js` plays that schedule across the mark elements and returns a cancel function. The trainer and the guide's first signal both drive it, so the timing loop exists once. `renderSignal` wraps each character's marks in one `.mark-group`, which is what makes a word wrap between characters instead of splitting a letter.

**Nothing on screen encodes the pattern before the answer.** `renderSignal(container, text, textMode, revealed)` writes `data-revealed` on the container and CSS collapses every mark to the same `--mark-h` square while it is `false`; the mark elements themselves never change, so `animateMarks` keeps its element references and there is no DOM churn. The trainer sets `revealed` from `state.revealMarks || state.playing`, and `state.playing` is owned by `playCurrentSignal`, which flips it on, renders, animates, and schedules one timer for `PLAYBACK_LEAD_MS + duration` to flip it back. Dim placeholders of the *right shape* were the previous version of this rule, and they were readable: the geometry, not the class name, is what has to be verified.

**Send captures a timeline, not a verdict.** Each press is stored as `{ downAt, upAt, durationMs, gapMs }` with no cap at the target's length. `classify` decides the symbols after the fact from the durations themselves — a clear long/short split classifies itself, and only a transmission that never varied falls back to the preset's threshold — and `fitUnit` then recovers the unit the learner was actually sending at by least squares against the ideal 1/3 weights. Fitting the unit first is what separates *tempo* (the whole transmission running fast or slow) from *rhythm* (the proportions inside it being wrong), so the You/Ideal trace is drawn against the fitted unit rather than the machine's. `sendBand(ratio, gapUnits, cv)` names a fist — clean, developing, readable, rough — from the dash/dot ratio, the gap in fitted units and the dot coefficient of variation, aggregated over the last eight clean sends in `profile.sendLog`. A fist is an average, so one transmission never earns a word.

The performance profile is separated from its view because it is domain logic: it can later be tested, moved to a worker, or synced to an account without rewriting Send or the trainer. It quietly feeds everything the learner never sees: which exercise comes next, when the next character opens, the recognition bars in the letters drawer, and the one sentence at the end of a session.

## CSS boundaries

```text
styles/
├── foundation.css      Tokens, reset, app bar, and the settings popover/sheet
├── guide.css           First-run guide dialog
├── trainer.css         Machine, letters drawer, stage, intro card, and Send
├── themes.css          Theme tokens plus Terminal, Teletext, and Pocket variants
├── responsive.css      Viewport and orientation adaptations
└── accessibility.css   Reduced motion and forced-colors support
```

`styles/themes.css` is the only place a machine palette is declared. `body[data-theme="…"]` defines `--theme-bg`, `--theme-surface`, `--theme-surface-strong`, `--theme-text`, `--theme-muted`, `--theme-faint`, `--theme-accent`, `--theme-on-accent`, `--theme-font`, and `--theme-radius`; every themed surface consumes those tokens, so one attribute switches the whole machine. `[data-theme-tokens="…"]` applies one palette locally, which lets the guide and the settings panel preview all three machines at once.

Three state attributes carry the learning model into CSS: `.machine[data-mode]` selects the stage, `.machine[data-reveal]` decides whether the marks are dim or lit, and `[data-revealed]` on a signal container decides whether they have their real geometry at all. Learning by ear is a rendering rule, not a copy rule.

The root `styles.css` declares cascade order. Every stylesheet wraps its rules in a named `@layer`, and the HTML loads them in parallel. This gives the modular files deterministic precedence without an `@import` waterfall or specificity escalation.

The interface intentionally uses native platform features where they improve the product:

- ES modules, private class fields, optional chaining, and `Object.hasOwn`
- the Popover API for settings, and `<dialog>` for the first-run guide
- cascade layers, `oklch()`, and `color-mix()` for predictable theme styling
- Pointer Events and Web Audio for the Morse paddle
- `prefers-reduced-motion` and `forced-colors` adaptations

## Extending the product

Add new Morse data in `src/data/morse.js` and new practice words in `src/data/words.js`. Change the learning path in `src/features/progress.js` — never in the view; a new kind of round is a new branch in `pickRound` plus a render case, not a new mode. Add a new practice mode in `src/features/trainer.js` when it shares the existing round lifecycle, or beside `send.js` when it has its own input model, then register the controller in `src/app.js`.

Keep platform access behind `src/platform/`. New persistence, account sync, microphone input, or analytics should not be called directly from rendering code.

Prefer a new file when a capability has its own state lifecycle, platform dependency, or testing boundary. Keep code together when it changes for the same reason; file size alone is not an architecture rule.
