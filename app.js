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
  performance: "morse-trainer-performance-v1",
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
  answerHint: document.querySelector("#answerHint"),
  signalLab: document.querySelector("#signalLab"),
  labTabs: [...document.querySelectorAll("[data-lab-view]")],
  labPanels: [...document.querySelectorAll("[data-lab-panel]")],
  profileStatus: document.querySelector("#profileStatus"),
  labAttemptSummary: document.querySelector("#labAttemptSummary"),
  mirrorTargetLabel: document.querySelector("#mirrorTargetLabel"),
  mirrorReplay: document.querySelector("#mirrorReplay"),
  mirrorSequence: document.querySelector("#mirrorSequence"),
  mirrorPad: document.querySelector("#mirrorPad"),
  mirrorClear: document.querySelector("#mirrorClear"),
  mirrorCheck: document.querySelector("#mirrorCheck"),
  mirrorResult: document.querySelector("#mirrorResult"),
  fingerprintSummary: document.querySelector("#fingerprintSummary"),
  fingerprintStart: document.querySelector("#fingerprintStart"),
  fingerprintReset: document.querySelector("#fingerprintReset"),
  fingerprintEmpty: document.querySelector("#fingerprintEmpty"),
  fingerprintProgress: document.querySelector("#fingerprintProgress"),
  fingerprintTable: document.querySelector("#fingerprintTable"),
  fingerprintRows: document.querySelector("#fingerprintRows"),
  clinicEmpty: document.querySelector("#clinicEmpty"),
  clinicReady: document.querySelector("#clinicReady"),
  clinicProgressBar: document.querySelector("#clinicProgressBar"),
  clinicProgressText: document.querySelector("#clinicProgressText"),
  clinicStartDrill: document.querySelector("#clinicStartDrill"),
  clinicTargetLetter: document.querySelector("#clinicTargetLetter"),
  clinicTargetPattern: document.querySelector("#clinicTargetPattern"),
  clinicAnswerLetter: document.querySelector("#clinicAnswerLetter"),
  clinicAnswerPattern: document.querySelector("#clinicAnswerPattern"),
  clinicInsight: document.querySelector("#clinicInsight"),
  clinicPractice: document.querySelector("#clinicPractice"),
  clinicExit: document.querySelector("#clinicExit"),
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
  roundStartedAt: performance.now(),
  performanceProfile: readPerformanceProfile(),
  labView: "mirror",
  mirrorTarget: randomLetter(),
  mirrorMarks: [],
  mirrorEvaluated: false,
  mirrorResult: "Hear the target, then repeat its rhythm.",
  mirrorOutcome: "neutral",
  mirrorPressStartedAt: 0,
  mirrorPointerId: null,
  mirrorKeyboardPressed: false,
  clinicPair: null,
  profileResetArmed: false,
};

let audioContext = null;
let sprintTimer = null;
let nextRoundTimer = null;
let signalTimers = [];
let onboardingSignalTimers = [];
let liveTone = null;
let profileResetTimer = null;

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

function emptyLetterMetrics() {
  return {
    attempts: 0,
    correct: 0,
    totalResponseMs: 0,
    fastestMs: 0,
    confusions: {},
    mirrorAttempts: 0,
    mirrorScoreTotal: 0,
  };
}

function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function readPerformanceProfile() {
  const letters = Object.fromEntries(POOL.map((letter) => [letter, emptyLetterMetrics()]));

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.performance));
    if (!stored || typeof stored !== "object" || !stored.letters) return { letters };

    for (const letter of POOL) {
      const source = stored.letters[letter];
      if (!source || typeof source !== "object") continue;

      const confusions = {};
      if (source.confusions && typeof source.confusions === "object") {
        for (const answer of POOL) {
          const count = safeCount(source.confusions[answer]);
          if (count) confusions[answer] = count;
        }
      }

      letters[letter] = {
        attempts: safeCount(source.attempts),
        correct: safeCount(source.correct),
        totalResponseMs: safeCount(source.totalResponseMs),
        fastestMs: safeCount(source.fastestMs),
        confusions,
        mirrorAttempts: safeCount(source.mirrorAttempts),
        mirrorScoreTotal: safeCount(source.mirrorScoreTotal),
      };
    }
  } catch {
    // A fresh, local profile is a safe fallback when stored data is unavailable.
  }

  return { letters };
}

