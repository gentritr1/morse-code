const MORSE = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
};

const POOL = ["E", "T", "A", "N", "K", "M", "S", "O", "I", "R"];
const SPRINT_SECONDS = 30;
const STORAGE_KEYS = {
  theme: "morse-trainer-theme",
  mode: "morse-trainer-mode",
  difficulty: "morse-trainer-difficulty",
  onboarding: "morse-trainer-onboarding-complete",
  sprintBest: "morse-trainer-sprint-best",
};

const NOTES = {
  E: "One dot. E is the most common letter in English, so Morse gives it the shortest possible signal.",
  T: "One dash. The second most common letter, and the only other single-element character.",
  A: "Dot then dash. Short, then long. It is E followed by T.",
  N: "Dash then dot. The mirror of A. Confusing these two is a common beginner mistake.",
  K: "Dash dot dash. Operators send K to mean ‘go ahead’—your turn to transmit.",
  M: "Two dashes. T twice. It pairs with N as a long-and-short contrast.",
  S: "Three dots. With O it makes the distress call SOS.",
  O: "Three dashes. The long half of SOS: three short, three long, three short.",
  I: "Two dots. E twice. Hear it as one even beat, not a hesitation.",
  R: "Dot dash dot. A with a dot added to the end.",
};

const THEMES = {
  terminal: {
    title: "MORSE TRAINER v1.4",
    subtitle: "AMBER TERMINAL · SET 04",
    roster: "Starter alphabet",
  },
  teletext: {
    title: "MORSE 404",
    subtitle: "BROADCAST TELETEXT · PAGE 404",
    roster: "Page index",
  },
  pocket: {
    title: "CW-83",
    subtitle: "POCKET TRAINER · DESK UNIT",
    roster: "Alphabet bank",
  },
};

const DIFFICULTIES = {
  gentle: 8,
  steady: 13,
  brisk: 20,
};

const DIFFICULTY_DETAILS = {
  gentle: { label: "Gentle", meta: "8 WPM · clear spacing" },
  steady: { label: "Steady", meta: "13 WPM · recommended" },
  brisk: { label: "Brisk", meta: "20 WPM · fast recall" },
};

const MODE_GUIDANCE = {
  learn: {
    label: "Learn path",
    title: "Build one clean sound-to-letter connection.",
    steps: ["Hear it", "See the shape", "Move on"],
  },
  drill: {
    label: "Drill path",
    title: "Turn recognition into fast, reliable recall.",
    steps: ["Listen", "Choose a letter", "Read feedback"],
  },
  sprint: {
    label: "Sprint path",
    title: "Measure how many signals you recognize under time.",
    steps: ["Start 30 sec", "Decode quickly", "Beat your best"],
  },
};

const initialTheme = readInitialTheme();
const initialMode = readInitialMode();
const initialDifficulty = readInitialDifficulty();

