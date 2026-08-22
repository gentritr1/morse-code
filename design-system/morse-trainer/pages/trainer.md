# Trainer page override

This page is a focused product surface, not a marketing landing page. These rules override the generated master wherever they conflict.

## Experience model

- One learning engine powers three switchable machines: Terminal, Teletext, and Pocket Trainer.
- **One surface on screen: the machine.** Nothing else competes with it. Settings, the first-run guide, and the letters drawer on handsets are summoned over it and return focus when they close.
- Learn, Sprint, and Send are the only modes. Learn is the default and carries the learning path; Sprint is a 30-second checkpoint that stays locked until five characters are open; Send is the paddle. The signal remains the visual center of gravity.
- **The trainer chooses the exercise, never the learner.** Learn is a guided session of twenty rounds, plus whatever slipped and had to be spliced back in. Each round comes from one pure policy reading the learner's own data. There is no exercise picker and no difficulty dial beyond the three speed presets.
- **The session has a visible shape.** Five parts in order — arrive, repair, new, mix, use — shown as a five-segment rail under the Letters stat with the active part named beside it in small mono capitals. Only the active part is named; nothing counts rounds, and a part the session did not need shows as skipped rather than done. The rail is structure made visible, not a progress metric.
- **Say why a character is back, once, and only when it is true.** On arrive and repair rounds, and on a round that was spliced back in after a slip, the status line carries one clause after `Listening`: `slipped earlier`, `back from yesterday`, `slow last time`, or `you mix this with N`. Never on a mix or use round, never two reasons, never a percentage. A splice that follows a *correct* answer during acquisition carries no clause: it is scheduling, not a verdict.
- The path is Koch-derived and the next character is gated on workload, not on a count: new material pauses while overdue reviews pile up, while more than two characters are still settling, or while clean accuracy slips, and resumes with hysteresis rather than flickering on one boundary. A new character arrives as a one-off intro card, and the end of a session as one calm passage of at most three sentences — the only two moments the practice stage is allowed to be replaced.
- Speed is Farnsworth: characters are always sent at 18–25 wpm and only the gaps change. Never slow a character down; a countable dash teaches the wrong skill.
- **Learn by ear, and mean it: before the answer, nothing on screen encodes the pattern.** While the learner is deciding — before playback and after it ends — every mark is the same dim square, one per mark, grouped per character. The count may show; the shape may not. The real marks exist only for the duration of playback, lit on the same schedule the audio uses, and return to squares in a 150 ms crossfade with the container height fixed. They are revealed for good after an answer or a hint. Placeholders that keep the real dot and dash widths are a leak, not a compromise. Sprint follows the same rule; the intro card does not, because it is teaching.
- Mastery is measured on first listens only, timed from the END of the signal. Replays and hints are honest, useful and free — they simply do not count. **A round that was not evidence must say so**: a replayed hit reads `Correct · K · replayed, so practice`, a round the learner left the page during reads `K · not counted — you left the page`, and a correct answer that was too slow to earn a longer gap reads `Correct · K · slowly — it returns sooner`. Silence about an uncounted round is what makes a schedule feel arbitrary.
- **The first session introduces before it tests.** Both starting characters get an intro card, then a `K M M K` contrast run, before the policy takes over. A scheduler with no data has nothing to schedule.
- **Stability requires a real gap.** Same-session repetition cannot buy a long-term interval. A character graduates out of acquisition only on two clean answers at least three minutes apart, lands at twenty hours, and climbs the ladder (20 h → 3 d → 7 d → 14 d → 30 d → 60 d) only when a review that was genuinely due comes back clean and unhurried. A correct answer before the due date is practice and changes nothing.
- **Letters drawer labels**, one word per row, from the schedule rather than from a score: `Locked` (not yet in play) · `Unheard` (never answered) · `New` (acquiring, no qualifying answer yet) · `Settling` (acquiring or relearning) · `Steady` (in review at the first interval) · `Stable` (in review, deeper) · `Instant` (in review, deeper, and answered at or under the learner's own pace). Brightness is retention, and it is continuous: a row burns at `0.55 + 0.45 x retention`, where retention is `1 − recall risk` against the interval the character was last scheduled for. A row whose review is overdue also carries the dim dot. One caption: `Brighter signals will last longer.` No legend, no key, no dates.
- The drawer's second line names the brake in plain words: `Next letter · when K settles`, `New letters paused · 3 need review`, or `Ready for the next letter`.
- Machine, speed, guide and reset live in a settings popover (bottom sheet at ≤ 640 px), never in the app bar. The app bar stays one row at every width: identity, mode, settings.
- On desktop the letters drawer is a column beside the stage; below 900 px the same list opens as a bottom sheet from the machine footer.
- Theme changes never reset the active target, score, streak, timer, unlocked characters, or selected speed.
- First use is a skippable three-step modal dialog: hear a real signal, pick a rhythm, then choose a machine. The rhythm step is calibration, not a personality test: three cards, each auditionable with **Hear it**, playing the same two characters so the learner keeps the preset that arrives as sound rather than as countable marks. Completion is remembered, **Show guide** in settings reopens it, and reopening shows the preset they are on.
- Sending is free-form and judged against the learner's own unit: the paddle never stops at the target's length, symbols are classified from the durations themselves, and the unit is fitted by least squares so tempo and rhythm come apart. Feedback is one sentence plus a three-row You/Ideal trace (dot, dash, gap) no taller than 56 px, hidden until Check, with the discrepancy in words — and one line naming the fist across the last few clean sends (`Rhythm · developing`, or `Rhythm · 3 of 5 clean sends` while the sample is thin). No percentage. It is the only comparison bar in the product.
- Spacing adapts, characters never do. Two consecutive missed group rounds widen the Farnsworth gaps; five consecutive clean ones walk them back toward the chosen preset. Settings always shows the preset the learner picked.

## Visual direction

- Global shell: quiet neutral near-black with a restrained teal focus/selection color derived from the project seed `oklch(0.72 0.10 188)`.
- Terminal: amber phosphor on brown-black, monospaced type, square controls, sparse glow only on the active signal.
- Teletext: deep broadcast blue, VT323 pixel type, cyan/yellow/magenta/green system bars, block-shaped Morse marks.
- Pocket Trainer: graphite plastic, grey-green recessed LCD, rubber keys, silkscreen labels, restrained red play control.
- Use theme color as structure and state, never as decoration detached from function.
- No KPI tiles, table headings, legends, or analytics copy anywhere. Numbers belong to the HUD scoreboard and the score line; progress reads as a map of letters, not a report. Session position is the five-segment rail under the Letters stat with one word beside it, never "round 7 of 20". The internal instant-recognition rate is never shown as a number — it only decides which sentence the learner reads.
- Nobody has to learn the vocabulary to get the benefit: Koch, Farnsworth and adaptive weighting are never named in the interface.

## Type

- Shell and Pocket Trainer: Archivo with a system sans fallback.
- Terminal and data: DM Mono with Courier New fallback.
- Teletext: VT323 with DM Mono fallback.
- Minimum functional copy size is 14px. Use tabular numerals for timers and scores.

## Components and motion

- Minimum control target: 44×44px, with at least 8px between targets.
- Branded overlays use the Popover API or `<dialog>` with full keyboard support; do not fall back to unstyled browser controls.
- One border or one compact shadow per surface; do not combine borders with wide decorative shadows.
- Radii: 4px for machine controls, 8–12px for the outer machine and shell controls, 16px for the top of a sheet, pills only for segmented selectors.
- The practice view is one vertically centred group — status, marks, decode, actions, keys — with `var(--space-5)` between its parts and the answer keys no more than 2 rem below the actions. No dead band between the controls and the keys at any width.
- Interaction transitions use 160–220ms ease-out. Settings scales from its trigger corner; sheets slide from the bottom on `cubic-bezier(0.32, 0.72, 0, 1)`; the practice stage crossfades on a mode switch; practice content never waits for an entrance animation.
- Feedback is a moment, not a stat update: the streak pops, the stage tints, a beaten sprint best earns a NEW BEST tag.
- Reduced-motion mode removes transforms and the terminal cursor blink.

## Accessibility

- WCAG 2.2 AA contrast, strong visible focus, logical tab order, keyboard shortcuts, and an aria-live result announcement.
- Never rely on theme color alone for correct/incorrect status; always pair it with explicit text.
- Every signal is both audible and visible. Audio failure must not block the exercise — when audio is unavailable the pattern is revealed instead.
- Locked characters are stated, not merely dimmed: pressing one answers with "Not unlocked yet", and pressing a locked Sprint says when it opens instead of doing nothing.
- Group rounds are typed left to right with `Backspace` available and check themselves at full length; every slot is visible as an underscore before it is filled.