function persistPerformanceProfile() {
  try {
    window.localStorage.setItem(STORAGE_KEYS.performance, JSON.stringify(state.performanceProfile));
  } catch {
    // Adaptive features keep working for the current visit without storage.
  }
}

function randomLetter(exclude = null, pool = POOL) {
  const availablePool = Array.isArray(pool) && pool.length ? pool : POOL;
  const choices = exclude && availablePool.length > 1
    ? availablePool.filter((letter) => letter !== exclude)
    : availablePool;
  return choices[Math.floor(Math.random() * choices.length)];
}

function currentPracticePool() {
  return state.mode === "drill" && state.clinicPair ? state.clinicPair : POOL;
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

function performanceTotals() {
  return POOL.reduce(
    (totals, letter) => {
      const metrics = state.performanceProfile.letters[letter];
      totals.attempts += metrics.attempts;
      totals.correct += metrics.correct;
      totals.mirrorAttempts += metrics.mirrorAttempts;
      return totals;
    },
    { attempts: 0, correct: 0, mirrorAttempts: 0 },
  );
}

function totalMistakes() {
  return POOL.reduce((total, letter) => {
    const metrics = state.performanceProfile.letters[letter];
    return total + Math.max(0, metrics.attempts - metrics.correct);
  }, 0);
}

function averageResponseMs(metrics) {
  return metrics.attempts ? metrics.totalResponseMs / metrics.attempts : 0;
}

function recognitionScore(metrics) {
  if (!metrics.attempts) return 0;
  const accuracy = metrics.correct / metrics.attempts;
  const evidence = Math.min(1, metrics.attempts / 5);
  const responseSeconds = averageResponseMs(metrics) / 1000;
  const speed = Math.max(0, Math.min(1, 1 - (responseSeconds - 1) / 7));
  return evidence * accuracy * (0.78 + speed * 0.22);
}

function recognitionLabel(metrics) {
  if (!metrics.attempts) return "Unheard";
  if (metrics.attempts < 3) return "Sampling";

  const accuracy = metrics.correct / metrics.attempts;
  const averageMs = averageResponseMs(metrics);
  if (accuracy >= 0.9 && averageMs <= 2500) return "Reliable";
  if (accuracy >= 0.7) return "Building";
  return "Needs contrast";
}

function topConfusion() {
  if (totalMistakes() < 2) return null;

  let result = null;
  for (const target of POOL) {
    const confusions = state.performanceProfile.letters[target].confusions;
    for (const answer of POOL) {
      const count = safeCount(confusions[answer]);
      if (!count || target === answer) continue;
      if (!result || count > result.count) result = { target, answer, count };
    }
  }
  return result;
}

function confusionInsight(target, answer) {
  const targetPattern = MORSE[target];
  const answerPattern = MORSE[answer];
  if (targetPattern.split("").reverse().join("") === answerPattern) {
    return "These signals reverse the same marks. Listen for which sound arrives first; the clinic will alternate their order.";
  }
  if (targetPattern[0] === answerPattern[0]) {
    return "These signals share the same opening. Keep listening past the first mark and let the ending make the decision.";
  }
  if (targetPattern.length !== answerPattern.length) {
    return "These signals use a different number of marks. Hear the whole phrase before choosing the letter.";
  }
  return "These signals have a similar silhouette but a different rhythm. Contrast practice will make the change easier to hear.";
}

function renderMirrorSequence() {
  const targetLength = MORSE[state.mirrorTarget].length;
  const renderKey = `${state.mirrorMarks.map((mark) => mark.symbol).join("")}:${targetLength}:${state.mirrorEvaluated}`;
  if (elements.mirrorSequence.dataset.renderKey === renderKey) return;

  const marks = [];
  for (const mark of state.mirrorMarks) {
    const item = document.createElement("span");
    item.className = `mirror-mark${mark.symbol === "-" ? " dash" : ""}`;
    item.setAttribute("aria-hidden", "true");
    marks.push(item);
  }
  for (let index = state.mirrorMarks.length; index < targetLength; index += 1) {
    const placeholder = document.createElement("span");
    placeholder.className = "mirror-mark placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    marks.push(placeholder);
  }

  const spokenMarks = state.mirrorMarks.length
    ? state.mirrorMarks.map((mark) => (mark.symbol === "." ? "dot" : "dash")).join(", ")
    : "No marks recorded yet";
  elements.mirrorSequence.replaceChildren(...marks);
  elements.mirrorSequence.setAttribute("aria-label", spokenMarks);
  elements.mirrorSequence.dataset.renderKey = renderKey;
}

function renderFingerprint() {
  const totals = performanceTotals();
  const isReady = totals.attempts >= 3;
  elements.fingerprintEmpty.hidden = isReady;
  elements.fingerprintTable.hidden = !isReady;
  elements.fingerprintProgress.textContent = `${Math.min(3, totals.attempts)} of 3 signals logged`;
  elements.fingerprintStart.textContent = isReady ? "Continue drilling" : "Start a drill";
  elements.fingerprintReset.hidden = totals.attempts + totals.mirrorAttempts === 0;
  elements.fingerprintReset.textContent = state.profileResetArmed ? "Confirm reset" : "Reset profile";

  const profiles = POOL.map((letter) => {
    const metrics = state.performanceProfile.letters[letter];
    return { letter, metrics, score: recognitionScore(metrics) };
  });
  const attemptedProfiles = profiles.filter((profile) => profile.metrics.attempts > 0);

  if (isReady && attemptedProfiles.length) {
    const highestAccuracy = Math.max(...attemptedProfiles.map(({ metrics }) => metrics.correct / metrics.attempts));
    const strongest = [...attemptedProfiles].sort((a, b) => b.score - a.score)[0];
    const weakest = [...attemptedProfiles].sort((a, b) => a.score - b.score)[0];
    elements.fingerprintSummary.textContent = highestAccuracy === 0
      ? "The profile found response-time differences, but no signal is reliable yet. Open the clinic to turn misses into contrast practice."
      : strongest.letter === weakest.letter
      ? `${strongest.letter} has the clearest signal so far. Keep sampling the set to reveal a stronger contrast.`
      : `${strongest.letter} is settling fastest. ${weakest.letter} is the most useful signal to practice next.`;
  } else {
    elements.fingerprintSummary.textContent = "Complete three practice signals to reveal which letters feel instant and which need another listen.";
  }

  if (!isReady) return;
  const renderKey = profiles
    .map(({ letter, metrics }) => `${letter}:${metrics.attempts}:${metrics.correct}:${Math.round(metrics.totalResponseMs)}`)
    .join("|");
  if (elements.fingerprintRows.dataset.renderKey === renderKey) return;

  profiles.sort((a, b) => {
    if (a.metrics.attempts && !b.metrics.attempts) return -1;
    if (!a.metrics.attempts && b.metrics.attempts) return 1;
    if (a.metrics.attempts && b.metrics.attempts && a.score !== b.score) return a.score - b.score;
    return POOL.indexOf(a.letter) - POOL.indexOf(b.letter);
  });

  const rows = profiles.map(({ letter, metrics, score }) => {
    const row = document.createElement("li");
    const averageMs = averageResponseMs(metrics);
    const accuracy = metrics.attempts ? Math.round((metrics.correct / metrics.attempts) * 100) : null;
    const label = recognitionLabel(metrics);

    const letterCell = document.createElement("div");
    letterCell.className = "fingerprint-letter";
    const letterValue = document.createElement("strong");
    letterValue.textContent = letter;
    const pattern = document.createElement("span");
    pattern.textContent = visiblePattern(MORSE[letter]);
    letterCell.append(letterValue, pattern);

    const recognitionCell = document.createElement("div");
    recognitionCell.className = "fingerprint-recognition";
    const recognitionValue = document.createElement("strong");
    recognitionValue.textContent = label;
    const track = document.createElement("span");
    track.className = "recognition-track";
    const fill = document.createElement("span");
    fill.style.setProperty("--recognition", score.toFixed(3));
    track.append(fill);
    recognitionCell.append(recognitionValue, track);

    const accuracyCell = document.createElement("span");
    accuracyCell.className = "fingerprint-accuracy";
    accuracyCell.textContent = accuracy === null ? "—" : `${accuracy}% · ${metrics.attempts}×`;

    const responseCell = document.createElement("span");
    responseCell.className = "fingerprint-time";
    responseCell.textContent = averageMs ? `${(averageMs / 1000).toFixed(1)} sec` : "—";

    row.setAttribute(
      "aria-label",
      `${letter}, ${visiblePattern(MORSE[letter])}. ${label}. ${accuracy === null ? "Not attempted" : `${accuracy} percent accurate over ${metrics.attempts} attempts, average response ${(averageMs / 1000).toFixed(1)} seconds`}.`,
    );
    row.append(letterCell, recognitionCell, accuracyCell, responseCell);
    return row;
  });

  elements.fingerprintRows.replaceChildren(...rows);
  elements.fingerprintRows.dataset.renderKey = renderKey;
}

function renderClinic() {
  const mistakes = totalMistakes();
  const confusion = topConfusion();
  elements.clinicEmpty.hidden = Boolean(confusion);
  elements.clinicReady.hidden = !confusion;
  elements.clinicProgressBar.style.transform = `scaleX(${Math.min(1, mistakes / 2)})`;
  elements.clinicProgressText.textContent = `${Math.min(2, mistakes)} of 2 useful ${mistakes === 1 ? "miss" : "misses"} collected`;
  if (!confusion) return;

  elements.clinicTargetLetter.textContent = confusion.target;
  elements.clinicTargetPattern.textContent = visiblePattern(MORSE[confusion.target]);
  elements.clinicAnswerLetter.textContent = confusion.answer;
  elements.clinicAnswerPattern.textContent = visiblePattern(MORSE[confusion.answer]);
  elements.clinicInsight.textContent = confusionInsight(confusion.target, confusion.answer);
  const clinicIsActive = Boolean(state.clinicPair);
  elements.clinicPractice.hidden = clinicIsActive;
  elements.clinicExit.hidden = !clinicIsActive;
}

function renderSignalLab() {
  elements.signalLab.dataset.theme = state.theme;
  for (const tab of elements.labTabs) {
    const isSelected = tab.dataset.labView === state.labView;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  }
  for (const panel of elements.labPanels) {
    panel.hidden = panel.dataset.labPanel !== state.labView;
  }

  const totals = performanceTotals();
  if (!totals.attempts && !totals.mirrorAttempts) {
    elements.profileStatus.textContent = "Profile warming up";
    elements.labAttemptSummary.textContent = "No signals logged yet";
  } else {
    elements.profileStatus.textContent = totals.attempts < 3
      ? "Profile calibrating"
      : totals.attempts < 10
        ? "Profile taking shape"
        : "Adaptive profile active";
    elements.labAttemptSummary.textContent = `${totals.attempts} ${totals.attempts === 1 ? "answer" : "answers"} · ${totals.mirrorAttempts} ${totals.mirrorAttempts === 1 ? "echo" : "echoes"}`;
  }

  const targetPattern = MORSE[state.mirrorTarget];
  elements.mirrorTargetLabel.textContent = state.mirrorEvaluated
    ? `${state.mirrorTarget} · ${visiblePattern(targetPattern)}`
    : `Mystery signal · ${targetPattern.length} ${targetPattern.length === 1 ? "mark" : "marks"}`;
  renderMirrorSequence();
  elements.mirrorPad.disabled = state.mirrorEvaluated || state.mirrorMarks.length >= targetPattern.length;
  elements.mirrorClear.disabled = !state.mirrorMarks.length;
  elements.mirrorClear.textContent = state.mirrorEvaluated ? "Retry" : "Clear";
  elements.mirrorCheck.disabled = !state.mirrorEvaluated && state.mirrorMarks.length !== targetPattern.length;
  elements.mirrorCheck.textContent = state.mirrorEvaluated ? "Next signal" : "Check signal";
  elements.mirrorResult.textContent = state.mirrorResult;
  elements.mirrorResult.dataset.outcome = state.mirrorOutcome;

  renderFingerprint();
  renderClinic();
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
  renderOnboarding();
  renderSignalLab();
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
  state.target = randomLetter(state.target, mode === "drill" ? currentPracticePool() : POOL);
  state.roundStartedAt = performance.now();
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

  if (state.mode !== "learn") state.roundStartedAt = performance.now();

  if (!playPatternAudio(pattern)) {
    state.status = "Audio unavailable · follow the visible signal";
    render();
    announce("Audio is unavailable. The Morse pattern remains visible.");
  }
}

function playPatternAudio(pattern, wordsPerMinute = currentWpm()) {

  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error("AudioContext unavailable");
    if (!audioContext) audioContext = new Context();
    if (audioContext.state === "suspended") audioContext.resume();

    const unit = 1.2 / wordsPerMinute;
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

function startLiveTone() {
  stopLiveTone();
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!audioContext) audioContext = new Context();
    if (audioContext.state === "suspended") audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.value = 600;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.008);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    liveTone = { oscillator, gain };
  } catch {
    liveTone = null;
  }
}