const elements = {
  machine: document.querySelector("#machine"),
  machineTitle: document.querySelector("#machineTitle"),
  machineSubtitle: document.querySelector("#machineSubtitle"),
  rosterTitle: document.querySelector("#rosterTitle"),
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  themeButtons: [...document.querySelectorAll("[data-theme-choice]")],
  guideButton: document.querySelector("#guideButton"),
  onboarding: document.querySelector("#onboarding"),
  onboardingSteps: [...document.querySelectorAll("[data-onboarding-step]")],
  onboardingProgress: [...document.querySelectorAll("[data-progress-step]")],
  onboardingNext: [...document.querySelectorAll("[data-onboarding-next]")],
  onboardingBack: [...document.querySelectorAll("[data-onboarding-back]")],
  onboardingSkip: [...document.querySelectorAll("[data-skip-onboarding]")],
  onboardingModes: [...document.querySelectorAll("[data-onboarding-mode]")],
  onboardingThemes: [...document.querySelectorAll("[data-onboarding-theme]")],
  firstSignalButton: document.querySelector("#firstSignalButton"),
  firstSignalPattern: document.querySelector("#firstSignalPattern"),
  firstSignalState: document.querySelector("#firstSignalState"),
  finishOnboarding: document.querySelector("#finishOnboarding"),
  speedPicker: document.querySelector("#speedPicker"),
  speedTrigger: document.querySelector("#speedTrigger"),
  speedMenu: document.querySelector("#speedMenu"),
  speedValue: document.querySelector("#speedValue"),
  speedMeta: document.querySelector("#speedMeta"),
  difficultyOptions: [...document.querySelectorAll("[data-difficulty]")],
  coachMode: document.querySelector("#coachMode"),
  coachTitle: document.querySelector("#coachTitle"),
  coachSteps: document.querySelector("#coachSteps"),
  speedStat: document.querySelector("#speedStat"),
  accuracyStat: document.querySelector("#accuracyStat"),
  streakStat: document.querySelector("#streakStat"),
  sessionScore: document.querySelector("#sessionScore"),
  bestScore: document.querySelector("#bestScore"),
  roster: document.querySelector("#roster"),
  sprintPanel: document.querySelector("#sprintPanel"),
  clock: document.querySelector("#clock"),
  sprintScore: document.querySelector("#sprintScore"),
  timeTrack: document.querySelector(".time-track"),
  timeBar: document.querySelector("#timeBar"),
  learnView: document.querySelector("#learnView"),
  practiceView: document.querySelector("#practiceView"),
  lessonStep: document.querySelector("#lessonStep"),
  lessonPatternText: document.querySelector("#lessonPatternText"),
  lessonLetter: document.querySelector("#lessonLetter"),
  lessonSignal: document.querySelector("#lessonSignal"),
  lessonSpoken: document.querySelector("#lessonSpoken"),
  lessonNote: document.querySelector("#lessonNote"),
  previousLesson: document.querySelector("#previousLesson"),
  hearLesson: document.querySelector("#hearLesson"),
  nextLesson: document.querySelector("#nextLesson"),
  statusLine: document.querySelector("#statusLine"),
  signalButton: document.querySelector("#signalButton"),
  signalText: document.querySelector("#signalText"),
  signalBars: document.querySelector("#signalBars"),
  typedAnswer: document.querySelector("#typedAnswer"),
  replayButton: document.querySelector("#replayButton"),
  mainAction: document.querySelector("#mainAction"),
  answerDeck: document.querySelector("#answerDeck"),
  answerGrid: document.querySelector("#answerGrid"),
  footerMode: document.querySelector("#footerMode"),
  footerResult: document.querySelector("#footerResult"),
  liveStatus: document.querySelector("#liveStatus"),
};

const state = {
  theme: initialTheme,
  mode: initialMode,
  difficulty: initialDifficulty,
  onboardingOpen: !readOnboardingCompleted(),
  onboardingStep: 1,
  onboardingMode: initialMode,
  onboardingTheme: initialTheme,
  target: randomLetter(),
  learnIndex: 0,
  typed: "_",
  status: initialMode === "learn" ? "Guided lesson" : initialMode === "sprint" ? "Press start when ready" : "Listening",
  feedback: "neutral",
  streak: 0,
  correct: 0,
  total: 0,
  revealed: false,
  locked: false,
  running: false,
  timeLeft: SPRINT_SECONDS,
  sprintScore: 0,
  sprintBest: readStoredNumber(STORAGE_KEYS.sprintBest),
  sprintDeadline: 0,
  lastAnswer: null,
  lastOutcome: null,
};

let audioContext = null;
let sprintTimer = null;
let nextRoundTimer = null;
let signalTimers = [];
let onboardingSignalTimers = [];

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme);
    return Object.hasOwn(THEMES, stored) ? stored : "terminal";
  } catch {
    return "terminal";
  }
}

function readInitialTheme() {
  const requested = new URLSearchParams(window.location.search).get("theme");
  return Object.hasOwn(THEMES, requested) ? requested : readStoredTheme();
}

function readInitialMode() {
  const requested = new URLSearchParams(window.location.search).get("mode");
  if (["learn", "drill", "sprint"].includes(requested)) return requested;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.mode);
    if (["learn", "drill", "sprint"].includes(stored)) return stored;
  } catch {
    // A sensible first-run default is available without storage.
  }

  return "learn";
}

function readInitialDifficulty() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.difficulty);
    return Object.hasOwn(DIFFICULTIES, stored) ? stored : "steady";
  } catch {
    return "steady";
  }
}

function readOnboardingCompleted() {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.onboarding) === "true";
  } catch {
    return false;
  }
}

function readStoredNumber(key) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function storeValue(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // The trainer remains fully usable when storage is unavailable.
  }
}

