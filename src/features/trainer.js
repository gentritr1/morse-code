import {
  ARRIVAL_IDLE_MS,
  INSTANT_MS,
  KOCH_ORDER,
  RT_CAP,
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
import {
  gradeLetter,
  letterBaseline,
  missCause,
  notePairWin,
  recordContext,
  recordHint,
  recordReplay,
  recordWordTime,
  wordBaseline,
} from "./performance-profile.js";
import {
  SEED_QUEUE,
  arrivalLines,
  checkMilestones,
  effectiveWpmFor,
  isComplete,
  needsSeeding,
  phaseFor,
  phaseTable,
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

  /** True while one of the four moment cards has replaced the practice view. */
  function cardOpen() {
    return Boolean(state.introLetter || state.contactOpen || state.arrivalOpen || state.sessionDone);
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
    const text = currentText();
    const length = Math.max(1, text.length);
    const slots = [];
    for (let index = 0; index < length; index += 1) {
      // A word gap is structure, not something the learner has to fill in: the
      // slot is always a gap, whether or not the message has got that far.
      slots.push(text[index] === " " ? " " : (state.typed[index] ?? "_"));
    }
    const value = slots.join("");
    if (value === renderedAnswer) return;
    // Only the character that just landed pops; the ones already on screen stay put.
    const typedCount = [...state.typed].filter((character) => character !== " ").length;
    const settled = renderedAnswer === null
      ? 0
      : [...renderedAnswer].filter((character) => character !== "_" && character !== " ").length;
    let newest = renderedAnswer !== null && typedCount > settled ? state.typed.length - 1 : -1;
    while (newest > 0 && text[newest] === " ") newest -= 1;
    renderedAnswer = value;

    elements.typedAnswer.replaceChildren(
      ...slots.map((character, index) => {
        const slot = document.createElement("span");
        slot.className = character === "_"
          ? "typed-slot empty"
          : character === " " ? "typed-slot gap" : "typed-slot";
        if (index === newest) slot.classList.add("typed-value");
        slot.textContent = character === " " ? "\u00a0" : character;
        return slot;
      }),
    );
  }

  function renderIntro() {
    const letter = state.introLetter;
    if (!letter) return;
    elements.introTag.textContent = state.introRefresh ? "Refresher" : "New letter";
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

    const table = phaseTable(state.seedRun);
    const active = phaseFor(Math.min(SESSION_ROUNDS, baseRound()), state.seedRun);
    elements.sessionPhase.textContent = active.label;
    for (const segment of elements.sessionRail.children) {
      const phase = table.find((entry) => entry.id === segment.dataset.phase);
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
    const showContact = !showIntro && isLearn && state.contactOpen;
    const showArrival = !showIntro && !showContact && isLearn && state.arrivalOpen;
    const showSession = !showIntro && !showContact && !showArrival && isLearn && state.sessionDone;
    const showCard = showIntro || showContact || showArrival || showSession;
    const accuracy = state.total ? `${Math.round((state.correct / state.total) * 100)}%` : "—";
    const remaining = Math.max(0, state.timeLeft);

    elements.machine.dataset.mode = state.mode;
    elements.machine.dataset.feedback = state.feedback;
    // Learn and Sprint both hide the shape of the signal while the learner
    // decides: the ear leads, and Sprint is a checkpoint on the same skill.
    elements.machine.dataset.reveal = !isSend && !state.revealMarks ? "hidden" : "shown";
    elements.machineTitle.textContent = THEMES[state.theme].title;
    // The plate names the learner's own station, not a serial number.
    elements.machineSubtitle.textContent = `${THEMES[state.theme].prefix} · ${state.progress.callsign}`;
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
    elements.contactCard.hidden = !showContact;
    elements.arrivalCard.hidden = !showArrival;
    elements.sessionCard.hidden = !showSession;
    elements.practiceView.hidden = showCard || isSend;
    elements.sendView.hidden = showCard || !isSend;
    elements.answerDeck.hidden = showCard || isSend;
    elements.sprintPanel.hidden = !isSprint;
    renderIntro();
    // The transmission the learner cannot read yet stays uniform: the marks
    // light on the schedule, but nothing about their shape is on screen.
    if (showContact) renderSignal(elements.contactSignal, state.target, false, false);
    elements.arrivalPrimary.textContent = state.arrivalLines[0] ?? "";
    elements.arrivalSecondary.textContent = state.arrivalLines[1] ?? "";
    elements.arrivalSecondary.hidden = state.arrivalLines.length < 2;
    elements.sessionTag.textContent = state.sessionMilestone ? "Milestone" : "Session done";
    elements.sessionSentence.textContent = state.sessionSentence;
    // The note is what the message meant. It is said once, on the card, in the
    // session it arrived — the drawer only ever lists what was decoded.
    // When a milestone takes the last sentence slot the intercept clause is
    // dropped; the note must go with it, or it explains a message never named.
    const intercepted = Boolean(state.sessionTransmission)
      && state.sessionSentence.includes("You intercepted transmission");
    elements.sessionNote.hidden = !intercepted;
    elements.sessionNote.textContent = intercepted ? state.sessionTransmission.note : "";

    // An unknown transmission announces itself: it is not another word round,
    // it is a message from a station that is not us.
    const transmission = state.roundType === "signal" ? state.transmission : null;
    elements.signalTag.hidden = !transmission;
    elements.signalTag.textContent = transmission
      ? `UNKNOWN TRANSMISSION · no. ${transmission.num}`
      : "";

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
    // The keys stay on screen while the signal sounds — dimmed, not removed, so
    // nothing shifts under the hand — and only open once the last tone has gone.
    const answersEnabled = !state.locked && !state.playing && (!isSprint || state.running);
    const settled = state.lastOutcome !== null;
    for (const button of elements.answerGrid.children) {
      button.disabled = !answersEnabled;
      button.setAttribute("aria-disabled", String(!answersEnabled));
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
    state.transmission = null;
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
    state.roundPaused = false;
    state.pausedHeard = false;
    state.signalHeard = false;
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

  /** True while a transmission the learner is meant to hear is still sounding. */
  function isSounding() {
    return state.playing || audio.isPlaying();
  }

  /**
   * Every learner-initiated replay goes through here. Asking for the signal
   * again while it is still sounding is not a replay — it is the same listen —
   * so it is dropped rather than layered, and it does not spend the round's
   * first listen.
   */
  function replaySignal() {
    if (isSounding()) return false;
    playCurrentSignal({ replay: true });
    return true;
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
    audio.stop();
    state.playing = true;
    state.signalHeard = false;
    context.render();
    cancelSignalAnimation = animateMarks(
      [elements.signalText, elements.signalBars, elements.introSignal, elements.contactSignal],
      schedule,
    );
    playbackTimer = window.setTimeout(() => {
      playbackTimer = null;
      state.playing = false;
      // The answer window opens exactly here: not before the last tone, so a
      // pre-emptive tap can never be recorded as an exceptionally fast answer.
      state.signalHeard = true;
      context.render();
    }, PLAYBACK_LEAD_MS + durationMs);

    if (!state.introLetter) {
      state.roundStartedAt = performance.now() + durationMs;
      // A round that has already been committed cannot be replayed *into*: the
      // answer is in, so hearing it again is listening, not assistance.
      if (replay && state.firstListen && !state.locked) {
        state.firstListen = false;
        for (const letter of new Set(text)) recordReplay(state.performanceProfile, letter);
        context.persistProfile();
      }
    }

    // The bed belongs to the transmission, not to a setting: only a message
    // from somewhere else arrives over static.
    const ambience = !state.introLetter && (state.roundType === "signal" || state.roundType === "contact");
    if (!audio.playText(text, speed, { ambience })) {
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
  function answerStatus({ target, hit, group, interrupted, assisted, heldBack, firstRead, transmission }) {
    if (interrupted) {
      return hit
        ? `${target} · not counted — you left the page`
        : "Not counted — you left the page";
    }
    // A transmission is archived by being decoded, so its feedback says what
    // was decoded and where it came from — never a score.
    if (transmission) {
      if (!hit) return `The signal was ${target}. It will come through again.`;
      return assisted
        ? `${target} · archived, with help.`
        : `${target} · origin: ${transmission.origin}. Archived.`;
    }
    if (!hit) return `Not quite · it was ${target}`;
    // The opening transmission, read back. It is true exactly once.
    if (firstRead && !assisted) return "You read it. Two minutes ago that was noise.";
    if (heldBack) return `Correct · ${target} · slowly — it returns sooner`;
    if (assisted) {
      return group
        ? `${target} · correct, but replayed`
        : `Correct · ${target} · replayed, so practice`;
    }
    return `Correct · ${target}`;
  }

  /**
   * Leaving a live round stops it. A signal playing to an empty room, an
   * auto-advance firing behind a settings sheet, and a response clock running
   * while the learner reads the guide are all the same fault: the round carries
   * on without the person it is measuring.
   */
  function pauseRound() {
    if (state.roundPaused) return false;
    clearSignalAnimation();
    audio.stop();
    if (state.mode === "send") {
      context.send.stopPlayback();
      return false;
    }
    // Sprint keeps the pause it already had: the guide stops the clock, and a
    // hidden tab simply costs the learner the seconds it was hidden for.
    if (state.mode !== "learn") return false;

    clearPendingRound();
    // Whether the learner had already heard the whole signal decides what
    // coming back owes them: a fresh transmission, or simply the answer window
    // reopened on a trial that can no longer count.
    state.pausedHeard = state.signalHeard;
    state.pausedRound = state.sessionAnswered;
    state.roundPaused = true;
    state.locked = true;
    state.status = "Paused";
    context.render();
    return true;
  }

  /**
   * Coming back. An answered round only owes the learner its feedback beat; an
   * unanswered one owes them the signal again — uninterrupted, from the top,
   * and without being charged a replay for a listen they never got.
   */
  function resumeRound() {
    if (!state.roundPaused) return false;
    // Something else is still over the stage. Closing the settings panel to
    // open the guide would otherwise restart the signal behind the dialog,
    // because the popover's `toggle` event arrives after the guide has opened.
    if (state.onboardingOpen || state.lettersOpen) return false;
    if (elements.settingsPanel.matches(":popover-open")) return false;
    state.roundPaused = false;
    // A card is not a round: it owes the learner nothing on return except the
    // demonstration the contact card exists to give.
    if (state.contactOpen) {
      state.locked = true;
      context.render();
      playCurrentSignal();
      return true;
    }
    if (state.introLetter || state.arrivalOpen || state.sessionDone) {
      state.locked = true;
      context.render();
      return true;
    }
    if (state.lastOutcome !== null) {
      context.render();
      nextRoundTimer = window.setTimeout(() => newRound(true), 400);
      return true;
    }

    state.locked = false;
    const heard = state.pausedHeard && state.pausedRound === state.sessionAnswered;
    if (heard) {
      // They already heard it. Replaying would be teaching a character they
      // have not been asked about yet, so the window simply reopens — and the
      // trial is marked interrupted, because whatever they answer now is a
      // memory of a signal that was on screen while they were somewhere else.
      state.roundInterrupted = true;
      state.status = "Listening · not counted — you stepped away";
      context.render();
      return true;
    }

    // Cut off mid-signal, or paused before it ever played: the learner never
    // had an uninterrupted listen, so they get a real one and the round is
    // scored normally. The re-play is not charged as a replay.
    state.roundInterrupted = false;
    state.status = roundStatus();
    context.render();
    playCurrentSignal();
    return true;
  }

  /** One reason, only when it is true, and never on a plain mix or use round. */
  function roundStatus() {
    if (state.mode === "sprint") return "Next signal";
    if (state.roundReason) return `Listening · ${state.roundReason}`;
    const letters = [...state.target].filter((character) => character !== " ").length;
    if (letters > 1) return `Listening · ${letters} letters`;
    return "Listening";
  }

  /**
   * One answered round. The counters, the schedule and the attempt log are
   * three different jobs: the counters describe the character, `gradeLetter`
   * decides when it comes back, and the log is the only thing that can later
   * say whether it survived a night.
   *
   * The two skills are kept apart. Naming a character on its own is the only
   * thing `gradeLetter` ever sees; reading one inside a word writes to its own
   * `context` record and touches no scheduler field at all, because one wrong
   * position in a five-letter word must never push five characters into
   * relearning.
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
    const cause = missCause({
      assisted,
      rt: responseMs,
      baseline: group
        ? wordBaseline(state.performanceProfile)
        : letterBaseline(state.performanceProfile, target),
    });
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
      // The confusion model takes the same evidence test as the scheduler: a
      // pair is only cured by an answer that was actually retrieved.
      if (outcome.clean) notePairWin(state.performanceProfile, target, now, pool());
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
      // A word gap is not a character: it is never typed, never scored, and
      // never logged as an attempt on a letter that does not exist.
      if (letter === " ") continue;
      const letterHit = letter === typed[index];
      if (group) {
        recordContext(state.performanceProfile, letter, {
          hit: letterHit,
          clean: letterHit && !assisted && !interrupted,
          interrupted,
          answered: typed[index] ?? "",
          at: now,
          cause,
        });
        if (letterHit && !assisted && !interrupted) {
          notePairWin(state.performanceProfile, letter, now, pool());
        }
      } else {
        context.recordPerformance(letter, typed[index] ?? "", letterHit, responseMs, {
          firstListen,
          at: now,
          timing: true,
          clean: letterHit && firstListen,
          scored,
          graded: true,
          interrupted,
          cause,
        });
      }
      context.logEvent({
        ts: now,
        target: letter,
        correct: letterHit,
        ctx: group ? "word" : "char",
        rt: responseMs,
        replay: replayed,
        hint: hinted,
        interrupted,
        scored: group ? !interrupted : scored,
        reason: interrupted ? "interrupted" : undefined,
      });
    }

    // Decoding it is what archives it. Help still archives — the message is
    // read either way — but only an unaided decode is recorded as independent.
    const transmission = state.roundType === "signal" ? state.transmission : null;
    if (transmission && hit && !interrupted) {
      const archive = { ...(state.progress.archive ?? {}) };
      if (!archive[transmission.id]) {
        archive[transmission.id] = { ts: now, independent: !assisted };
        state.progress.archive = archive;
        state.sessionTransmission = transmission;
        writeProgress(storage, state.progress);
      }
    }

    if (group && hit && !assisted && !interrupted) {
      recordWordTime(state.performanceProfile, responseMs);
      // A whole word, read with no replay, no hint and no interruption. The
      // counter is the evidence the milestone is later stated from.
      if (state.roundType === "word") {
        state.progress.unaidedWords = (Number(state.progress.unaidedWords) || 0) + 1;
        writeProgress(storage, state.progress);
      }
    }
    context.persistProfile();
    if (group && state.mode === "learn") {
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
    state.status = answerStatus({
      target, hit, group, interrupted, assisted, heldBack, firstRead: state.roundFirstRead, transmission,
    });
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
    if (state.locked || cardOpen()) return;
    // An answer given before the last tone is not a fast answer, it is a guess
    // against a signal that has not finished arriving. It is dropped in
    // silence: no status, no scoring, nothing for the learner to undo.
    if (state.playing) return;
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
    // The gaps in a transmission are heard, not typed: the cursor steps over
    // them so the learner only ever answers with characters.
    while (state.target[state.typed.length] === " ") state.typed += " ";
    if (state.typed.length < state.target.length) {
      context.render();
      return;
    }
    commitAnswer();
  }

  function backspace() {
    if (state.locked || cardOpen() || !state.typed) return;
    let typed = state.typed;
    while (typed.endsWith(" ")) typed = typed.slice(0, -1);
    state.typed = typed.slice(0, -1);
    context.render();
  }

  function openIntro(letter, { unlock = true, seed = false, play = true, refresh = false } = {}) {
    clearPendingRound();
    // The two starting characters are taught, not unlocked: they were already
    // in play before the first session opened.
    if (unlock) {
      const result = unlockLetter(state.progress);
      state.progress = result.progress;
      writeProgress(storage, state.progress);
    }
    state.introSeeded = seed;
    state.introRefresh = refresh;
    state.introLetter = letter;
    state.locked = true;
    state.typed = "";
    state.feedback = "neutral";
    state.revealMarks = true;
    state.roundPaused = false;
    state.pausedHeard = false;
    state.signalHeard = false;
    context.render();
    // A card that opens without the learner asking for it — on load, or right
    // after a reset — stays silent until they do.
    if (play) playCurrentSignal();
    elements.introGotIt.focus({ preventScroll: true });
    announce(refresh ? `${letter} again. ${NOTES[letter]}` : `New letter ${letter}. ${NOTES[letter]}`);
  }

  function dismissIntro() {
    if (!state.introLetter) return;
    const letter = state.introLetter;
    const handBack = state.introSeeded || state.introRefresh;
    state.introLetter = null;
    state.introSeeded = false;
    state.introRefresh = false;
    // A seeded intro hands back to the opening run and a refresher to the
    // repair phase that asked for it; only an earned unlock goes straight into
    // the character it has just handed over.
    if (handBack) {
      newRound(true);
      return;
    }
    startRound({ type: "letter", text: letter, contrast: null }, true);
    state.status = isComplete(state.progress) ? "All 10 letters unlocked" : `New letter · ${letter}`;
    context.render();
  }

  /**
   * The first thing a learner ever hears is a message they cannot read. The
   * card is a demonstration, not a round: nothing is scored, nothing is
   * scheduled, and the same transmission comes back as an ordinary burst once
   * both characters have been taught.
   */
  function openContact(text, { play = true } = {}) {
    clearPendingRound();
    state.contactOpen = true;
    state.target = text;
    state.roundType = "contact";
    state.locked = true;
    state.typed = "";
    state.feedback = "neutral";
    state.revealMarks = false;
    state.roundPaused = false;
    state.pausedHeard = false;
    state.signalHeard = false;
    context.render();
    if (play) playCurrentSignal();
    elements.contactContinue.focus({ preventScroll: true });
    announce("Incoming transmission. Two signals just arrived, and you cannot read them yet.");
  }

  function dismissContact() {
    if (!state.contactOpen) return;
    state.contactOpen = false;
    newRound(true);
  }

  /**
   * A returning visit says what is waiting, from the record, and nothing else.
   * Every line is omitted unless the log supports it, and the fallback is
   * itself a fact rather than encouragement.
   */
  function shouldGreet() {
    if (state.mode !== "learn") return false;
    if (state.arrivalShown) return false;
    if ((Number(state.progress.sessions) || 0) < 1) return false;
    if (state.sessionAnswered > 0 || state.sessionDone || state.introLetter) return false;
    // No attempt on record at all is not "mid-session" either: a learner with
    // sessions behind them and an empty log is exactly who this is for.
    const last = [...state.events].reverse().find((event) => event.scored);
    return !last || Date.now() - last.ts >= ARRIVAL_IDLE_MS;
  }

  function openArrival() {
    const now = Date.now();
    const { lines, pair } = arrivalLines(state.performanceProfile, state.progress, state.events, now);
    state.arrivalShown = true;
    state.arrivalLines = lines;
    // The pair line promises the round opens with them, so it does.
    state.arrivalPair = lines.some((line) => line.includes("blur together")) ? pair : null;
    state.arrivalOpen = true;
    state.locked = true;
    state.typed = "";
    state.feedback = "neutral";
    state.revealMarks = false;
    context.render();
    elements.arrivalStart.focus({ preventScroll: true });
    announce(`Welcome back. ${lines.join(" ")}`);
  }

  function dismissArrival() {
    if (!state.arrivalOpen) return;
    state.arrivalOpen = false;
    newRound(true);
  }

  /** The first thing a visit does: greet a returning learner, or start a round. */
  function startVisit() {
    if (shouldGreet()) {
      openArrival();
      return;
    }
    newRound(false);
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
    // Milestones are settled here, once per session, and written with the rest
    // of the record — they are the only thing in the passage that persists.
    const now = Date.now();
    const { milestones, earned } = checkMilestones({
      profile: state.performanceProfile,
      progress: state.progress,
      now,
    });
    state.progress.milestones = milestones;
    state.sessionMilestone = earned[0] ?? null;
    writeProgress(storage, state.progress);
    state.sessionSentence = sessionSentence(state.performanceProfile, state.progress, {
      heldBack: state.heldBackThisSession,
      lapsed: state.relearnedThisSession,
      events: state.events,
      spacing: state.spacingDirection,
      milestone: state.sessionMilestone,
      transmission: state.sessionTransmission,
      now,
    });
    context.render();
    // A milestone is rare, so the scoreboard is allowed to notice it.
    if (state.sessionMilestone) playOnce(elements.streakStat, "pop");
    elements.sessionContinue.focus({ preventScroll: true });
    announce(`${state.sessionMilestone ? "Milestone" : "Session done"}. ${state.sessionSentence}`);
  }

  function startSession() {
    state.sessionDone = false;
    state.sessionMilestone = null;
    state.sessionTransmission = null;
    state.transmissionServed = false;
    state.transmission = null;
    state.arrivalPair = null;
    state.sessionAnswered = 0;
    state.sessionExtras = 0;
    // Which phase table this sitting runs on is decided once, at its start:
    // the seed run flips `progress.seeded` halfway through, and the rail must
    // not change shape underneath the learner when it does.
    state.seedRun = needsSeeding(state.progress);
    state.seedIndex = needsSeeding(state.progress) ? state.seedIndex : SEED_QUEUE.length;
    state.seenRound = {};
    state.served = {};
    state.skippedPhases = [];
    state.retries = [];
    state.pairRefreshed = null;
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
    state.transmission = round.transmission ?? null;
    if (round.transmission) state.transmissionServed = true;
    state.roundReason = round.reason ?? null;
    // The one transmission whose successful decode has its own sentence: the
    // learner heard it as noise a few rounds earlier.
    state.roundFirstRead = Boolean(round.firstRead);
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
      for (const letter of round.text) {
        if (letter === " ") continue;
        state.served[letter] = (state.served[letter] ?? 0) + 1;
      }
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
    state.roundPaused = false;
    state.pausedHeard = false;
    // Nothing has been heard yet; the flag is what resuming reads to decide
    // between replaying the signal and simply reopening the answer window.
    state.signalHeard = false;
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
        pairRefreshed: state.pairRefreshed,
        ready,
        wasReady: state.wasReadyForNew,
        seedIndex: state.seedIndex,
        seeded: state.seedRun,
        openWith: state.arrivalPair?.[0] ?? null,
        transmissionServed: state.transmissionServed,
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

    if (round.type === "contact") {
      openContact(round.text, { play: playAfterRender });
      return;
    }

    if (round.type === "intro") {
      if (round.refresh) state.pairRefreshed = round.pairKey;
      openIntro(round.letter, {
        unlock: round.unlock !== false,
        seed: Boolean(round.seed),
        play: playAfterRender,
        refresh: Boolean(round.refresh),
      });
      return;
    }
    startRound(round, playAfterRender);
  }

  function showHintOrAdvance() {
    if (state.mode === "sprint") {
      startSprint();
      return;
    }
    // The hint reveals the answer, so it waits for the last tone too.
    if (state.playing) return;
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
    clearSignalAnimation();
    audio.stop();
    context.send.stopPlayback();
    state.roundPaused = false;
    state.pausedHeard = false;
    state.signalHeard = false;
    state.roundInterrupted = false;
    state.sessionSentence = "";
    state.status = "Listening";
    state.locked = false;
    state.typed = "";
    state.feedback = "neutral";
    state.revealed = false;
    state.revealMarks = false;
    state.correctKeys = [];
    state.wrongKeys = [];
    state.lastOutcome = null;
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
    state.sessionMilestone = null;
    state.sessionTransmission = null;
    state.transmissionServed = false;
    state.transmission = null;
    state.contactOpen = false;
    state.roundFirstRead = false;
    state.arrivalOpen = false;
    state.arrivalLines = [];
    state.arrivalPair = null;
    state.seedIndex = 0;
    state.introSeeded = false;
    state.seenRound = {};
    state.served = {};
    state.skippedPhases = [];
    state.retries = [];
    state.pairRefreshed = null;
    state.heldBackThisSession = [];
    state.lapsedThisSession = [];
    state.relearnedThisSession = [];
    state.groupStreaks = { miss: 0, clean: 0 };
    state.spacingDirection = null;
    state.wasReadyForNew = true;
    state.seedRun = needsSeeding(state.progress);
    if (state.mode === "sprint") {
      setMode("learn");
      return;
    }
    if (state.mode === "send") {
      context.send.reset();
      context.render();
      return;
    }
    newRound(false);
  }

  function handleKeydown(event) {
    if (state.onboardingOpen || state.lettersOpen || state.roundPaused) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, input, textarea, a, [popover]")) return;

    if (event.code === "Space") {
      event.preventDefault();
      if (state.mode === "send") context.send.playTarget();
      else replaySignal();
      return;
    }
    if (event.key === "Backspace" && state.mode !== "send") {
      event.preventDefault();
      backspace();
      return;
    }
    if (event.key === "Enter") {
      if (state.contactOpen) {
        event.preventDefault();
        dismissContact();
        return;
      }
      if (state.arrivalOpen) {
        event.preventDefault();
        dismissArrival();
        return;
      }
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
    if (state.mode !== "send" && !cardOpen() && /^[A-Z]$/.test(letter)) {
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
    if (state.mode === "send" || state.locked || cardOpen()) return;
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
    elements.signalButton.addEventListener("click", replaySignal);
    elements.replayButton.addEventListener("click", replaySignal);
    elements.mainAction.addEventListener("click", showHintOrAdvance);
    elements.introHear.addEventListener("click", () => {
      if (!isSounding()) playCurrentSignal();
    });
    elements.introGotIt.addEventListener("click", dismissIntro);
    elements.contactReplay.addEventListener("click", () => {
      if (!isSounding()) playCurrentSignal();
    });
    elements.contactContinue.addEventListener("click", dismissContact);
    elements.arrivalStart.addEventListener("click", dismissArrival);
    elements.sessionContinue.addEventListener("click", startSession);
    document.addEventListener("keydown", handleKeydown);
  }

  return Object.freeze({
    answer,
    bind,
    clearSignalAnimation,
    currentSpeed,
    focusTrainer,
    isSounding,
    newRound,
    pauseRound,
    playCurrentSignal,
    render,
    resetSession,
    resumeRound,
    setDifficulty,
    setMode,
    setTheme,
    sprintUnlocked,
    startVisit,
    stopSprint,
    syncUrl,
    updateSprint,
  });
}