function stopLiveTone() {
  if (!liveTone) return;
  try {
    const now = audioContext.currentTime;
    liveTone.gain.gain.cancelScheduledValues(now);
    liveTone.gain.gain.setValueAtTime(liveTone.gain.gain.value, now);
    liveTone.gain.gain.linearRampToValueAtTime(0, now + 0.012);
    liveTone.oscillator.stop(now + 0.018);
  } catch {
    // The visual paddle remains responsive if an audio node has already stopped.
  }
  liveTone = null;
}

function playMirrorTarget() {
  const pattern = MORSE[state.mirrorTarget];
  const hasAudio = playPatternAudio(pattern, DIFFICULTIES[state.difficulty]);
  if (!hasAudio) {
    state.mirrorResult = "Audio is unavailable. Use the visible target after checking to continue practicing.";
    state.mirrorOutcome = "retry";
    renderSignalLab();
    announce("Mirror audio is unavailable.");
    return;
  }

  if (!state.mirrorMarks.length && !state.mirrorEvaluated) {
    state.mirrorResult = "Listening… now send the same rhythm back.";
    state.mirrorOutcome = "neutral";
    renderSignalLab();
  }
  announce(`Mystery signal played. It contains ${pattern.length} ${pattern.length === 1 ? "mark" : "marks"}.`);
}

