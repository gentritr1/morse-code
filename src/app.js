import {
  SPEEDS,
  SPRINT_SECONDS,
  SPRINT_UNLOCK_AT,
  STORAGE_KEYS,
  THEMES,
  VALID_MODES,
} from "./config.js";
import { appendEvent, readEvents, writeEvents } from "./features/events.js";
import { createGuideController } from "./features/guide.js";
import { readPerformanceProfile, recordPerformance as updatePerformanceProfile } from "./features/performance-profile.js";
import {
  LEGACY_MODES,
  markSeededFromHistory,
  needsSeeding,
  nextTarget,
  readProgress,
  unlockedLetters,
} from "./features/progress.js";
import { createSendController } from "./features/send.js";
import { createSettingsController } from "./features/settings.js";
import { createTrainerController } from "./features/trainer.js";
import { MorseAudio } from "./platform/morse-audio.js";
import { createStorage } from "./platform/storage.js";
import { getElements } from "./ui/elements.js";
import { createLettersController } from "./ui/letters.js";

const storage = createStorage();
const elements = getElements();
const audio = new MorseAudio();
const query = new URLSearchParams(window.location.search);

function initialTheme() {
  const requested = query.get("theme");
  if (Object.hasOwn(THEMES, requested)) return requested;
  const stored = storage.get(STORAGE_KEYS.theme);
  return Object.hasOwn(THEMES, stored) ? stored : "terminal";
}

function storedMode() {
  const requested = query.get("mode");
  if (VALID_MODES.includes(requested)) return requested;
  const stored = storage.get(STORAGE_KEYS.mode);
  if (Object.hasOwn(LEGACY_MODES, stored)) return LEGACY_MODES[stored];
  return VALID_MODES.includes(stored) ? stored : "learn";
}

/** Sprint is earned. Asking for it too early lands on Learn without a scolding. */
function initialMode(unlocked) {
  const requested = storedMode();
  return requested === "sprint" && unlocked < SPRINT_UNLOCK_AT ? "learn" : requested;
}

function initialDifficulty() {
  const stored = storage.get(STORAGE_KEYS.difficulty);
  return Object.hasOwn(SPEEDS, stored) ? stored : "steady";
}

const theme = initialTheme();
const performanceProfile = readPerformanceProfile(storage);
const progress = markSeededFromHistory(readProgress(storage), performanceProfile);
const mode = initialMode(progress.unlocked);
const difficulty = initialDifficulty();
const pool = unlockedLetters(progress);

const state = {
  theme,
  mode,
  difficulty,
  progress,
  onboardingOpen: query.get("guide") !== "off" && storage.get(STORAGE_KEYS.onboarding) !== "true",
  onboardingStep: 1,
  onboardingTheme: theme,
  target: nextTarget(pool),
  roundType: "letter",
  roundReason: null,
  typed: "",
  firstListen: true,
  status: mode === "sprint" ? "Press start when ready" : "Listening",
  feedback: "neutral",
  streak: 0,
  correct: 0,
  total: 0,
  revealed: false,
  revealMarks: false,
  playing: false,
  // The whole signal has been heard: what resuming a paused round reads to
  // decide between replaying it and simply reopening the answer window.
  signalHeard: false,
  roundPaused: false,
  pausedHeard: false,
  pausedRound: 0,
  locked: false,
  running: false,
  timeLeft: SPRINT_SECONDS,
  sprintScore: 0,
  sprintInstant: 0,
  sprintBest: storage.getNumber(STORAGE_KEYS.sprintBest),
  sprintCompleted: storage.getNumber(STORAGE_KEYS.sprintBest) > 0,
  sprintBeatBest: false,
  sprintDeadline: 0,
  correctKeys: [],
  wrongKeys: [],
  lastOutcome: null,
  roundStartedAt: performance.now(),
  performanceProfile,
  sessionAnswered: 0,
  sessionDone: false,
  sessionSentence: "",
  sessionExtras: 0,
  seedIndex: 0,
  introSeeded: false,
  introRefresh: false,
  pairRefreshed: null,
  seenRound: {},
  served: {},
  skippedPhases: [],
  retries: [],
  heldBackThisSession: [],
  lapsedThisSession: [],
  relearnedThisSession: [],
  groupStreaks: { miss: 0, clean: 0 },
  spacingDirection: null,
  wasReadyForNew: true,
  // Which phase table this sitting runs on, decided once so the seed run
  // flipping `progress.seeded` mid-session cannot reshape the rail.
  seedRun: needsSeeding(progress),
  roundInterrupted: false,
  events: readEvents(storage),
  introLetter: null,
  revealedLetters: [],
  lettersOpen: false,
  resetArmed: false,
  sendTarget: nextTarget(pool),
  sendMarks: [],
  sendEvaluated: false,
  sendPlaying: false,
  sendStatus: "Hear the target, then send it back",
  sendOutcome: "neutral",
  sendPressStartedAt: 0,
  sendPointerId: null,
  sendKeyboardPressed: false,
};

function announce(message) {
  elements.liveStatus.textContent = "";
  window.requestAnimationFrame(() => {
    elements.liveStatus.textContent = message;
  });
}

const context = {
  state,
  elements,
  storage,
  audio,
  announce,
  render: null,
  persistProfile: null,
  recordPerformance: null,
  logEvent: null,
  trainer: null,
  guide: null,
  send: null,
  settings: null,
  letters: null,
};

context.persistProfile = () => storage.setJson(STORAGE_KEYS.performance, state.performanceProfile);
/**
 * The attempt log is append-only and capped. It is the only record that can
 * answer "did it survive the night", which counters structurally cannot.
 */
context.logEvent = (event) => {
  state.events = appendEvent(state.events, event);
  writeEvents(storage, state.events);
};
context.recordPerformance = (target, answered, hit, responseMs, options) => {
  updatePerformanceProfile(state.performanceProfile, target, answered, hit, responseMs, options);
  context.persistProfile();
};

context.trainer = createTrainerController(context);
context.guide = createGuideController(context);
context.send = createSendController(context);
context.settings = createSettingsController(context);
context.letters = createLettersController(context);
context.render = () => {
  context.trainer.render();
  context.guide.render();
  context.send.render();
  context.settings.render();
  context.letters.render();
};
Object.seal(context);

context.trainer.bind();
context.guide.bind();
context.send.bind();
context.settings.bind();
context.letters.bind();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    context.send.finishPress(true);
    // A hidden page is not practising. The signal stops, the auto-advance
    // stops, and the round waits rather than running out in an empty room.
    context.trainer.pauseRound();
    return;
  }
  if (state.running) context.trainer.updateSprint();
  context.trainer.resumeRound();
});

context.render();
// The trainer picks the first exercise too — the learner never chooses one.
if (state.mode === "learn") context.trainer.newRound(false);