function randomLetter(exclude = null) {
  const choices = exclude ? POOL.filter((letter) => letter !== exclude) : POOL;
  return choices[Math.floor(Math.random() * choices.length)];
}

function currentLetter() {
  return state.mode === "learn" ? POOL[state.learnIndex] : state.target;
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

function visiblePattern(pattern) {
  return pattern
    .split("")
    .map((symbol) => (symbol === "." ? "·" : "—"))
    .join(" ");
}

function spokenPattern(pattern) {
  return pattern
    .split("")
    .map((symbol, index) => {
      if (symbol === "-") return "dah";
      return index === pattern.length - 1 ? "dit" : "di";
    })
    .join(" ");
}

function createSignalMark(symbol, textMode = false) {
  const mark = document.createElement("span");
  mark.dataset.symbol = symbol;
  if (symbol === "-") mark.classList.add("dash");
  if (textMode) {
    mark.classList.add("symbol-char");
    mark.textContent = symbol === "." ? "·" : "—";
  }
  return mark;
}

function renderSignal(container, pattern, textMode = false) {
  const renderKey = `${pattern}:${textMode ? "text" : "bars"}`;
  if (container.dataset.renderKey === renderKey) return;

  const marks = pattern.split("").map((symbol) => createSignalMark(symbol, textMode));
  container.replaceChildren(...marks);
  container.dataset.renderKey = renderKey;
}

function buildRoster() {
  const rows = POOL.map((letter) => {
    const row = document.createElement("li");
    row.dataset.letter = letter;

    const letterCell = document.createElement("strong");
    letterCell.textContent = letter;

    const patternCell = document.createElement("span");
    patternCell.className = "roster-pattern";
    patternCell.textContent = visiblePattern(MORSE[letter]);

    row.append(letterCell, patternCell);
    return row;
  });

  elements.roster.replaceChildren(...rows);
}

function buildAnswerGrid() {
  const buttons = POOL.map((letter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-key";
    button.dataset.letter = letter;
    button.textContent = letter;
    button.setAttribute("aria-label", `Answer ${letter}`);
    button.addEventListener("click", () => answer(letter));
    return button;
  });

  elements.answerGrid.replaceChildren(...buttons);
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
  elements.footerMode.textContent = `${state.mode.toUpperCase()} MODE`;
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

  elements.lessonStep.textContent = `Lesson ${state.learnIndex + 1} of ${POOL.length}`;
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
    button.disabled = !answersEnabled;
    const isCorrectChoice = button.dataset.letter === state.target && state.lastOutcome !== null;
    button.classList.toggle("was-correct", isCorrectChoice);
    button.classList.toggle("was-incorrect", button.dataset.letter === state.lastAnswer && state.lastOutcome === "incorrect");
  }

  renderCoach();
  renderOnboarding();
}

function renderCoach() {
  const displayedMode = state.onboardingOpen ? state.onboardingMode : state.mode;
  const guidance = MODE_GUIDANCE[displayedMode];
  elements.coachMode.textContent = guidance.label;
  elements.coachTitle.textContent = guidance.title;

  [...elements.coachSteps.children].forEach((item, index) => {
    const label = item.querySelector("span");
    if (label) label.textContent = guidance.steps[index];
  });
}

function renderOnboarding() {
  elements.onboarding.hidden = !state.onboardingOpen;
  document.body.dataset.onboarding = state.onboardingOpen ? "open" : "closed";
  elements.guideButton.setAttribute("aria-expanded", String(state.onboardingOpen));

  for (const step of elements.onboardingSteps) {
    step.hidden = Number(step.dataset.onboardingStep) !== state.onboardingStep;
  }

  for (const step of elements.onboardingProgress) {
    const stepNumber = Number(step.dataset.progressStep);
    step.dataset.state = stepNumber === state.onboardingStep ? "active" : stepNumber < state.onboardingStep ? "complete" : "upcoming";
  }

  for (const button of elements.onboardingModes) {
    button.setAttribute("aria-pressed", String(button.dataset.onboardingMode === state.onboardingMode));
  }

  for (const button of elements.onboardingThemes) {
    button.setAttribute("aria-pressed", String(button.dataset.onboardingTheme === state.onboardingTheme));
  }

  renderCoach();
}

function isRosterAnswerVisible() {
  return state.mode === "learn" || state.lastOutcome !== null;
}

function mainActionLabel() {
  if (state.mode === "sprint") return state.running ? "Restart sprint" : "Start sprint";
  return state.revealed ? "Next signal" : "Show hint";
}

