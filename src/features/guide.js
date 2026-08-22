import { SPEEDS, STORAGE_KEYS, THEMES } from "../config.js";
import { MORSE } from "../data/morse.js";
import { scheduleText } from "../platform/morse-audio.js";
import { animateMarks } from "../ui/signals.js";

const LAST_STEP = 3;
/** Two characters at the chosen rhythm: enough to hear the gap, not a test. */
const RHYTHM_SAMPLE = "K M";

export function createGuideController(context) {
  const { state, elements, storage, audio, announce } = context;
  let cancelSignalAnimation = null;

  function clearSignalAnimation() {
    cancelSignalAnimation?.();
    cancelSignalAnimation = null;
  }

  function playFirstSignal() {
    const speed = context.trainer.currentSpeed();
    clearSignalAnimation();
    cancelSignalAnimation = animateMarks(
      [elements.firstSignalPattern],
      scheduleText("A", speed),
    );

    const hasAudio = audio.playPattern(MORSE.A, speed);
    elements.firstSignalState.textContent = hasAudio
      ? "A · short, then long"
      : "Audio unavailable · follow the marks";
    announce(hasAudio
      ? "You heard A: di-dah, short then long."
      : "Audio is unavailable. A remains visible as dot dash.");
  }

  /**
   * Calibration, not a quiz: the learner hears the same two characters at each
   * rhythm and keeps the one that arrives as sound rather than as countable
   * marks. Selecting goes through the ordinary settings path, so the choice is
   * persisted and applied exactly as it would be from the settings panel.
   */
  function playRhythm(preset) {
    const speed = SPEEDS[preset];
    if (!speed) return;
    if (!audio.playText(RHYTHM_SAMPLE, speed)) {
      announce("Audio is unavailable, so the rhythms cannot be previewed.");
      return;
    }
    announce(`${speed.label}. ${speed.hint}.`);
  }

  function selectRhythm(preset) {
    if (!Object.hasOwn(SPEEDS, preset)) return;
    context.trainer.setDifficulty(preset);
    render();
  }

  function render() {
    if (state.onboardingOpen && !elements.guide.open) {
      elements.guide.showModal();
      stepFocusTarget(state.onboardingStep)?.focus({ preventScroll: true });
    }
    if (!state.onboardingOpen && elements.guide.open) elements.guide.close();

    for (const step of elements.guideSteps) {
      step.hidden = Number(step.dataset.guideStep) !== state.onboardingStep;
    }
    for (const dot of elements.guideDots) {
      const stepNumber = Number(dot.dataset.guideDot);
      dot.dataset.state = stepNumber === state.onboardingStep
        ? "active"
        : stepNumber < state.onboardingStep
          ? "complete"
          : "upcoming";
    }
    for (const button of elements.guideThemes) {
      button.setAttribute("aria-pressed", String(button.dataset.guideTheme === state.onboardingTheme));
    }
    for (const button of elements.guideSpeeds) {
      button.setAttribute("aria-pressed", String(button.dataset.guideSpeed === state.difficulty));
    }
  }

  function pressedIn(buttons) {
    return buttons.find((button) => button.getAttribute("aria-pressed") === "true") ?? buttons[0];
  }

  function stepFocusTarget(step) {
    if (step === 1) return elements.firstSignalButton;
    if (step === 2) return pressedIn(elements.guideSpeeds);
    return pressedIn(elements.guideThemes);
  }

  function setStep(step) {
    const nextStep = Math.min(LAST_STEP, Math.max(1, step));
    if (nextStep === state.onboardingStep) return;
    elements.guide.dataset.direction = nextStep > state.onboardingStep ? "forward" : "back";
    state.onboardingStep = nextStep;
    render();
    stepFocusTarget(nextStep)?.focus({ preventScroll: true });
  }

  function open() {
    if (state.running) {
      context.trainer.stopSprint();
      state.locked = true;
      state.status = "Sprint paused · restart when ready";
      context.render();
    }

    clearSignalAnimation();
    elements.firstSignalState.textContent = "Tap to play";
    elements.guide.dataset.direction = "forward";
    state.onboardingOpen = true;
    state.onboardingStep = 1;
    state.onboardingTheme = state.theme;
    render();
    elements.firstSignalButton.focus({ preventScroll: true });
  }

  function trainerFocusTarget(mode) {
    if (mode === "send") return elements.sendPad;
    return mode === "sprint" ? elements.mainAction : elements.signalButton;
  }

  function dismiss() {
    if (!state.onboardingOpen) return;
    clearSignalAnimation();
    state.onboardingOpen = false;
    storage.set(STORAGE_KEYS.onboarding, true);
    render();
    context.trainer.focusTrainer(trainerFocusTarget(state.mode));
    announce("Guide closed. You can reopen it from Settings.");
  }

  function finish() {
    const selectedTheme = state.onboardingTheme;
    clearSignalAnimation();
    state.onboardingOpen = false;
    storage.set(STORAGE_KEYS.onboarding, true);

    if (selectedTheme !== state.theme) context.trainer.setTheme(selectedTheme);
    context.render();

    if (state.mode === "learn") context.trainer.playCurrentSignal();
    context.trainer.focusTrainer(trainerFocusTarget(state.mode));
    announce(
      state.mode === "sprint"
        ? `${THEMES[selectedTheme].label} is ready. Press Start sprint when you are ready.`
        : `${THEMES[selectedTheme].label} is ready.`,
    );
  }

  function bind() {
    for (const button of elements.guideNext) {
      button.addEventListener("click", () => setStep(state.onboardingStep + 1));
    }
    for (const button of elements.guideBack) {
      button.addEventListener("click", () => setStep(state.onboardingStep - 1));
    }
    for (const button of elements.guideSkip) button.addEventListener("click", dismiss);
    for (const button of elements.guideThemes) {
      button.addEventListener("click", () => {
        state.onboardingTheme = button.dataset.guideTheme;
        render();
      });
    }
    // Esc and a backdrop click are both "Skip": the guide is always optional.
    elements.guide.addEventListener("cancel", dismiss);
    elements.guide.addEventListener("click", (event) => {
      if (event.target === elements.guide) dismiss();
    });
    for (const button of elements.guideSpeeds) {
      button.addEventListener("click", () => selectRhythm(button.dataset.guideSpeed));
      button.addEventListener("keydown", (event) => {
        if (event.code === "Space") {
          // Space auditions the rhythm; Enter is what commits to it.
          event.preventDefault();
          playRhythm(button.dataset.guideSpeed);
          return;
        }
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
        event.preventDefault();
        const index = elements.guideSpeeds.indexOf(button);
        const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
        const next = (index + (forward ? 1 : -1) + elements.guideSpeeds.length) % elements.guideSpeeds.length;
        elements.guideSpeeds[next]?.focus();
      });
    }
    for (const button of elements.guideHear) {
      button.addEventListener("click", () => playRhythm(button.dataset.guideHear));
    }
    elements.firstSignalButton.addEventListener("click", playFirstSignal);
    elements.finishGuide.addEventListener("click", finish);
  }

  return Object.freeze({ bind, clearSignalAnimation, open, render });
}