function beginMirrorPress(pointerId = null) {
  const targetLength = MORSE[state.mirrorTarget].length;
  if (state.mirrorEvaluated || state.mirrorMarks.length >= targetLength || state.mirrorPressStartedAt) return;

  state.mirrorPressStartedAt = performance.now();
  state.mirrorPointerId = pointerId;
  elements.mirrorPad.dataset.pressing = "true";
  startLiveTone();
}

function finishMirrorPress(cancelled = false) {
  if (!state.mirrorPressStartedAt) return;
  const durationMs = performance.now() - state.mirrorPressStartedAt;
  state.mirrorPressStartedAt = 0;
  state.mirrorPointerId = null;
  elements.mirrorPad.dataset.pressing = "false";
  stopLiveTone();
  if (cancelled) return;

  const dashThresholdMs = (1.2 / DIFFICULTIES[state.difficulty]) * 2000;
  const symbol = durationMs >= dashThresholdMs ? "-" : ".";
  state.mirrorMarks.push({ symbol, durationMs });
  state.mirrorResult = symbol === "."
    ? "Dot recorded. Keep the next mark in the same pulse."
    : "Dash recorded. Keep its length close to three dots.";
  state.mirrorOutcome = "neutral";
  renderSignalLab();

  if (state.mirrorMarks.length === MORSE[state.mirrorTarget].length) {
    elements.mirrorCheck.focus({ preventScroll: true });
    announce("Transmission complete. Check your signal.");
  } else {
    announce(symbol === "." ? "Dot recorded." : "Dash recorded.");
  }
}