function announce(message) {
  elements.liveStatus.textContent = "";
  window.requestAnimationFrame(() => {
    elements.liveStatus.textContent = message;
  });
}

function setTheme(theme) {
  if (!Object.hasOwn(THEMES, theme) || theme === state.theme) return;
  clearSignalAnimation();
  state.theme = theme;
  state.onboardingTheme = theme;
  storeValue(STORAGE_KEYS.theme, theme);
  render();
  syncUrl();
  announce(`${themeLabel(theme)} theme selected. Your session is unchanged.`);
}

function themeLabel(theme) {
  return theme === "pocket" ? "Pocket Trainer" : theme[0].toUpperCase() + theme.slice(1);
}

function setMode(mode) {
  if (!["learn", "drill", "sprint"].includes(mode) || mode === state.mode) return;
  clearPendingRound();
  stopSprint();
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
  state.status = mode === "learn" ? "Guided lesson" : mode === "sprint" ? "Press start when ready" : "Listening";
  render();
  storeValue(STORAGE_KEYS.mode, mode);
  syncUrl();
  announce(`${mode[0].toUpperCase() + mode.slice(1)} mode selected.`);
}

function syncUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("theme", state.theme);
  url.searchParams.set("mode", state.mode);
  window.history.replaceState(null, "", url);
}

function setDifficulty(difficulty) {
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) return;
  state.difficulty = difficulty;
  storeValue(STORAGE_KEYS.difficulty, difficulty);
  render();
  announce(`Speed set to ${currentWpm()} words per minute.`);
}

function playCurrentSignal() {
  const pattern = currentPattern();
  animateSignal(pattern);

  if (!playPatternAudio(pattern)) {
    state.status = "Audio unavailable · follow the visible signal";
    render();
    announce("Audio is unavailable. The Morse pattern remains visible.");
  }
}

function playPatternAudio(pattern) {

  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error("AudioContext unavailable");
    if (!audioContext) audioContext = new Context();
    if (audioContext.state === "suspended") audioContext.resume();

    const unit = unitSeconds();
    let time = audioContext.currentTime + 0.06;

    for (const symbol of pattern) {
      const duration = symbol === "." ? unit : unit * 3;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 600;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 0.008);
      gain.gain.setValueAtTime(0.2, Math.max(time + 0.008, time + duration - 0.008));
      gain.gain.linearRampToValueAtTime(0, time + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
      time += duration + unit;
    }
    return true;
  } catch {
    return false;
  }
}

function playOnboardingSignal() {
  clearOnboardingSignalAnimation();
  const marks = [...elements.firstSignalPattern.children];
  const pattern = MORSE.A;
  let offset = 60;
  const unitMs = unitSeconds() * 1000;

  pattern.split("").forEach((symbol, index) => {
    const duration = symbol === "." ? unitMs : unitMs * 3;
    const startTimer = window.setTimeout(() => marks[index]?.classList.add("is-playing"), offset);
    const endTimer = window.setTimeout(() => marks[index]?.classList.remove("is-playing"), offset + duration);
    onboardingSignalTimers.push(startTimer, endTimer);
    offset += duration + unitMs;
  });

  const hasAudio = playPatternAudio(pattern);
  elements.firstSignalState.textContent = hasAudio ? "That was A · short, then long" : "Audio is unavailable · follow the moving pattern";
  announce(hasAudio ? "You heard A: di-dah, short then long." : "Audio is unavailable. A remains visible as dot dash.");
}

function clearOnboardingSignalAnimation() {
  for (const timer of onboardingSignalTimers) window.clearTimeout(timer);
  onboardingSignalTimers = [];
  for (const mark of elements.firstSignalPattern.children) mark.classList.remove("is-playing");
}

