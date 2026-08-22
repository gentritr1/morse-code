import {
  INSTANT_MS,
  KOCH_ORDER,
  RT_CAP,
  SESSION_PHASES,
  SESSION_ROUNDS,
  SPEEDS,
  SPRINT_SECONDS,
  SPRINT_UNLOCK_AT,
  STORAGE_KEYS,
  THEMES,
  VALID_MODES,
} from "../config.js";
import { MORSE, NOTES, spokenPattern, visiblePattern } from "../data/morse.js";
import { scheduleDurationMs, scheduleText } from "../platform/morse-audio.js";
import { animateMarks, buildAnswerGrid, PLAYBACK_LEAD_MS, renderSignal } from "../ui/signals.js";
import { gradeLetter, letterBaseline, notePairWin, recordHint, recordReplay } from "./performance-profile.js";
import {
  SEED_QUEUE,
  effectiveWpmFor,
  isComplete,
  needsSeeding,
  phaseFor,
  pickRound,
  readyForNew,
  scheduleRetry,
  sessionSentence,
  unlockLetter,
  unlockedLetters,
  updateSpacing,
  weightedLetter,
  writeProgress,
} from "./progress.js";

const MODE_LABELS = Object.freeze({ learn: "LEARN", sprint: "SPRINT", send: "SEND" });

const KEYBOARD_HELP = Object.freeze({
  learn: "Space · replay   A–Z · answer   Enter · hint",
  sprint: "Space · replay   A–Z · answer   Enter · start",
  send: "Tap · dot   Hold · dash   Space · paddle",
});