function clearMirrorAttempt(message = "Paddle cleared. Hear the target and try again.") {
  stopLiveTone();
  state.mirrorPressStartedAt = 0;
  state.mirrorPointerId = null;
  state.mirrorKeyboardPressed = false;
  state.mirrorMarks = [];
  state.mirrorEvaluated = false;
  state.mirrorResult = message;
  state.mirrorOutcome = "neutral";
  elements.mirrorPad.dataset.pressing = "false";
  renderSignalLab();
  elements.mirrorPad.focus({ preventScroll: true });
}

function newMirrorTarget() {
  state.mirrorTarget = randomLetter(state.mirrorTarget);
  clearMirrorAttempt("New signal ready. Listen first, then send it back.");
  playMirrorTarget();
}

function evaluateMirror() {
  if (state.mirrorEvaluated) {
    newMirrorTarget();
    return;
  }
  if (!state.mirrorMarks.length) return;

  const targetPattern = MORSE[state.mirrorTarget];
  const sentPattern = state.mirrorMarks.map((mark) => mark.symbol).join("");
  const comparisonLength = Math.max(targetPattern.length, sentPattern.length);
  let symbolMatches = 0;
  for (let index = 0; index < comparisonLength; index += 1) {
    if (targetPattern[index] === sentPattern[index]) symbolMatches += 1;
  }
  const symbolAccuracy = comparisonLength ? symbolMatches / comparisonLength : 0;

  const unitMs = (1.2 / DIFFICULTIES[state.difficulty]) * 1000;
  let timingError = 0;
  for (let index = 0; index < state.mirrorMarks.length; index += 1) {
    const idealMs = targetPattern[index] === "-" ? unitMs * 3 : unitMs;
    timingError += Math.min(1, Math.abs(state.mirrorMarks[index].durationMs - idealMs) / idealMs);
  }
  const timingFidelity = state.mirrorMarks.length ? 1 - timingError / state.mirrorMarks.length : 0;
  const score = Math.round((symbolAccuracy * 0.75 + timingFidelity * 0.25) * 100);
  const exactPattern = sentPattern === targetPattern;

  const metrics = state.performanceProfile.letters[state.mirrorTarget];
  metrics.mirrorAttempts += 1;
  metrics.mirrorScoreTotal += score;
  persistPerformanceProfile();

  state.mirrorEvaluated = true;
  if (exactPattern && score >= 85) {
    state.mirrorResult = `${score}% fidelity · Clean copy. Your marks and timing both matched the signal.`;
    state.mirrorOutcome = "strong";
    if (navigator.vibrate) navigator.vibrate(12);
  } else if (exactPattern) {
    state.mirrorResult = `${score}% fidelity · The pattern is right. Make dots quick and dashes about three times longer.`;
    state.mirrorOutcome = "retry";
  } else {
    state.mirrorResult = `${score}% fidelity · You sent ${visiblePattern(sentPattern)}. The target was ${visiblePattern(targetPattern)}.`;
    state.mirrorOutcome = "retry";
  }
  renderSignalLab();
  announce(state.mirrorResult);
}