function animateSignal(pattern) {
  clearSignalAnimation();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

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

function clearSignalAnimation() {
  for (const timer of signalTimers) window.clearTimeout(timer);
  signalTimers = [];
  for (const mark of document.querySelectorAll(".is-playing")) mark.classList.remove("is-playing");
}

function answer(letter) {
  if (state.locked) return;
  if (state.mode === "sprint" && !state.running) {
    announce("Start the sprint before answering.");
    return;
  }

  const hit = letter === state.target;
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
  render();

  announce(hit ? `Correct. ${letter} is ${spokenPattern(MORSE[letter])}.` : `Not quite. The answer was ${state.target}.`);
  const delay = state.mode === "sprint" ? 340 : hit ? 760 : 1250;
  nextRoundTimer = window.setTimeout(() => newRound(true), delay);
}

function newRound(playAfterRender = false) {
  clearPendingRound();
  state.target = randomLetter(state.target);
  state.typed = "_";
  state.status = state.mode === "sprint" ? "Next signal" : "Listening";
  state.feedback = "neutral";
  state.revealed = false;
  state.locked = false;
  state.lastAnswer = null;
  state.lastOutcome = null;
  render();
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
  render();
  announce(`Hint. The answer is ${state.target}, ${spokenPattern(MORSE[state.target])}.`);
}

function changeLesson(direction) {
  state.learnIndex = (state.learnIndex + direction + POOL.length) % POOL.length;
  state.status = "Guided lesson";
  render();
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
  state.target = randomLetter(state.target);
  state.sprintDeadline = performance.now() + SPRINT_SECONDS * 1000;
  render();
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
  storeValue(STORAGE_KEYS.sprintBest, state.sprintBest);
  render();
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

function setOnboardingStep(step) {
  const nextStep = Math.min(3, Math.max(1, step));
  if (nextStep === state.onboardingStep) return;
  state.onboardingStep = nextStep;
  renderOnboarding();
  const nextFocus = nextStep === 1
    ? elements.firstSignalButton
    : nextStep === 2
      ? elements.onboardingModes.find((button) => button.getAttribute("aria-pressed") === "true")
      : elements.onboardingThemes.find((button) => button.getAttribute("aria-pressed") === "true");
  nextFocus?.focus({ preventScroll: true });
}

function openOnboarding() {
  if (state.running) {
    stopSprint();
    state.locked = true;
    state.status = "Sprint paused · restart when ready";
    render();
  }

  clearOnboardingSignalAnimation();
  elements.firstSignalState.textContent = "Tap to hear your first signal";
  state.onboardingOpen = true;
  state.onboardingStep = 1;
  state.onboardingMode = state.mode;
  state.onboardingTheme = state.theme;
  renderOnboarding();
  elements.onboarding.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
  elements.firstSignalButton.focus({ preventScroll: true });
}

function dismissOnboarding() {
  clearOnboardingSignalAnimation();
  state.onboardingOpen = false;
  storeValue(STORAGE_KEYS.onboarding, true);
  renderOnboarding();
  focusTrainer(state.mode === "learn" ? elements.hearLesson : state.mode === "sprint" ? elements.mainAction : elements.signalButton);
  announce("Guide closed. You can reopen it from How it works.");
}

function finishOnboarding() {
  const selectedMode = state.onboardingMode;
  const selectedTheme = state.onboardingTheme;
  clearOnboardingSignalAnimation();
  state.onboardingOpen = false;
  storeValue(STORAGE_KEYS.onboarding, true);

  if (selectedTheme !== state.theme) setTheme(selectedTheme);
  if (selectedMode !== state.mode) setMode(selectedMode);
  render();

  if (selectedMode !== "sprint") playCurrentSignal();
  focusTrainer(selectedMode === "learn" ? elements.hearLesson : selectedMode === "sprint" ? elements.mainAction : elements.signalButton);
  announce(
    selectedMode === "sprint"
      ? `${themeLabel(selectedTheme)} is ready. Press Start sprint when you are ready.`
      : `${themeLabel(selectedTheme)} is ready. Your first ${selectedMode} signal is playing.`,
  );
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

function positionSpeedMenu() {
  const triggerRect = elements.speedTrigger.getBoundingClientRect();
  const viewportGutter = 12;
  const menuWidth = Math.min(Math.max(320, triggerRect.width), window.innerWidth - viewportGutter * 2);
  const estimatedMenuHeight = 208;
  const left = Math.max(
    viewportGutter,
    Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - viewportGutter),
  );
  const fitsBelow = triggerRect.bottom + estimatedMenuHeight + 8 <= window.innerHeight;
  const top = fitsBelow
    ? triggerRect.bottom + 8
    : Math.max(viewportGutter, triggerRect.top - estimatedMenuHeight - 8);

  elements.speedMenu.style.setProperty("--menu-width", `${menuWidth}px`);
  elements.speedMenu.style.setProperty("--menu-left", `${left}px`);
  elements.speedMenu.style.setProperty("--menu-top", `${top}px`);
  elements.speedMenu.style.transformOrigin = fitsBelow ? "top right" : "bottom right";
}

function speedMenuIsOpen() {
  return elements.speedMenu.matches(":popover-open");
}

function openSpeedMenu(focusLast = false) {
  positionSpeedMenu();
  if (!speedMenuIsOpen()) elements.speedMenu.showPopover();

  window.requestAnimationFrame(() => {
    const target = focusLast
      ? elements.difficultyOptions.at(-1)
      : elements.difficultyOptions.find((option) => option.dataset.difficulty === state.difficulty);
    target?.focus();
  });
}

function selectDifficulty(difficulty) {
  setDifficulty(difficulty);
  if (speedMenuIsOpen()) elements.speedMenu.hidePopover();
  elements.speedTrigger.focus();
}

function handleSpeedTriggerKeydown(event) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  openSpeedMenu(event.key === "ArrowUp" || event.key === "End");
}

function handleSpeedMenuKeydown(event) {
  const activeIndex = elements.difficultyOptions.indexOf(document.activeElement);
  let nextIndex = activeIndex;

  if (["Enter", " "].includes(event.key) && activeIndex >= 0) {
    event.preventDefault();
    selectDifficulty(elements.difficultyOptions[activeIndex].dataset.difficulty);
    return;
  }

  if (event.key === "ArrowDown") nextIndex = Math.min(elements.difficultyOptions.length - 1, activeIndex + 1);
  else if (event.key === "ArrowUp") nextIndex = Math.max(0, activeIndex - 1);
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = elements.difficultyOptions.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    elements.speedMenu.hidePopover();
    elements.speedTrigger.focus();
    return;
  } else {
    return;
  }

  event.preventDefault();
  elements.difficultyOptions[nextIndex]?.focus();
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
  if (state.mode !== "learn" && POOL.includes(letter)) {
    event.preventDefault();
    answer(letter);
  }
}