export function createTrainerController(context) {
  const { state, elements, storage, audio, announce } = context;
  let sprintTimer = null;
  let nextRoundTimer = null;
  let playbackTimer = null;
  let cancelSignalAnimation = null;
  let renderedAnswer = null;
  let renderedStreak = 0;

  function pool() {
    return unlockedLetters(state.progress);
  }

  function preset() {
    return SPEEDS[state.difficulty] ?? SPEEDS.steady;
  }

  /**
   * The preset the learner picked, with the adaptive spacing offset applied.
   * Only the Farnsworth gaps move: `charWpm` is untouched, so a character never
   * arrives more slowly than the machine promised.
   */
  function currentSpeed() {
    const chosen = preset();
    const effectiveWpm = effectiveWpmFor(chosen, state.progress);
    return effectiveWpm === chosen.effectiveWpm ? chosen : { ...chosen, effectiveWpm };
  }

  /** How long this session is: twenty rounds plus whatever slipped back in. */
  function sessionLength() {
    return SESSION_ROUNDS + state.sessionExtras;
  }

  /** The round the rail is on — splices carry the phase they were played in. */
  function baseRound() {
    return Math.max(1, state.sessionAnswered + 1 - state.sessionExtras);
  }

  function currentText() {
    return state.introLetter ?? state.target;
  }

  function sprintUnlocked() {
    return state.progress.unlocked >= SPRINT_UNLOCK_AT;
  }

  function mainActionLabel() {
    if (state.mode === "sprint") return state.running ? "Restart sprint" : "Start sprint";
    return state.revealed ? "Next signal" : "Show hint";
  }

  // Restart a one-shot keyframe by clearing the attribute and forcing a reflow.
  function playOnce(element, attribute) {
    delete element.dataset[attribute];
    void element.offsetWidth;
    element.dataset[attribute] = "true";
  }

  /**
   * The decode line always shows one slot per character: typed letters first,
   * underscores for what is still missing. A fresh element per change lets the
   * @starting-style pop replay.
   */
  function renderTypedAnswer() {
    const length = Math.max(1, currentText().length);
    const slots = [];
    for (let index = 0; index < length; index += 1) {
      slots.push(state.typed[index] ?? "_");
    }
    const value = slots.join("");
    if (value === renderedAnswer) return;
    // Only the character that just landed pops; the ones already on screen stay put.
    const newest = renderedAnswer !== null && state.typed.length > renderedAnswer.replace(/_/g, "").length
      ? state.typed.length - 1
      : -1;
    renderedAnswer = value;

    elements.typedAnswer.replaceChildren(
      ...slots.map((character, index) => {
        const slot = document.createElement("span");
        slot.className = character === "_" ? "typed-slot empty" : "typed-slot";
        if (index === newest) slot.classList.add("typed-value");
        slot.textContent = character;
        return slot;
      }),
    );
  }

  function renderIntro() {
    const letter = state.introLetter;
    if (!letter) return;
    elements.introLetter.textContent = letter;
    elements.introSpoken.textContent = spokenPattern(MORSE[letter]).replaceAll(" ", "-");
    elements.introNote.textContent = NOTES[letter];
    // The intro card is teaching, not testing: it always shows the real marks.
    renderSignal(elements.introSignal, letter, false, true);
  }

  /**
   * The session rail: five segments, one label, and only the phase the learner
   * is in. It is structure made visible, not a progress metric — no numbers.
   */
  function renderRail(isLearn) {
    elements.sessionRail.hidden = !isLearn;
    elements.sessionPhase.hidden = !isLearn;
    if (!isLearn) return;

    const active = phaseFor(Math.min(SESSION_ROUNDS, baseRound()));
    elements.sessionPhase.textContent = active.label;
    for (const segment of elements.sessionRail.children) {
      const phase = SESSION_PHASES.find((entry) => entry.id === segment.dataset.phase);
      if (!phase) continue;
      segment.dataset.state = state.skippedPhases.includes(phase.id)
        ? "skipped"
        : phase.id === active.id
          ? "active"
          : phase.through < active.through
            ? "done"
            : "upcoming";
    }
  }

  function render() {
    const isLearn = state.mode === "learn";
    const isSprint = state.mode === "sprint";
    const isSend = state.mode === "send";
    const showIntro = Boolean(state.introLetter);
    const showSession = !showIntro && isLearn && state.sessionDone;
    const showCard = showIntro || showSession;
    const accuracy = state.total ? `${Math.round((state.correct / state.total) * 100)}%` : "—";
    const remaining = Math.max(0, state.timeLeft);

    elements.machine.dataset.mode = state.mode;
    elements.machine.dataset.feedback = state.feedback;
    // Learn and Sprint both hide the shape of the signal while the learner
    // decides: the ear leads, and Sprint is a checkpoint on the same skill.
    elements.machine.dataset.reveal = !isSend && !state.revealMarks ? "hidden" : "shown";
    elements.machineTitle.textContent = THEMES[state.theme].title;
    elements.machineSubtitle.textContent = THEMES[state.theme].subtitle;
    document.body.dataset.theme = state.theme;

    for (const button of elements.modeButtons) {
      const locked = button.dataset.mode === "sprint" && !sprintUnlocked();
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
      button.setAttribute("aria-disabled", String(locked));
    }

    elements.primaryStatLabel.textContent = isLearn ? "Letters" : "Speed";
    elements.primaryStat.textContent = isLearn
      ? `${state.progress.unlocked} / ${KOCH_ORDER.length}`
      : `${currentSpeed().charWpm} WPM`;
    renderRail(isLearn);
    elements.accuracyStat.textContent = accuracy;
    elements.streakStat.textContent = String(state.streak);
    if (state.streak > renderedStreak) playOnce(elements.streakStat, "pop");
    renderedStreak = state.streak;

    elements.footerMode.textContent = MODE_LABELS[state.mode];
    elements.keyboardHelp.textContent = KEYBOARD_HELP[state.mode];
    elements.footerResult.textContent = `${state.correct} OK`;

    elements.introCard.hidden = !showIntro;
    elements.sessionCard.hidden = !showSession;
    elements.practiceView.hidden = showCard || isSend;
    elements.sendView.hidden = showCard || !isSend;
    elements.answerDeck.hidden = showCard || isSend;
    elements.sprintPanel.hidden = !isSprint;
    renderIntro();
    elements.sessionSentence.textContent = state.sessionSentence;

    elements.statusLine.textContent = state.status;
    if (state.sprintBeatBest) {
      elements.statusLine.dataset.best = "true";
      const tag = document.createElement("b");
      tag.className = "best-tag";
      tag.textContent = "NEW BEST";
      elements.statusLine.append(tag);
    } else {
      delete elements.statusLine.dataset.best;
    }

    renderTypedAnswer();
    const group = String(state.target.length > 1);
    elements.signalText.dataset.group = group;
    elements.signalBars.dataset.group = group;
    // Real marks exist only while they are sounding or once the round is over.
    const revealed = state.revealMarks || state.playing;
    renderSignal(elements.signalText, state.target, true, revealed);
    renderSignal(elements.signalBars, state.target, false, revealed);

    elements.clock.textContent = `0:${String(Math.ceil(remaining)).padStart(2, "0")}`;
    elements.sprintScore.textContent = `${state.sprintScore} ${state.sprintScore === 1 ? "point" : "points"}`;
    elements.timeBar.style.transform = `scaleX(${remaining / SPRINT_SECONDS})`;
    elements.timeTrack.setAttribute("aria-valuenow", String(Math.round(remaining)));

    elements.mainAction.textContent = mainActionLabel();
    buildAnswerGrid(elements.answerGrid, pool(), answer);
    const answersEnabled = !state.locked && (!isSprint || state.running);
    const settled = state.lastOutcome !== null;
    for (const button of elements.answerGrid.children) {
      button.disabled = !answersEnabled;
      button.classList.toggle("was-correct", settled && state.correctKeys.includes(button.dataset.letter));
      button.classList.toggle("was-incorrect", settled && state.wrongKeys.includes(button.dataset.letter));
    }
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("theme", state.theme);
    url.searchParams.set("mode", state.mode);
    window.history.replaceState(null, "", url);
  }

  function setTheme(theme) {
    if (!Object.hasOwn(THEMES, theme) || theme === state.theme) return;
    clearSignalAnimation();
    state.theme = theme;
    state.onboardingTheme = theme;
    storage.set(STORAGE_KEYS.theme, theme);
    context.render();
    syncUrl();
    announce(`${THEMES[theme].label} selected. Your session is unchanged.`);
  }

  function setMode(mode) {
    if (!VALID_MODES.includes(mode)) return;
    if (mode === "sprint" && !sprintUnlocked()) {
      state.status = `Sprint unlocks at ${SPRINT_UNLOCK_AT} letters`;
      context.render();
      announce(`Sprint unlocks at ${SPRINT_UNLOCK_AT} letters.`);
      return;
    }
    if (mode === state.mode) return;

    clearPendingRound();
    stopSprint();
    if (state.mode === "send") context.send.deactivate();
    state.mode = mode;
    state.introLetter = null;
    state.sessionDone = false;
    state.typed = "";
    state.feedback = "neutral";
    state.revealed = false;
    state.revealMarks = false;
    state.locked = false;
    state.correctKeys = [];
    state.wrongKeys = [];
    state.lastOutcome = null;
    state.timeLeft = SPRINT_SECONDS;
    state.sprintScore = 0;
    state.sprintInstant = 0;
    state.sprintBeatBest = false;
    state.roundReason = null;
    state.roundInterrupted = false;
    if (mode === "send") {
      context.send.activate();
      context.render();
    } else if (mode === "sprint") {
      state.roundType = "letter";
      state.target = weightedLetter(state.performanceProfile, state.progress, null);
      state.status = "Press start when ready";
      context.render();
    } else {
      newRound(false);
    }
    storage.set(STORAGE_KEYS.mode, mode);
    syncUrl();
    announce(`${mode[0].toUpperCase() + mode.slice(1)} mode selected.`);
  }

  function setDifficulty(difficulty) {
    if (!Object.hasOwn(SPEEDS, difficulty)) return;
    state.difficulty = difficulty;
    storage.set(STORAGE_KEYS.difficulty, difficulty);
    context.render();
    announce(`Speed set to ${SPEEDS[difficulty].label}, ${SPEEDS[difficulty].hint}.`);
  }

  function clearSignalAnimation() {
    cancelSignalAnimation?.();
    cancelSignalAnimation = null;
    if (playbackTimer) window.clearTimeout(playbackTimer);
    playbackTimer = null;
    state.playing = false;
  }

  /**
   * Playback and the visible marks share one schedule. The response clock is
   * stamped at the END of the transmission, so a long character is not scored
   * as a slow answer.
   */
  function playCurrentSignal(options = {}) {
    const { replay = false } = options;
    const text = currentText();
    const speed = currentSpeed();
    const schedule = scheduleText(text, speed);
    const durationMs = scheduleDurationMs(text, speed);

    // The real marks exist for exactly as long as the transmission does: they
    // are drawn for the playback, lit on its own schedule, and fade back to
    // placeholders when it ends, so the shape is never left on screen.
    clearSignalAnimation();
    state.playing = true;
    context.render();
    cancelSignalAnimation = animateMarks(
      [elements.signalText, elements.signalBars, elements.introSignal],
      schedule,
    );
    playbackTimer = window.setTimeout(() => {
      playbackTimer = null;
      state.playing = false;
      context.render();
    }, PLAYBACK_LEAD_MS + durationMs);

    if (!state.introLetter) {
      state.roundStartedAt = performance.now() + durationMs;
      if (replay && state.firstListen) {
        state.firstListen = false;
        for (const letter of new Set(text)) recordReplay(state.performanceProfile, letter);
        context.persistProfile();
      }
    }

    if (!audio.playText(text, speed)) {
      state.status = "Audio unavailable · follow the visible signal";
      state.revealMarks = true;
      context.render();
      announce("Audio is unavailable. The Morse pattern remains visible.");
    }
  }

  /**
   * What the learner is told about the answer they just gave. The status has to
   * say when a round did not count, or the honesty of the schedule is invisible
   * and a page they walked away from looks like a character they forgot.
   */
  function answerStatus({ target, hit, group, interrupted, assisted, heldBack }) {
    if (interrupted) {
      return hit
        ? `${target} · not counted — you left the page`
        : "Not counted — you left the page";
    }
    if (!hit) return `Not quite · it was ${target}`;
    if (heldBack) return `Correct · ${target} · slowly — it returns sooner`;
    if (assisted) {
      return group
        ? `${target} · correct, but replayed`
        : `Correct · ${target} · replayed, so practice`;
    }
    return `Correct · ${target}`;
  }

  /** One reason, only when it is true, and never on a plain mix or use round. */
  function roundStatus() {
    if (state.mode === "sprint") return "Next signal";
    if (state.roundReason) return `Listening · ${state.roundReason}`;
    if (state.target.length > 1) return `Listening · ${state.target.length} letters`;
    return "Listening";
  }

  /**
   * One answered round. The counters, the schedule and the attempt log are
   * three different jobs: the counters describe the character, `gradeLetter`
   * decides when it comes back, and the log is the only thing that can later
   * say whether it survived a night. Group rounds are context evidence — they
   * record outcomes and confusions but never move a character's schedule,
   * because a word says nothing about any single character in it.
   */
  function commitAnswer() {
    const typed = state.typed;
    const target = state.target;
    const hit = typed === target;
    const responseMs = performance.now() - state.roundStartedAt;
    const now = Date.now();
    const group = target.length > 1;
    const replayed = !state.firstListen;
    const hinted = state.revealed;
    const interrupted = state.roundInterrupted || responseMs > RT_CAP;
    const firstListen = state.firstListen && !hinted && !interrupted;
    const roundNumber = state.sessionAnswered + 1;
    // The one rule for whether a trial is evidence: an interrupted round never
    // is, and a hit the learner needed a replay or a hint for is practice. A
    // miss is a miss either way.
    const assisted = replayed || hinted;
    let scored = !interrupted && (!hit || !assisted);
    let heldBack = false;

    if (!group) {
      const metrics = state.performanceProfile.letters[target];
      const baseline = letterBaseline(state.performanceProfile, target);
      const outcome = gradeLetter(metrics, {
        hit,
        rt: responseMs,
        replayed,
        hint: hinted,
        interrupted: state.roundInterrupted,
        now,
        baseline,
      });
      scored = outcome.scored;
      heldBack = outcome.heldBack;
      if (outcome.qualifies) notePairWin(state.performanceProfile, target, now, pool());
      if (outcome.heldBack && !state.heldBackThisSession.includes(target)) {
        state.heldBackThisSession.push(target);
      }
      if (!hit && !interrupted && !state.lapsedThisSession.includes(target)) state.lapsedThisSession.push(target);
      if (hit && state.lapsedThisSession.includes(target) && !state.relearnedThisSession.includes(target)) {
        state.relearnedThisSession.push(target);
      }
      if (outcome.retry && state.mode === "learn") {
        state.retries = scheduleRetry(state.retries, target, roundNumber, outcome.retry);
      }
    }

    for (let index = 0; index < target.length; index += 1) {
      const letter = target[index];
      const letterHit = letter === typed[index];
      context.recordPerformance(letter, typed[index] ?? "", letterHit, responseMs, {
        firstListen,
        at: now,
        // A word is copied as one act, so its elapsed time says nothing about
        // any single character: outcomes count, the clock does not.
        timing: !group,
        clean: letterHit && firstListen && !group,
        scored: group ? scored && (!letterHit || !assisted) : scored,
        graded: !group,
      });
      context.logEvent({
        ts: now,
        target: letter,
        correct: letterHit,
        ctx: group ? "word" : "char",
        rt: responseMs,
        replay: replayed,
        hint: hinted,
        interrupted,
        scored: group ? scored && (!letterHit || !assisted) : scored,
        reason: interrupted ? "interrupted" : undefined,
      });
    }

    if (!group) {
      context.persistProfile();
    } else if (state.mode === "learn") {
      // Only group rounds move the spacing: they are where the gaps are what
      // the learner is actually fighting.
      const result = updateSpacing(state.progress, state.groupStreaks, hit && firstListen, preset().effectiveWpm);
      state.groupStreaks = result.streaks;
      if (result.direction) {
        state.progress.effOffset = result.offset;
        state.spacingDirection = result.direction;
        writeProgress(storage, state.progress);
      }
    }

    state.locked = true;
    state.revealMarks = true;
    state.feedback = interrupted ? "neutral" : hit ? "correct" : "incorrect";
    state.status = answerStatus({ target, hit, group, interrupted, assisted, heldBack });
    if (!interrupted) {
      state.streak = hit ? state.streak + 1 : 0;
      state.correct += hit ? 1 : 0;
      state.total += 1;
    }
    state.revealed = false;
    state.lastOutcome = hit ? "correct" : "incorrect";
    state.correctKeys = [...new Set(target)];
    state.wrongKeys = hit ? [] : [...new Set([...typed].filter((letter, index) => target[index] !== letter))];
    for (const letter of new Set(target)) state.seenRound[letter] = roundNumber;

    if (state.mode === "sprint" && hit) {
      state.sprintScore += 1;
      if (firstListen && responseMs <= INSTANT_MS) state.sprintInstant += 1;
    }
    if (state.mode === "learn") state.sessionAnswered += 1;
    context.render();

    announce(state.status);

    const delay = state.mode === "sprint" ? 340 : hit ? 760 : 1250;
    nextRoundTimer = window.setTimeout(() => newRound(true), delay);
  }

  function answer(letter) {
    if (state.locked || state.introLetter || state.sessionDone) return;
    if (!pool().includes(letter)) {
      state.status = "Not unlocked yet";
      context.render();
      announce(`${letter} is not unlocked yet.`);
      return;
    }
    if (state.mode === "sprint" && !state.running) {
      announce("Start the sprint before answering.");
      return;
    }

    state.typed += letter;
    if (state.typed.length < state.target.length) {
      context.render();
      return;
    }
    commitAnswer();
  }

  function backspace() {
    if (state.locked || state.introLetter || state.sessionDone || !state.typed) return;
    state.typed = state.typed.slice(0, -1);
    context.render();
  }

  function openIntro(letter, { unlock = true, seed = false } = {}) {
    clearPendingRound();
    // The two starting characters are taught, not unlocked: they were already
    // in play before the first session opened.
    if (unlock) {
      const result = unlockLetter(state.progress);
      state.progress = result.progress;
      writeProgress(storage, state.progress);
    }
    state.introSeeded = seed;
    state.introLetter = letter;
    state.locked = true;
    state.typed = "";
    state.feedback = "neutral";
    state.revealMarks = true;
    context.render();
    playCurrentSignal();
    elements.introGotIt.focus({ preventScroll: true });
    announce(`New letter ${letter}. ${NOTES[letter]}`);
  }

  function dismissIntro() {
    if (!state.introLetter) return;
    const letter = state.introLetter;
    const seeded = state.introSeeded;
    state.introLetter = null;
    state.introSeeded = false;
    // A seeded intro hands back to the opening run, which decides what comes
    // next; an earned one goes straight into the character it just handed over.
    if (seeded) {
      newRound(true);
      return;
    }
    startRound({ type: "letter", text: letter, contrast: null }, true);
    state.status = isComplete(state.progress) ? "All 10 letters unlocked" : `New letter · ${letter}`;
    context.render();
  }

  function openSessionEnd() {
    clearPendingRound();
    state.sessionDone = true;
    state.locked = true;
    state.typed = "";
    state.feedback = "neutral";
    state.status = "Session done";
    state.progress.sessions = (Number(state.progress.sessions) || 0) + 1;
    state.progress.seeded = true;
    writeProgress(storage, state.progress);
    state.sessionSentence = sessionSentence(state.performanceProfile, state.progress, {
      heldBack: state.heldBackThisSession,
      lapsed: state.relearnedThisSession,
      events: state.events,
      spacing: state.spacingDirection,
    });
    context.render();
    elements.sessionContinue.focus({ preventScroll: true });
    announce(`Session done. ${state.sessionSentence}`);
  }

  function startSession() {
    state.sessionDone = false;
    state.sessionAnswered = 0;
    state.sessionExtras = 0;
    state.seedIndex = needsSeeding(state.progress) ? state.seedIndex : SEED_QUEUE.length;
    state.seenRound = {};
    state.served = {};
    state.skippedPhases = [];
    state.retries = [];
    state.heldBackThisSession = [];
    state.lapsedThisSession = [];
    state.relearnedThisSession = [];
    state.groupStreaks = { miss: 0, clean: 0 };
    state.spacingDirection = null;
    newRound(true);
  }

  function startRound(round, playAfterRender) {
    state.roundType = round.type;
    state.target = round.text;
    state.roundReason = round.reason ?? null;
    if (round.skipped && !state.skippedPhases.includes(round.skipped)) {
      state.skippedPhases.push(round.skipped);
    }
    // A spliced retry is an extra round: it is marked served so it cannot be
    // played twice, and the session grows by one so the rail stays honest.
    if (round.retryOf) {
      round.retryOf.served = true;
      state.sessionExtras += 1;
    }
    // Coverage is counted when a character is served, not when it is answered —
    // and only inside the guided session a sprint is not part of.
    if (state.mode === "learn") {
      for (const letter of round.text) state.served[letter] = (state.served[letter] ?? 0) + 1;
    }
    state.typed = "";
    state.revealMarks = false;
    state.feedback = "neutral";
    state.revealed = false;
    state.locked = false;
    state.correctKeys = [];
    state.wrongKeys = [];
    state.lastOutcome = null;
    state.firstListen = true;
    state.roundInterrupted = false;
    state.status = roundStatus();
    state.roundStartedAt = performance.now();
    context.render();
    if (playAfterRender && (state.mode !== "sprint" || state.running)) playCurrentSignal();
  }

  /** The trainer chooses the exercise; the learner only answers it. */
  function newRound(playAfterRender = false) {
    clearPendingRound();

    if (state.mode === "sprint") {
      startRound(
        { type: "letter", text: weightedLetter(state.performanceProfile, state.progress, state.target), contrast: null },
        playAfterRender,
      );
      return;
    }

    if (state.sessionAnswered >= sessionLength()) {
      openSessionEnd();
      return;
    }

    const now = Date.now();
    // The brake is evaluated once per round; it is the one thing that writes
    // `newPaused`, so the record is saved right where the decision is made.
    const wasPaused = state.progress.newPaused;
    const ready = readyForNew(state.performanceProfile, state.progress, now, state.events);
    if (state.progress.newPaused !== wasPaused) writeProgress(storage, state.progress);

    const round = pickRound({
      profile: state.performanceProfile,
      progress: state.progress,
      events: state.events,
      history: {
        round: state.sessionAnswered + 1,
        baseRound: baseRound(),
        seenRound: state.seenRound,
        served: state.served,
        previous: state.target,
        retries: state.retries,
        ready,
        wasReady: state.wasReadyForNew,
        seedIndex: state.seedIndex,
        now,
      },
    });
    state.wasReadyForNew = ready;

    if (round.seed) {
      state.seedIndex += 1;
      // The opening run is remembered as soon as it has been handed out, so a
      // reload in the middle of it does not start the introduction again.
      if (state.seedIndex >= SEED_QUEUE.length && !state.progress.seeded) {
        state.progress.seeded = true;
        writeProgress(storage, state.progress);
      }
    }

    if (round.type === "intro") {
      openIntro(round.letter, { unlock: round.unlock !== false, seed: Boolean(round.seed) });
      return;
    }
    startRound(round, playAfterRender);
  }

  function showHintOrAdvance() {
    if (state.mode === "sprint") {
      startSprint();
      return;
    }
    if (state.revealed) {
      newRound(true);
      return;
    }

    state.revealed = true;
    state.firstListen = false;
    state.revealMarks = true;
    state.typed = state.target;
    state.status = state.target.length > 1
      ? `Hint · ${state.target}`
      : `Hint · ${state.target} is ${visiblePattern(MORSE[state.target])}`;
    state.feedback = "neutral";
    state.correctKeys = [...new Set(state.target)];
    state.wrongKeys = [];
    state.lastOutcome = "correct";
    for (const letter of new Set(state.target)) {
      recordHint(state.performanceProfile, letter);
      if (!state.revealedLetters.includes(letter)) state.revealedLetters.push(letter);
    }
    context.persistProfile();
    context.render();
    announce(`Hint. The answer is ${state.target}.`);
  }

  function startSprint() {
    if (!sprintUnlocked()) return;
    clearPendingRound();
    stopSprint();
    state.running = true;
    state.timeLeft = SPRINT_SECONDS;
    state.sprintScore = 0;
    state.sprintInstant = 0;
    state.streak = 0;
    state.sprintBeatBest = false;
    state.sprintDeadline = performance.now() + SPRINT_SECONDS * 1000;
    sprintTimer = window.setInterval(updateSprint, 100);
    startRound(
      { type: "letter", text: weightedLetter(state.performanceProfile, state.progress, null), contrast: null },
      true,
    );
    state.status = "Go";
    context.render();
    announce("Sprint started. You have 30 seconds.");
  }

  function updateSprint() {
    if (!state.running) return;
    state.timeLeft = Math.max(0, (state.sprintDeadline - performance.now()) / 1000);
    if (state.timeLeft <= 0) {
      finishSprint();
      return;
    }
    // The 100 ms sprint tick only changes trainer UI; avoid repainting everything.
    render();
  }

  function finishSprint() {
    stopSprint();
    clearPendingRound();
    state.timeLeft = 0;
    state.locked = true;
    state.typed = "";
    state.status = `Time up · ${state.sprintScore} ${state.sprintScore === 1 ? "letter" : "letters"} · ${state.sprintInstant} instant`;
    state.feedback = "neutral";
    state.sprintBeatBest = state.sprintScore > state.sprintBest;
    state.sprintCompleted = true;
    state.sprintBest = Math.max(state.sprintBest, state.sprintScore);
    storage.set(STORAGE_KEYS.sprintBest, state.sprintBest);
    context.render();
    playOnce(elements.statusLine, "pop");
    announce(`Time up. You decoded ${state.sprintScore} ${state.sprintScore === 1 ? "letter" : "letters"}, ${state.sprintInstant} of them instantly.`);
  }

  function stopSprint() {
    if (sprintTimer) window.clearInterval(sprintTimer);
    sprintTimer = null;
    state.running = false;
  }

  function clearPendingRound() {
    if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
  }

  function focusTrainer(target = elements.machine) {
    window.requestAnimationFrame(() => {
      elements.machine.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    });
  }

  /** Clears the session after a progress reset without reloading the page. */
  function resetSession() {
    clearPendingRound();
    stopSprint();
    state.streak = 0;
    state.correct = 0;
    state.total = 0;
    state.introLetter = null;
    state.revealedLetters.length = 0;
    state.sprintScore = 0;
    state.sprintInstant = 0;
    state.sprintBest = 0;
    state.sprintCompleted = false;
    state.sprintBeatBest = false;
    state.timeLeft = SPRINT_SECONDS;
    state.sessionAnswered = 0;
    state.sessionExtras = 0;
    state.sessionDone = false;
    state.seedIndex = 0;
    state.introSeeded = false;
    state.seenRound = {};
    state.served = {};
    state.skippedPhases = [];
    state.retries = [];
    state.heldBackThisSession = [];
    state.lapsedThisSession = [];
    state.relearnedThisSession = [];
    state.groupStreaks = { miss: 0, clean: 0 };
    state.spacingDirection = null;
    state.wasReadyForNew = true;
    if (state.mode === "sprint") setMode("learn");
    else newRound(false);
  }

  function handleKeydown(event) {
    if (state.onboardingOpen || state.lettersOpen) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, input, textarea, a, [popover]")) return;

    if (event.code === "Space") {
      event.preventDefault();
      if (state.mode === "send") context.send.playTarget();
      else playCurrentSignal({ replay: true });
      return;
    }
    if (event.key === "Backspace" && state.mode !== "send") {
      event.preventDefault();
      backspace();
      return;
    }
    if (event.key === "Enter") {
      if (state.introLetter) {
        event.preventDefault();
        dismissIntro();
        return;
      }
      if (state.sessionDone) {
        event.preventDefault();
        startSession();
        return;
      }
      if (state.mode !== "send") {
        event.preventDefault();
        showHintOrAdvance();
      }
      return;
    }

    const letter = event.key.toUpperCase();
    if (state.mode !== "send" && !state.introLetter && !state.sessionDone && /^[A-Z]$/.test(letter)) {
      event.preventDefault();
      answer(letter);
    }
  }

  /**
   * A round the learner stepped away from is not evidence. Losing the window or
   * the tab between the signal and the answer marks the round interrupted: it
   * can never be a first listen and can never qualify for a longer interval.
   */
  function markInterrupted() {
    if (state.mode === "send" || state.locked || state.introLetter || state.sessionDone) return;
    state.roundInterrupted = true;
  }

  function bind() {
    window.addEventListener("blur", markInterrupted);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") markInterrupted();
    });
    for (const element of [elements.streakStat, elements.statusLine]) {
      element.addEventListener("animationend", () => delete element.dataset.pop);
    }
    for (const button of elements.modeButtons) {
      button.addEventListener("click", () => setMode(button.dataset.mode));
    }
    elements.signalButton.addEventListener("click", () => playCurrentSignal({ replay: true }));
    elements.replayButton.addEventListener("click", () => playCurrentSignal({ replay: true }));
    elements.mainAction.addEventListener("click", showHintOrAdvance);
    elements.introHear.addEventListener("click", () => playCurrentSignal());
    elements.introGotIt.addEventListener("click", dismissIntro);
    elements.sessionContinue.addEventListener("click", startSession);
    document.addEventListener("keydown", handleKeydown);
  }

  return Object.freeze({
    answer,
    bind,
    clearSignalAnimation,
    currentSpeed,
    focusTrainer,
    newRound,
    playCurrentSignal,
    render,
    resetSession,
    setDifficulty,
    setMode,
    setTheme,
    sprintUnlocked,
    stopSprint,
    syncUrl,
    updateSprint,
  });
}