function setLabView(view, moveFocus = false) {
  if (!["mirror", "fingerprint", "clinic"].includes(view)) return;
  state.labView = view;
  renderSignalLab();
  if (moveFocus) elements.labTabs.find((tab) => tab.dataset.labView === view)?.focus();
}

function handleLabTabKeydown(event) {
  const currentIndex = elements.labTabs.indexOf(event.currentTarget);
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % elements.labTabs.length;
  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + elements.labTabs.length) % elements.labTabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = elements.labTabs.length - 1;
  else return;

  event.preventDefault();
  setLabView(elements.labTabs[nextIndex].dataset.labView, true);
}

function launchFullDrill() {
  clearPendingRound();
  stopSprint();
  state.clinicPair = null;
  state.mode = "drill";
  state.onboardingMode = "drill";
  state.running = false;
  state.timeLeft = SPRINT_SECONDS;
  state.sprintScore = 0;
  storeValue(STORAGE_KEYS.mode, "drill");
  syncUrl();
  newRound(true);
  focusTrainer(elements.signalButton);
  announce("Full starter alphabet drill started.");
}

function resetPerformanceProfile() {
  if (!state.profileResetArmed) {
    state.profileResetArmed = true;
    renderSignalLab();
    announce("Press Confirm reset within five seconds to clear your recognition profile.");
    if (profileResetTimer) window.clearTimeout(profileResetTimer);
    profileResetTimer = window.setTimeout(() => {
      state.profileResetArmed = false;
      renderSignalLab();
    }, 5000);
    return;
  }

  if (profileResetTimer) window.clearTimeout(profileResetTimer);
  profileResetTimer = null;
  state.profileResetArmed = false;
  state.performanceProfile = {
    letters: Object.fromEntries(POOL.map((letter) => [letter, emptyLetterMetrics()])),
  };
  state.clinicPair = null;
  state.roundStartedAt = performance.now();
  persistPerformanceProfile();
  render();
  announce("Recognition profile reset. Your current session score is unchanged.");
}