function bindEvents() {
  for (const button of elements.themeButtons) {
    button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
  }

  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  elements.guideButton.addEventListener("click", () => {
    if (state.onboardingOpen) dismissOnboarding();
    else openOnboarding();
  });

  for (const button of elements.onboardingNext) {
    button.addEventListener("click", () => setOnboardingStep(state.onboardingStep + 1));
  }

  for (const button of elements.onboardingBack) {
    button.addEventListener("click", () => setOnboardingStep(state.onboardingStep - 1));
  }

  for (const button of elements.onboardingSkip) {
    button.addEventListener("click", dismissOnboarding);
  }

  for (const button of elements.onboardingModes) {
    button.addEventListener("click", () => {
      state.onboardingMode = button.dataset.onboardingMode;
      renderOnboarding();
    });
  }

  for (const button of elements.onboardingThemes) {
    button.addEventListener("click", () => {
      state.onboardingTheme = button.dataset.onboardingTheme;
      renderOnboarding();
    });
  }

  elements.firstSignalButton.addEventListener("click", playOnboardingSignal);
  elements.finishOnboarding.addEventListener("click", finishOnboarding);

  elements.speedTrigger.addEventListener("click", positionSpeedMenu);
  elements.speedTrigger.addEventListener("keydown", handleSpeedTriggerKeydown);
  elements.speedMenu.addEventListener("keydown", handleSpeedMenuKeydown);
  elements.speedMenu.addEventListener("toggle", (event) => {
    const isOpen = event.newState === "open";
    elements.speedTrigger.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) positionSpeedMenu();
  });

  for (const option of elements.difficultyOptions) {
    option.addEventListener("click", () => selectDifficulty(option.dataset.difficulty));
  }

  elements.signalButton.addEventListener("click", playCurrentSignal);
  elements.replayButton.addEventListener("click", playCurrentSignal);
  elements.mainAction.addEventListener("click", showHintOrAdvance);
  elements.hearLesson.addEventListener("click", playCurrentSignal);
  elements.previousLesson.addEventListener("click", () => changeLesson(-1));
  elements.nextLesson.addEventListener("click", () => changeLesson(1));
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.running) updateSprint();
  });
  window.addEventListener("resize", () => {
    if (speedMenuIsOpen()) positionSpeedMenu();
  });
}

buildRoster();
buildAnswerGrid();
bindEvents();
render();
