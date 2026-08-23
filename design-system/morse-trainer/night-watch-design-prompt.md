# Design prompt: "Night Watch" — the earned operations mode

Paste this to the design agent that produced the Signal Cabin prototypes. Deliverable format as before: an interactive `.dc.html` prototype plus a Project Overview markdown that honestly lists deviations and gaps.

---

You designed the Signal Cabin — an adaptive Morse coach where retention across real elapsed gaps is the unit of progress, letters unlock K M R S A T O I N E under a workload brake, unknown transmissions arrive from six stations (Harbour Light, Ridge Relay, Mill Station, North Buoy, Long Point, Summit Hut), the learner has a persistent station callsign, and every motivational line is derived from recorded evidence. All of that is built and live. Design the endgame that sits on top of it.

**The concept.** Night Watch: an operations mode, locked until mastery. The learner's station is inside occupied territory in a fictional conflict. The stations they have been intercepting all along turn out to be a network that needs them. Play is a dialogue conducted entirely in Morse: an incoming transmission arrives and must be decoded; the learner chooses or composes a short reply and keys it back on the paddle; the exchange continues for three to six turns and resolves. It should feel like being the one person awake at a radio at 3 a.m. — tense because of silence and static, never because of spectacle.

**Hard constraints — violating any of these makes the design unusable to us:**
1. Every message, in both directions, is spellable from exactly these ten letters: K M R S A T O I N E. No other characters, no digits, no punctuation beyond word spaces. Build the entire message corpus under this constraint and include it in the deliverable — this is the hardest part of the design and the most valuable.
2. Calm register, same voice as the Cabin's copy ("Answered once. Confirms after a night, not tonight."). A fictional conflict: no named countries, factions, or eras; no violence on screen; danger is implied through procedure — curfews, windows, silence, a station that stops answering.
3. One surface. Missions play on the existing stage; the only chrome is what the stage already has (status line, marks area, decode line, paddle, answer keys). No map screens, no inventories, no currencies.
4. Evidence rules are law: a replayed decode is "answered, with help"; an interrupted one is not counted; only unaided work advances a mission's quality. Mission outcomes never touch the letter scheduler — a failed mission costs the mission, never the learner's letters.
5. The unlock is earned, not granted: all ten letters held Stable or Instant across real gaps. Design the locked state (one honest line, like "Night Watch opens when every letter is stable") and the unlock moment (a rare card, one paragraph at most).

**What to design (in priority order):**
1. **The dialogue mechanic.** How a turn works: incoming (decode by typing letters), then the reply — when is it a choice among three keyed options, when is it free keying of a given word, how does the paddle's timing quality (the existing dot/dash/gap bands) affect the outcome? What does time pressure look like without a stressful countdown — a closing window? a second, fainter repeat before the station gives up?
2. **The mission arc.** Six to ten missions with a quiet through-line across the network (a station going dark, a route that needs confirming, a final all-stations night). Each mission: its incoming/outgoing script from the ten-letter corpus, its origin station, the failure state, and the one-line debrief. Missions should be replayable after failure only after a real gap — design what the wait communicates.
3. **Degraded copy as the difficulty curve.** Later missions add static, fading, slight timing irregularity in the "other operator's" keying. Design the ladder (what degrades, in what order, by how much) and how the learner is warned in-fiction ("North Buoy is weak tonight").
4. **The debrief.** Honest, evidence-derived, three sentences at most: what was decoded unaided, what needed help, what the sending rhythm was like, what it means for the network.
5. **Completion.** What exists after the last mission — a standing night watch? recurring signals? Design something that respects retention (the mode should still want you back tomorrow) rather than ending.

**Explicitly out of scope:** new letters or characters, scoring systems, leaderboards, any UI outside the stage, and anything that makes the war graphic rather than atmospheric.

Deliver the interactive prototype plus the overview document, including the full ten-letter message corpus, the mission scripts, and an honest "gaps and open questions" section as before.