function launchClinicDrill() {
  const confusion = topConfusion();
  if (!confusion) {
    launchFullDrill();
    return;
  }

  clearPendingRound();
  stopSprint();
  state.clinicPair = [confusion.target, confusion.answer];
  state.mode = "drill";
  state.onboardingMode = "drill";
  state.running = false;
  state.timeLeft = SPRINT_SECONDS;
  state.sprintScore = 0;
  storeValue(STORAGE_KEYS.mode, "drill");
  syncUrl();
  newRound(true);
  focusTrainer(elements.signalButton);
  announce(`Clinic started. Listen for the difference between ${confusion.target} and ${confusion.answer}.`);
}

function exitClinicDrill() {
  state.clinicPair = null;
  newRound(true);
  focusTrainer(elements.signalButton);
  announce("Clinic closed. The full starter alphabet is active again.");
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

function recordPerformance(target, answered, hit, responseMs) {
  const metrics = state.performanceProfile.letters[target];
  if (!metrics) return;

  const safeResponseMs = Math.max(0, Math.min(60000, responseMs));
  metrics.attempts += 1;
  metrics.correct += hit ? 1 : 0;
  metrics.totalResponseMs += safeResponseMs;
  metrics.fastestMs = metrics.fastestMs
    ? Math.min(metrics.fastestMs, safeResponseMs)
    : safeResponseMs;
  if (!hit) metrics.confusions[answered] = safeCount(metrics.confusions[answered]) + 1;
  persistPerformanceProfile();
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
  const responseMs = performance.now() - state.roundStartedAt;
  recordPerformance(state.target, letter, hit, responseMs);
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
  const pool = state.mode === "drill" ? currentPracticePool() : POOL;
  state.target = randomLetter(state.target, pool);
  state.typed = "_";
  state.status = state.mode === "sprint" ? "Next signal" : "Listening";
  state.feedback = "neutral";
  state.revealed = false;
  state.locked = false;
  state.lastAnswer = null;
  state.lastOutcome = null;
  state.roundStartedAt = performance.now();
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
  state.clinicPair = null;
  state.target = randomLetter(state.target, POOL);
  state.roundStartedAt = performance.now();
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

  for (const tab of elements.labTabs) {
    tab.addEventListener("click", () => setLabView(tab.dataset.labView));
    tab.addEventListener("keydown", handleLabTabKeydown);
  }

  elements.mirrorReplay.addEventListener("click", playMirrorTarget);
  elements.mirrorClear.addEventListener("click", () => clearMirrorAttempt());
  elements.mirrorCheck.addEventListener("click", evaluateMirror);
  elements.mirrorPad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    elements.mirrorPad.setPointerCapture(event.pointerId);
    beginMirrorPress(event.pointerId);
  });
  elements.mirrorPad.addEventListener("pointerup", (event) => {
    if (state.mirrorPointerId !== event.pointerId) return;
    event.preventDefault();
    finishMirrorPress();
  });
  elements.mirrorPad.addEventListener("pointercancel", (event) => {
    if (state.mirrorPointerId === event.pointerId) finishMirrorPress(true);
  });
  elements.mirrorPad.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat || state.mirrorKeyboardPressed) return;
    event.preventDefault();
    state.mirrorKeyboardPressed = true;
    beginMirrorPress();
  });
  elements.mirrorPad.addEventListener("keyup", (event) => {
    if (event.code !== "Space" || !state.mirrorKeyboardPressed) return;
    event.preventDefault();
    state.mirrorKeyboardPressed = false;
    finishMirrorPress();
  });
  elements.mirrorPad.addEventListener("blur", () => {
    if (!state.mirrorKeyboardPressed) return;
    state.mirrorKeyboardPressed = false;
    finishMirrorPress(true);
  });

  elements.fingerprintStart.addEventListener("click", launchFullDrill);
  elements.fingerprintReset.addEventListener("click", resetPerformanceProfile);
  elements.clinicStartDrill.addEventListener("click", launchFullDrill);
  elements.clinicPractice.addEventListener("click", launchClinicDrill);
  elements.clinicExit.addEventListener("click", exitClinicDrill);

  elements.signalButton.addEventListener("click", playCurrentSignal);
  elements.replayButton.addEventListener("click", playCurrentSignal);
  elements.mainAction.addEventListener("click", showHintOrAdvance);
  elements.hearLesson.addEventListener("click", playCurrentSignal);
  elements.previousLesson.addEventListener("click", () => changeLesson(-1));
  elements.nextLesson.addEventListener("click", () => changeLesson(1));
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") finishMirrorPress(true);
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
