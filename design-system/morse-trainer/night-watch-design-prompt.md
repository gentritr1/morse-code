# Design prompt v2: "Night Watch" — the earned night-operator mode

Paste this to the design agent that produced the Signal Cabin prototypes. Deliverable format as before: an interactive `.dc.html` prototype plus a Project Overview markdown that honestly lists deviations and gaps. This supersedes the earlier Night Watch prompt — the concept moved from "occupied territory" to an unnamed emergency, and the ten-letter rule now applies to one layer, not both.

---

You designed the Signal Cabin — an adaptive Morse coach where retention across real elapsed gaps is the unit of progress, letters unlock K M R S A T O I N E under a workload brake, unknown transmissions arrive from six stations (Harbour Light, Ridge Relay, Mill Station, North Buoy, Long Point, Summit Hut), the learner has a persistent station callsign, and every motivational line is derived from recorded evidence. All of that is built and live. Design the endgame that sits on top of it.

**The concept.** Night Watch: an operations mode, locked until mastery. The six stations the learner has been intercepting all along turn out to be people — and something is happening in the world outside. **The emergency is real but never named.** There are no enemies, no factions, no violence, no war; the danger lives entirely in procedure and silence — transmission windows that close, a curfew on the airwaves, weather taking a relay down, a station that stops answering, a night when every station calls at once. The tone references are Metal Gear's radio conversations (the intimacy and tension, never the genre), Firewatch's lonely communication, Papers, Please's weight of small procedural decisions, The Martian's problem-solving through connection. The fantasy in one line: *at 3 a.m., six voices know your callsign, and your radio is the only thing still connecting them.* Morse is not a game mechanic here — it is the human skill the learner spent weeks earning, finally being needed.

**The two layers.** This is the central structural decision:

- **Layer 1 — the transmission (Morse).** Every signal actually keyed or decoded, in both directions, is spellable from exactly these ten letters: K M R S A T O I N E. No other characters, no digits, no punctuation beyond word spaces. Build the entire transmission corpus under this constraint and include it in the deliverable — it is still the hardest and most valuable part of the design.
- **Layer 2 — the conversation (plain text).** Around each transmission, the operators speak in short plain-text lines — this is where they become people. An old keeper at Harbour Light: "You always answer late." / "Good. Slow hands survive long nights." Layer 2 carries personality, memory, and stakes; it is not bound by the ten letters.

**The guard between the layers (hard rule):** the payload always crosses in Morse. The plain-text layer may react to what the learner decoded or keyed, but it must never contain, paraphrase, or foreshadow the content of a transmission before it has been decoded — if the text gives the answer away, the learner stops listening and the mode is dead. Layer 2 stays terse (one or two short lines per beat) and speaks in the Cabin's calm register.

**Hard constraints — violating any of these makes the design unusable to us:**
1. Layer 1 is ten letters only, both directions, corpus delivered in full.
2. Layer 2 is terse and calm, same voice as the Cabin's copy ("Answered once. Confirms after a night, not tonight."). The emergency is never named: no countries, factions, eras, or violence on screen — dread through procedure only.
3. One surface. Everything plays on the existing stage; the only chrome is what the stage already has (status line, marks area, decode line, paddle, answer keys) plus the conversation lines. No map screens, no inventories, no currencies.
4. Evidence rules are law: a replayed decode is "answered, with help"; an interrupted one is not counted; and — new, important — **a letter filled in from context rather than heard (Watch 4's gap-filling) is also "with help"** and never reaches the letter scheduler as unaided evidence. Mission outcomes never touch the letter scheduler — a failed night costs the night, never the learner's letters.
5. The unlock is earned, not granted: all ten letters held Stable or Instant across real gaps. Design the locked state (one honest line, like "Night Watch opens when every letter is stable") and the unlock moment (a rare card, one paragraph at most).
6. No numeric social state. Trust, reputation, and standing are never shown as numbers, meters, or scores. The network remembers in words only (see below).

**What to design (in priority order):**

1. **The dialogue turn.** How one beat works: incoming transmission (decode by typing letters) → a Layer-2 reaction → the reply, which is either a choice among two or three keyed options or free keying of a given word — when is it which, and how does the paddle's timing quality (the existing dot/dash/gap bands) color the outcome? What does time pressure look like without a stressful countdown — a closing window? one fainter repeat before the station gives up?

2. **The four Watches.** Not difficulty labels — radio conditions:
   - **Watch 1 — Clear Channel.** Clean signals, patient operators, repeats allowed, replies chosen from options. Goal: confidence that the skill transfers.
   - **Watch 2 — Fading Signal.** Elements drop out, pauses stretch, stations are weaker. The learner starts completing words from partial copy — and the design marks those letters as helped, honestly.
   - **Watch 3 — Deep Night.** Faster, terser operators; fewer repeats; replies increasingly free-keyed; emotional pressure through what the conversation says, not through timers.
   - **Watch 4 — Blackout.** The expert tier is *not* faster Morse. It is incomplete copy plus context: a gap in a signal ("MEET AT ____") that earlier conversations let you fill. The challenge becomes intelligence and memory, not speed. Design the ladder precisely: what degrades in each Watch, in what order, by how much, and how the learner is warned in-fiction ("North Buoy is weak tonight").

3. **The operators.** Six recurring people, one per existing station. Give each a one-paragraph voice sketch and — the mechanic we care most about — **a fist**: a consistent, recognizable keying personality (the old keeper slow and deliberate, the young relay fast and uneven, one of them rushing their dashes). Specify each fist as deterministic timing tendencies so an implementer can reproduce it. Experienced operators recognize each other by fist; by Watch 3 the learner should too, and at least one moment should quietly depend on it.

4. **Trust, remembered in words.** The network remembers what the evidence records. Answer a station reliably and one night it says "I knew you would answer." Miss it and later: "I was not sure you were still there." Design the memory lines per operator and the honest conditions that trigger them — every line must be derivable from recorded events, never from a hidden meter.

5. **The mission arc.** Six to ten nights with a quiet through-line across the network (a station going dark, a route that needs confirming, a final all-stations night). Each night: its Layer-1 script from the ten-letter corpus, its Layer-2 conversation lines, its origin station, the failure state, and the one-line debrief. Nights are replayable after failure only after a real gap — design what the wait communicates.

6. **Radio memories — in the machine's own language.** After a night resolves, a single memory card may appear: one image and one line ("Summit Hut answered after eleven silent hours."). The image is **rendered by the machine itself, not illustrated**: ASCII line-art on the terminal, teletext mosaic blocks on the teletext set, a small LCD pictogram on the pocket unit. No external artwork, no image files. For each memory card, specify the line and describe the scene in each machine's idiom.

7. **The debrief.** Honest, evidence-derived, three sentences at most: what was decoded unaided, what needed help (replays and context-fills alike), what the sending rhythm was like, what it means for the network.

8. **Open Channel — after the last night.** The mode must not end. Once the arc resolves, one short transmission arrives per day — a weather report, a lost message, a personal note, an old recording — thirty seconds of listening, from the ten-letter corpus, framed by a line or two of Layer 2. Design the shape of this corpus (or the rules for generating it) so "who is calling tonight?" stays alive indefinitely.

**Explicitly out of scope:** new letters or characters in Layer 1, scoring systems or visible numbers of any kind, leaderboards, external image assets, any UI outside the stage, named conflicts, and anything that makes the emergency graphic rather than ambient.

Deliver the interactive prototype plus the overview document, including the full ten-letter transmission corpus, the night scripts (both layers), the six operator voice sketches with fist specifications, the memory-card set, and an honest "gaps and open questions" section as before.
