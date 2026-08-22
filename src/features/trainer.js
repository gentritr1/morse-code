import {
  DIFFICULTIES,
  DIFFICULTY_DETAILS,
  MODE_GUIDANCE,
  SPRINT_SECONDS,
  STORAGE_KEYS,
  THEMES,
  VALID_MODES,
} from "../config.js";
import { MORSE, NOTES, STARTER_POOL, randomLetter, spokenPattern, visiblePattern } from "../data/morse.js";
import { renderSignal } from "../ui/signals.js";

export function createTrainerController(context) {
  const { state, elements, storage, audio, announce } = context;
  let sprintTimer = null;
  let nextRoundTimer = null;
  let signalTimers = [];

  function currentPracticePool() {
    return state.mode === "drill" && state.clinicPair ? state.clinicPair : STARTER_POOL;
  }

  function currentLetter() {
    return state.mode === "learn" ? STARTER_POOL[state.learnIndex] : state.target;
  }

  function currentPattern() {
    return MORSE[currentLetter()];
  }

  function currentWpm() {
    const base = DIFFICULTIES[state.difficulty];
    return state.mode === "sprint" ? base + 5 : base;
  }

  function unitSeconds() {
    return 1.2 / currentWpm();
  }

  function isRosterAnswerVisible() {
    return state.mode === "learn" || state.lastOutcome !== null;
  }

  function mainActionLabel() {
    if (state.mode === "sprint") return state.running ? "Restart sprint" : "Start sprint";
    return state.revealed ? "Next signal" : "Show hint";
  }

  function renderCoach() {
    if (state.clinicPair && !state.onboardingOpen) {
      elements.coachMode.textContent = "Clinic drill";
      elements.coachTitle.textContent = `Contrast ${state.clinicPair[0]} and ${state.clinicPair[1]} until the rhythm separates.`;
      const clinicSteps = ["Hear the order", `Choose ${state.clinicPair.join(" or ")}`, "Notice the contrast"];
      [...elements.coachSteps.children].forEach((item, index) => {
        const label = item.querySelector("span");
        if (label) label.textContent = clinicSteps[index];
      });
      return;
    }

    const displayedMode = state.onboardingOpen ? state.onboardingMode : state.mode;
    const guidance = MODE_GUIDANCE[displayedMode];
    elements.coachMode.textContent = guidance.label;
    elements.coachTitle.textContent = guidance.title;
    [...elements.coachSteps.children].forEach((item, index) => {
      const label = item.querySelector("span");
      if (label) label.textContent = guidance.steps[index];
    });
  }

  function render() {
    const letter = currentLetter();
    const pattern = MORSE[letter];
    const accuracy = state.total ? `${Math.round((state.correct / state.total) * 100)}%` : "—";
    const remaining = Math.max(0, state.timeLeft);
    const wholeSeconds = Math.ceil(remaining);

    elements.machine.dataset.theme = state.theme;
    elements.machine.dataset.mode = state.mode;
    elements.machine.dataset.feedback = state.feedback;
    elements.machineTitle.textContent = THEMES[state.theme].title;
    elements.machineSubtitle.textContent = THEMES[state.theme].subtitle;
    elements.rosterTitle.textContent = THEMES[state.theme].roster;
    document.body.dataset.theme = state.theme;
    elements.speedPicker.dataset.theme = state.theme;

    for (const button of elements.themeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === state.theme));
    }
    for (const button of elements.modeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
    }

    const difficultyDetails = DIFFICULTY_DETAILS[state.difficulty];
    elements.speedValue.textContent = difficultyDetails.label;
    elements.speedMeta.textContent = difficultyDetails.meta;
    for (const option of elements.difficultyOptions) {
      const isSelected = option.dataset.difficulty === state.difficulty;
      option.setAttribute("aria-selected", String(isSelected));
      option.tabIndex = isSelected ? 0 : -1;
    }

    elements.speedStat.textContent = `${currentWpm()} WPM`;
    elements.accuracyStat.textContent = accuracy;
    elements.streakStat.textContent = String(state.streak);
    elements.sessionScore.textContent = `${state.correct} / ${state.total} correct`;
    elements.bestScore.textContent = `Best sprint · ${state.sprintBest}`;
    elements.footerMode.textContent = state.clinicPair
      ? `CLINIC · ${state.clinicPair.join(" / ")}`
      : `${state.mode.toUpperCase()} MODE`;
    elements.footerResult.textContent = `${state.correct} OK`;

    const rosterHighlight = isRosterAnswerVisible() ? letter : null;
    for (const row of elements.roster.children) {
      row.classList.toggle("current", row.dataset.letter === rosterHighlight);
    }

    const isLearn = state.mode === "learn";
    const isSprint = state.mode === "sprint";
    elements.learnView.hidden = !isLearn;
    elements.practiceView.hidden = isLearn;
    elements.answerDeck.hidden = isLearn;
    elements.sprintPanel.hidden = !isSprint;

    elements.lessonStep.textContent = `Lesson ${state.learnIndex + 1} of ${STARTER_POOL.length}`;
    elements.lessonPatternText.textContent = visiblePattern(pattern);
    elements.lessonLetter.textContent = letter;
    elements.lessonSpoken.textContent = spokenPattern(pattern);
    elements.lessonNote.textContent = NOTES[letter];
    renderSignal(elements.lessonSignal, pattern);

    elements.statusLine.textContent = state.status;
    elements.typedAnswer.textContent = state.typed;
    renderSignal(elements.signalText, pattern, true);
    renderSignal(elements.signalBars, pattern);

    elements.clock.textContent = `0:${String(wholeSeconds).padStart(2, "0")}`;
    elements.sprintScore.textContent = `${state.sprintScore} ${state.sprintScore === 1 ? "point" : "points"}`;
    elements.timeBar.style.transform = `scaleX(${remaining / SPRINT_SECONDS})`;
    elements.timeTrack.setAttribute("aria-valuenow", String(Math.round(remaining)));

    elements.mainAction.textContent = mainActionLabel();
    const answersEnabled = !state.locked && (!isSprint || state.running);
    for (const button of elements.answerGrid.children) {
      const isInClinic = !state.clinicPair || state.clinicPair.includes(button.dataset.letter);
      button.disabled = !answersEnabled || !isInClinic;
      const isCorrectChoice = button.dataset.letter === state.target && state.lastOutcome !== null;
      button.classList.toggle("was-correct", isCorrectChoice);
      button.classList.toggle("was-incorrect", button.dataset.letter === state.lastAnswer && state.lastOutcome === "incorrect");
    }
    elements.answerHint.textContent = state.clinicPair
      ? `Clinic: press ${state.clinicPair.join(" or ")}`
      : "Tap or press A–Z";
    renderCoach();
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("theme", state.theme);
    url.searchParams.set("mode", state.mode);
    window.history.replaceState(null, "", url);
  }

  function themeLabel(theme) {
    return theme === "pocket" ? "Pocket Trainer" : theme[0].toUpperCase() + theme.slice(1);
  }

  function setTheme(theme) {
    if (!Object.hasOwn(THEMES, theme) || theme === state.theme) return;
    clearSignalAnimation();
    state.theme = theme;
    state.onboardingTheme = theme;
    storage.set(STORAGE_KEYS.theme, theme);
    context.render();
    syncUrl();
    announce(`${themeLabel(theme)} theme selected. Your session is unchanged.`);
  }

  function setMode(mode) {
    if (!VALID_MODES.includes(mode) || mode === state.mode) return;
    clearPendingRound();
    stopSprint();
    if (mode !== "drill") state.clinicPair = null;
    state.mode = mode;
    state.onboardingMode = mode;
    state.typed = "_";
    state.feedback = "neutral";
    state.revealed = false;
    state.locked = false;
    state.lastAnswer = null;
    state.lastOutcome = null;
    state.timeLeft = SPRINT_SECONDS;
    state.sprintScore = 0;
    state.target = randomLetter(state.target, mode === "drill" ? currentPracticePool() : STARTER_POOL);
    state.roundStartedAt = performance.now();
    state.status = mode === "learn" ? "Guided lesson" : mode === "sprint" ? "Press start when ready" : "Listening";
    context.render();
    storage.set(STORAGE_KEYS.mode, mode);
    syncUrl();
    announce(`${mode[0].toUpperCase() + mode.slice(1)} mode selected.`);
  }

  function setDifficulty(difficulty) {
    if (!Object.hasOwn(DIFFICULTIES, difficulty)) return;
    state.difficulty = difficulty;
    storage.set(STORAGE_KEYS.difficulty, difficulty);
    context.render();
    announce(`Speed set to ${currentWpm()} words per minute.`);
  }

  function clearSignalAnimation() {
    for (const timer of signalTimers) window.clearTimeout(timer);
    signalTimers = [];
    for (const mark of document.querySelectorAll(".is-playing")) mark.classList.remove("is-playing");
  }

  function animateSignal(pattern) {
    clearSignalAnimation();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const unitMs = unitSeconds() * 1000;
    const groups = [
      [...elements.signalText.children],
      [...elements.signalBars.children],
      [...elements.lessonSignal.children],
    ];
    let offset = 60;

    pattern.split("").forEach((symbol, index) => {
      const duration = symbol === "." ? unitMs : unitMs * 3;
      const startTimer = window.setTimeout(() => {
        for (const group of groups) group[index]?.classList.add("is-playing");
      }, offset);
      const endTimer = window.setTimeout(() => {
        for (const group of groups) group[index]?.classList.remove("is-playing");
      }, offset + duration);
      signalTimers.push(startTimer, endTimer);
      offset += duration + unitMs;
    });
  }

  function playCurrentSignal() {
    const pattern = currentPattern();
    animateSignal(pattern);
    if (state.mode !== "learn") state.roundStartedAt = performance.now();

    if (!audio.playPattern(pattern, currentWpm())) {
      state.status = "Audio unavailable · follow the visible signal";
      context.render();
      announce("Audio is unavailable. The Morse pattern remains visible.");
    }
  }

  function answer(letter) {
    if (state.locked) return;
    if (state.clinicPair && !state.clinicPair.includes(letter)) {
      announce(`This clinic is comparing ${state.clinicPair.join(" and ")}.`);
      return;
    }
    if (state.mode === "sprint" && !state.running) {
      announce("Start the sprint before answering.");
      return;
    }

    const hit = letter === state.target;
    context.signalLab.recordPerformance(state.target, letter, hit, performance.now() - state.roundStartedAt);
    state.locked = true;
    state.typed = letter;
    state.feedback = hit ? "correct" : "incorrect";
    state.status = hit ? `Correct · ${letter}` : `Not quite · it was ${state.target}`;
    state.streak = hit ? state.streak + 1 : 0;
    state.correct += hit ? 1 : 0;
    state.total += 1;
    state.sprintScore += state.mode === "sprint" && hit ? 1 : 0;
    state.revealed = false;
    state.lastAnswer = letter;
    state.lastOutcome = hit ? "correct" : "incorrect";
    context.render();

    announce(hit ? `Correct. ${letter} is ${spokenPattern(MORSE[letter])}.` : `Not quite. The answer was ${state.target}.`);
    const delay = state.mode === "sprint" ? 340 : hit ? 760 : 1250;
    nextRoundTimer = window.setTimeout(() => newRound(true), delay);
  }

  function newRound(playAfterRender = false) {
    clearPendingRound();
    const pool = state.mode === "drill" ? currentPracticePool() : STARTER_POOL;
    state.target = randomLetter(state.target, pool);
    state.typed = "_";
    state.status = state.mode === "sprint" ? "Next signal" : "Listening";
    state.feedback = "neutral";
    state.revealed = false;
    state.locked = false;
    state.lastAnswer = null;
    state.lastOutcome = null;
    state.roundStartedAt = performance.now();
    context.render();
    if (playAfterRender && (state.mode !== "sprint" || state.running)) playCurrentSignal();
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
    state.typed = state.target;
    state.status = `Hint · ${state.target} is ${visiblePattern(MORSE[state.target])}`;
    state.feedback = "neutral";
    state.lastAnswer = state.target;
    state.lastOutcome = "correct";
    context.render();
    announce(`Hint. The answer is ${state.target}, ${spokenPattern(MORSE[state.target])}.`);
  }

  function changeLesson(direction) {
    state.learnIndex = (state.learnIndex + direction + STARTER_POOL.length) % STARTER_POOL.length;
    state.status = "Guided lesson";
    context.render();
    playCurrentSignal();
    announce(`Lesson ${state.learnIndex + 1}. Letter ${currentLetter()}.`);
  }

  function startSprint() {
    clearPendingRound();
    stopSprint();
    state.running = true;
    state.timeLeft = SPRINT_SECONDS;
    state.sprintScore = 0;
    state.streak = 0;
    state.typed = "_";
    state.status = "Go";
    state.feedback = "neutral";
    state.revealed = false;
    state.locked = false;
    state.lastAnswer = null;
    state.lastOutcome = null;
    state.clinicPair = null;
    state.target = randomLetter(state.target, STARTER_POOL);
    state.roundStartedAt = performance.now();
    state.sprintDeadline = performance.now() + SPRINT_SECONDS * 1000;
    context.render();
    announce("Sprint started. You have 30 seconds.");
    playCurrentSignal();
    sprintTimer = window.setInterval(updateSprint, 100);
  }

  function updateSprint() {
    if (!state.running) return;
    state.timeLeft = Math.max(0, (state.sprintDeadline - performance.now()) / 1000);
    if (state.timeLeft <= 0) {
      finishSprint();
      return;
    }
    // The 100 ms sprint tick only changes trainer UI; avoid repainting the lab and guide.
    render();
  }

  function finishSprint() {
    stopSprint();
    clearPendingRound();
    state.timeLeft = 0;
    state.locked = true;
    state.typed = "_";
    state.status = `Time up · ${state.sprintScore} ${state.sprintScore === 1 ? "letter" : "letters"}`;
    state.feedback = "neutral";
    state.sprintBest = Math.max(state.sprintBest, state.sprintScore);
    storage.set(STORAGE_KEYS.sprintBest, state.sprintBest);
    context.render();
    announce(`Time up. You decoded ${state.sprintScore} ${state.sprintScore === 1 ? "letter" : "letters"}.`);
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

  function launchDrill(clinicPair = null) {
    clearPendingRound();
    stopSprint();
    state.clinicPair = clinicPair;
    state.mode = "drill";
    state.onboardingMode = "drill";
    state.running = false;
    state.timeLeft = SPRINT_SECONDS;
    state.sprintScore = 0;
    storage.set(STORAGE_KEYS.mode, "drill");
    syncUrl();
    newRound(true);
    focusTrainer(elements.signalButton);
    announce(clinicPair
      ? `Clinic started. Listen for the difference between ${clinicPair[0]} and ${clinicPair[1]}.`
      : "Full starter alphabet drill started.");
  }

  function handleKeydown(event) {
    if (state.onboardingOpen) return;
    const target = event.target;
    const isInteractiveControl = target instanceof Element && target.closest("button, input, textarea, a, [role='listbox']");
    if (isInteractiveControl) return;

    if (event.code === "Space") {
      event.preventDefault();
      playCurrentSignal();
      return;
    }
    if (event.key === "Enter" && state.mode !== "learn") {
      event.preventDefault();
      showHintOrAdvance();
      return;
    }
    if (state.mode === "learn" && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      changeLesson(event.key === "ArrowRight" ? 1 : -1);
      return;
    }

    const letter = event.key.toUpperCase();
    if (state.mode !== "learn" && STARTER_POOL.includes(letter)) {
      event.preventDefault();
      answer(letter);
    }
  }

  function bind() {
    for (const button of elements.themeButtons) {
      button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
    }
    for (const button of elements.modeButtons) {
      button.addEventListener("click", () => setMode(button.dataset.mode));
    }
    elements.signalButton.addEventListener("click", playCurrentSignal);
    elements.replayButton.addEventListener("click", playCurrentSignal);
    elements.mainAction.addEventListener("click", showHintOrAdvance);
    elements.hearLesson.addEventListener("click", playCurrentSignal);
    elements.previousLesson.addEventListener("click", () => changeLesson(-1));
    elements.nextLesson.addEventListener("click", () => changeLesson(1));
    document.addEventListener("keydown", handleKeydown);
  }

  return Object.freeze({
    answer,
    bind,
    clearSignalAnimation,
    focusTrainer,
    launchDrill,
    playCurrentSignal,
    render,
    renderCoach,
    setDifficulty,
    setMode,
    setTheme,
    stopSprint,
    syncUrl,
    themeLabel,
    unitSeconds,
    updateSprint,
  });
}
