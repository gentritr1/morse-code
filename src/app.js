import {
  DIFFICULTIES,
  SPRINT_SECONDS,
  STORAGE_KEYS,
  THEMES,
  VALID_MODES,
} from "./config.js";
import { randomLetter } from "./data/morse.js";
import { createOnboardingController } from "./features/onboarding.js";
import { createSignalLabController } from "./features/signal-lab.js";
import { readPerformanceProfile } from "./features/signal-lab/performance-profile.js";
import { createSpeedPickerController } from "./features/speed-picker.js";
import { createTrainerController } from "./features/trainer.js";
import { MorseAudio } from "./platform/morse-audio.js";
import { createStorage } from "./platform/storage.js";
import { getElements } from "./ui/elements.js";
import { buildAnswerGrid, buildRoster } from "./ui/signals.js";

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

function initialMode() {
  const requested = query.get("mode");
  if (VALID_MODES.includes(requested)) return requested;
  const stored = storage.get(STORAGE_KEYS.mode);
  return VALID_MODES.includes(stored) ? stored : "learn";
}

function initialDifficulty() {
  const stored = storage.get(STORAGE_KEYS.difficulty);
  return Object.hasOwn(DIFFICULTIES, stored) ? stored : "steady";
}

const theme = initialTheme();
const mode = initialMode();
const difficulty = initialDifficulty();

const state = {
  theme,
  mode,
  difficulty,
  onboardingOpen: storage.get(STORAGE_KEYS.onboarding) !== "true",
  onboardingStep: 1,
  onboardingMode: mode,
  onboardingTheme: theme,
  target: randomLetter(),
  learnIndex: 0,
  typed: "_",
  status: mode === "learn" ? "Guided lesson" : mode === "sprint" ? "Press start when ready" : "Listening",
  feedback: "neutral",
  streak: 0,
  correct: 0,
  total: 0,
  revealed: false,
  locked: false,
  running: false,
  timeLeft: SPRINT_SECONDS,
  sprintScore: 0,
  sprintBest: storage.getNumber(STORAGE_KEYS.sprintBest),
  sprintDeadline: 0,
  lastAnswer: null,
  lastOutcome: null,
  roundStartedAt: performance.now(),
  performanceProfile: readPerformanceProfile(storage),
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
  trainer: null,
  onboarding: null,
  signalLab: null,
  speedPicker: null,
};

context.trainer = createTrainerController(context);
context.onboarding = createOnboardingController(context);
context.signalLab = createSignalLabController(context);
context.speedPicker = createSpeedPickerController(context);
context.render = () => {
  context.trainer.render();
  context.onboarding.render();
  context.signalLab.render();
};
Object.seal(context);

buildRoster(elements.roster);
buildAnswerGrid(elements.answerGrid, context.trainer.answer);
context.trainer.bind();
context.onboarding.bind();
context.signalLab.bind();
context.speedPicker.bind();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") context.signalLab.finishMirrorPress(true);
  if (document.visibilityState === "visible" && state.running) context.trainer.updateSprint();
});

context.render();
