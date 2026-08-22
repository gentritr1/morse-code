import { STORAGE_KEYS } from "../config.js";
import { MORSE } from "../data/morse.js";

export function createOnboardingController(context) {
  const { state, elements, storage, audio, announce } = context;
  let signalTimers = [];

  function clearSignalAnimation() {
    for (const timer of signalTimers) window.clearTimeout(timer);
    signalTimers = [];
    for (const mark of elements.firstSignalPattern.children) mark.classList.remove("is-playing");
  }

  function playFirstSignal() {
    clearSignalAnimation();
    const marks = [...elements.firstSignalPattern.children];
    const pattern = MORSE.A;
    let offset = 60;
    const unitMs = context.trainer.unitSeconds() * 1000;

    pattern.split("").forEach((symbol, index) => {
      const duration = symbol === "." ? unitMs : unitMs * 3;
      const startTimer = window.setTimeout(() => marks[index]?.classList.add("is-playing"), offset);
      const endTimer = window.setTimeout(() => marks[index]?.classList.remove("is-playing"), offset + duration);
      signalTimers.push(startTimer, endTimer);
      offset += duration + unitMs;
    });

    const wordsPerMinute = 1.2 / context.trainer.unitSeconds();
    const hasAudio = audio.playPattern(pattern, wordsPerMinute);
    elements.firstSignalState.textContent = hasAudio
      ? "That was A · short, then long"
      : "Audio is unavailable · follow the moving pattern";
    announce(hasAudio
      ? "You heard A: di-dah, short then long."
      : "Audio is unavailable. A remains visible as dot dash.");
  }

  function render() {
    elements.onboarding.hidden = !state.onboardingOpen;
    document.body.dataset.onboarding = state.onboardingOpen ? "open" : "closed";
    elements.guideButton.setAttribute("aria-expanded", String(state.onboardingOpen));

    for (const step of elements.onboardingSteps) {
      step.hidden = Number(step.dataset.onboardingStep) !== state.onboardingStep;
    }
    for (const step of elements.onboardingProgress) {
      const stepNumber = Number(step.dataset.progressStep);
      step.dataset.state = stepNumber === state.onboardingStep
        ? "active"
        : stepNumber < state.onboardingStep
          ? "complete"
          : "upcoming";
    }
    for (const button of elements.onboardingModes) {
      button.setAttribute("aria-pressed", String(button.dataset.onboardingMode === state.onboardingMode));
    }
    for (const button of elements.onboardingThemes) {
      button.setAttribute("aria-pressed", String(button.dataset.onboardingTheme === state.onboardingTheme));
    }
    context.trainer.renderCoach();
  }

  function setStep(step) {
    const nextStep = Math.min(3, Math.max(1, step));
    if (nextStep === state.onboardingStep) return;
    state.onboardingStep = nextStep;
    render();
    const nextFocus = nextStep === 1
      ? elements.firstSignalButton
      : nextStep === 2
        ? elements.onboardingModes.find((button) => button.getAttribute("aria-pressed") === "true")
        : elements.onboardingThemes.find((button) => button.getAttribute("aria-pressed") === "true");
    nextFocus?.focus({ preventScroll: true });
  }

  function open() {
    if (state.running) {
      context.trainer.stopSprint();
      state.locked = true;
      state.status = "Sprint paused · restart when ready";
      context.render();
    }

    clearSignalAnimation();
    elements.firstSignalState.textContent = "Tap to hear your first signal";
    state.onboardingOpen = true;
    state.onboardingStep = 1;
    state.onboardingMode = state.mode;
    state.onboardingTheme = state.theme;
    render();
    elements.onboarding.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    elements.firstSignalButton.focus({ preventScroll: true });
  }

  function dismiss() {
    clearSignalAnimation();
    state.onboardingOpen = false;
    storage.set(STORAGE_KEYS.onboarding, true);
    render();
    const focusTarget = state.mode === "learn"
      ? elements.hearLesson
      : state.mode === "sprint"
        ? elements.mainAction
        : elements.signalButton;
    context.trainer.focusTrainer(focusTarget);
    announce("Guide closed. You can reopen it from How it works.");
  }

  function finish() {
    const selectedMode = state.onboardingMode;
    const selectedTheme = state.onboardingTheme;
    clearSignalAnimation();
    state.onboardingOpen = false;
    storage.set(STORAGE_KEYS.onboarding, true);

    if (selectedTheme !== state.theme) context.trainer.setTheme(selectedTheme);
    if (selectedMode !== state.mode) context.trainer.setMode(selectedMode);
    context.render();

    if (selectedMode !== "sprint") context.trainer.playCurrentSignal();
    const focusTarget = selectedMode === "learn"
      ? elements.hearLesson
      : selectedMode === "sprint"
        ? elements.mainAction
        : elements.signalButton;
    context.trainer.focusTrainer(focusTarget);
    announce(
      selectedMode === "sprint"
        ? `${context.trainer.themeLabel(selectedTheme)} is ready. Press Start sprint when you are ready.`
        : `${context.trainer.themeLabel(selectedTheme)} is ready. Your first ${selectedMode} signal is playing.`,
    );
  }

  function bind() {
    elements.guideButton.addEventListener("click", () => {
      if (state.onboardingOpen) dismiss();
      else open();
    });
    for (const button of elements.onboardingNext) {
      button.addEventListener("click", () => setStep(state.onboardingStep + 1));
    }
    for (const button of elements.onboardingBack) {
      button.addEventListener("click", () => setStep(state.onboardingStep - 1));
    }
    for (const button of elements.onboardingSkip) button.addEventListener("click", dismiss);
    for (const button of elements.onboardingModes) {
      button.addEventListener("click", () => {
        state.onboardingMode = button.dataset.onboardingMode;
        render();
      });
    }
    for (const button of elements.onboardingThemes) {
      button.addEventListener("click", () => {
        state.onboardingTheme = button.dataset.onboardingTheme;
        render();
      });
    }
    elements.firstSignalButton.addEventListener("click", playFirstSignal);
    elements.finishOnboarding.addEventListener("click", finish);
  }

  return Object.freeze({ bind, clearSignalAnimation, render });
}
