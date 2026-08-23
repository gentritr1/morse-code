import { SPEEDS, STORAGE_KEYS, THEMES } from "../config.js";
import { MORSE } from "../data/morse.js";
import { scheduleDurationMs, scheduleText } from "../platform/morse-audio.js";
import { PLAYBACK_LEAD_MS, animateMarks } from "../ui/signals.js";
import {
  PLACEMENT_FEEDBACK_MS,
  PLACEMENT_LEAD_MS,
  buildTrials,
  placeFrom,
  placementLine,
  placementSpeed,
} from "./placement.js";
import { writeProgress } from "./progress.js";

const LAST_STEP = 3;
const RHYTHM_STEP = 2;
/** Two characters at the chosen rhythm: enough to hear the gap, not a test. */
const RHYTHM_SAMPLE = "K M";

export function createGuideController(context) {
  const { state, elements, storage, audio, announce } = context;
  let cancelSignalAnimation = null;
  /**
   * The placement run. It lives here rather than in app state because nothing
   * outside this dialog may read it: the trial is a measurement of hearing, not
   * a record of practice, and it must never reach the scheduler.
   */
  let trial = null;
  let trialTimers = [];

  function clearSignalAnimation() {
    cancelSignalAnimation?.();
    cancelSignalAnimation = null;
  }

  function clearTrialTimers() {
    for (const timer of trialTimers) window.clearTimeout(timer);
    trialTimers = [];
  }

  function playFirstSignal() {
    if (audio.isPlaying()) return;
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
    if (!speed || audio.isPlaying()) return;
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

  /* ------------------------------------------------------------ placement -- */

  function stopTrial() {
    clearTrialTimers();
    audio.stop();
    trial = null;
  }

  /**
   * Twelve pairs, no Morse knowledge needed. The measurement replaces the one
   * thing the guide could not honestly ask a beginner to judge: how fast they
   * can hear.
   */
  function startTrial() {
    audio.stop();
    clearTrialTimers();
    trial = {
      list: buildTrials(),
      index: 0,
      log: [],
      replays: 0,
      feedback: "",
      open: false,
      interrupted: false,
      endsAt: 0,
      active: "",
    };
    render();
    // The button that started the run is gone with the card row, so focus goes
    // to the first answer rather than falling back to the document.
    elements.measureSame.focus({ preventScroll: true });
    playTrial();
    announce("Placement started. Twelve pairs. Press S for same, D for different.");
  }

  /**
   * Both signals of the pair, with a very wide gap between them. The visible
   * marks stay uniform placeholders throughout — a mark that showed its own
   * shape, or even its own count, would answer the question for the learner —
   * so only which of the two signals is sounding is ever shown.
   */
  function playTrial() {
    if (!trial) return;
    const item = trial.list[trial.index];
    if (!item) return;

    clearTrialTimers();
    audio.stop();
    trial.open = false;
    trial.active = "";
    render();

    trialTimers.push(window.setTimeout(() => {
      if (!trial) return;
      const speed = placementSpeed(item.preset);
      const text = `${item.a} ${item.b}`;
      if (!audio.playText(text, speed)) {
        trial = null;
        clearTrialTimers();
        elements.measureFeedback.textContent = "";
        render();
        announce("Audio is unavailable, so the rhythm cannot be measured. Pick a rhythm by ear instead.");
        elements.measureStart.focus({ preventScroll: true });
        return;
      }

      const marks = scheduleText(text, speed);
      const durationMs = scheduleDurationMs(text, speed);
      // The answer window opens exactly at the end of the second signal, so a
      // pre-emptive tap can never be recorded as an impossibly fast decision.
      trial.endsAt = performance.now() + PLAYBACK_LEAD_MS + durationMs;

      for (const [signal, characterIndex] of [["a", 0], ["b", 2]]) {
        const own = marks.filter((mark) => mark.index === characterIndex);
        if (!own.length) continue;
        const from = own[0].start;
        const to = own[own.length - 1].start + own[own.length - 1].duration;
        trialTimers.push(
          window.setTimeout(() => {
            if (trial) {
              trial.active = signal;
              render();
            }
          }, PLAYBACK_LEAD_MS + from),
          window.setTimeout(() => {
            if (trial) {
              trial.active = "";
              render();
            }
          }, PLAYBACK_LEAD_MS + to),
        );
      }

      trialTimers.push(window.setTimeout(() => {
        if (!trial) return;
        trial.open = true;
        render();
      }, PLAYBACK_LEAD_MS + durationMs));
    }, PLACEMENT_LEAD_MS));
  }

  /** Asking again while it is still sounding is the same listen, so it is dropped. */
  function replayTrial() {
    if (!trial || trial.feedback || audio.isPlaying()) return;
    trial.replays += 1;
    playTrial();
  }

  function answerTrial(saidSame) {
    if (!trial || !trial.open || trial.feedback) return;
    const item = trial.list[trial.index];
    if (!item) return;

    const hit = saidSame === item.same;
    trial.open = false;
    // A pair the learner was away for is not evidence of anything, so it is
    // dropped from the log rather than counted either way.
    if (!trial.interrupted) {
      trial.log.push({
        preset: item.preset,
        hit,
        rt: Math.max(0, performance.now() - trial.endsAt),
        replays: trial.replays,
      });
    }
    trial.interrupted = false;
    trial.replays = 0;
    trial.index += 1;
    trial.feedback = hit ? "Correct" : item.same ? "They were the same" : "They were different";
    render();

    clearTrialTimers();
    trialTimers.push(window.setTimeout(() => {
      if (!trial) return;
      trial.feedback = "";
      if (trial.index >= trial.list.length) {
        finishTrial();
        return;
      }
      render();
      playTrial();
    }, PLACEMENT_FEEDBACK_MS));
  }

  /**
   * The result is applied the way the learner would have applied it by hand:
   * the preset goes through the ordinary settings path, and the spacing offset
   * seeds the adaptive rule rather than replacing it — from here the trainer
   * moves it on its own.
   */
  function finishTrial() {
    const result = placeFrom(trial.log);
    stopTrial();

    state.progress.placement = {
      chosen: result.chosen,
      effOffset: result.effOffset,
      acc: result.acc,
      lat: result.lat,
      at: Date.now(),
    };
    state.progress.effOffset = result.effOffset;
    writeProgress(storage, state.progress);

    context.trainer.setDifficulty(result.chosen);
    render();
    elements.measureStart.focus({ preventScroll: true });
    announce(placementLine(state.progress.placement));
  }

  /* --------------------------------------------------------------- render -- */

  function renderTrial() {
    const measuring = Boolean(trial);
    const placement = state.progress.placement;

    elements.rhythmChoose.hidden = measuring;
    elements.measurePanel.hidden = !measuring;

    elements.measureStart.textContent = placement ? "Measure again" : "Measure my rhythm";
    elements.measureStart.classList.toggle("is-quiet", Boolean(placement));
    elements.measureCaption.hidden = Boolean(placement);
    elements.measureResult.hidden = !placement;
    elements.measureResult.textContent = placement ? placementLine(placement) : "";

    if (!measuring) return;

    for (const group of elements.measureGroups) {
      group.dataset.state = group.dataset.signal === trial.active ? "sounding" : "idle";
    }
    for (const button of [elements.measureSame, elements.measureDifferent]) {
      button.setAttribute("aria-disabled", String(!trial.open));
    }
    elements.measureReplay.setAttribute("aria-disabled", String(Boolean(trial.feedback)));
    elements.measureFeedback.textContent = trial.feedback;
    elements.measureBar.style.transform = `scaleX(${trial.index / trial.list.length})`;
    elements.measureProgress.setAttribute("aria-valuenow", String(trial.index));
    elements.measureProgress.setAttribute(
      "aria-valuetext",
      `Pair ${Math.min(trial.list.length, trial.index + 1)} of ${trial.list.length}`,
    );
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
    renderTrial();
  }

  function pressedIn(buttons) {
    return buttons.find((button) => button.getAttribute("aria-pressed") === "true") ?? buttons[0];
  }

  function stepFocusTarget(step) {
    if (step === 1) return elements.firstSignalButton;
    if (step === RHYTHM_STEP) return trial ? elements.measureSame : pressedIn(elements.guideSpeeds);
    return pressedIn(elements.guideThemes);
  }

  function setStep(step) {
    const nextStep = Math.min(LAST_STEP, Math.max(1, step));
    if (nextStep === state.onboardingStep) return;
    // Leaving the step ends the measurement: half a run is not a measurement.
    stopTrial();
    elements.guide.dataset.direction = nextStep > state.onboardingStep ? "forward" : "back";
    state.onboardingStep = nextStep;
    render();
    stepFocusTarget(nextStep)?.focus({ preventScroll: true });
  }

  function open(options = {}) {
    const step = Math.min(LAST_STEP, Math.max(1, Number(options.step) || 1));
    context.trainer.pauseRound();
    if (state.running) {
      context.trainer.stopSprint();
      state.locked = true;
      state.status = "Sprint paused · restart when ready";
      context.render();
    }

    clearSignalAnimation();
    stopTrial();
    elements.firstSignalState.textContent = "Tap to play";
    elements.guide.dataset.direction = "forward";
    state.onboardingOpen = true;
    state.onboardingStep = step;
    state.onboardingTheme = state.theme;
    render();

    if (options.measure && step === RHYTHM_STEP) {
      startTrial();
      return;
    }
    stepFocusTarget(step)?.focus({ preventScroll: true });
  }

  function trainerFocusTarget(mode) {
    if (mode === "send") return elements.sendPad;
    return mode === "sprint" ? elements.mainAction : elements.signalButton;
  }

  function dismiss() {
    if (!state.onboardingOpen) return;
    clearSignalAnimation();
    // Esc discards a run in progress: nothing partial is ever written.
    stopTrial();
    state.onboardingOpen = false;
    storage.set(STORAGE_KEYS.onboarding, true);
    render();
    context.trainer.resumeRound();
    context.trainer.focusTrainer(trainerFocusTarget(state.mode));
    announce("Guide closed. You can reopen it from Settings.");
  }

  function finish() {
    const selectedTheme = state.onboardingTheme;
    clearSignalAnimation();
    stopTrial();
    state.onboardingOpen = false;
    storage.set(STORAGE_KEYS.onboarding, true);

    if (selectedTheme !== state.theme) context.trainer.setTheme(selectedTheme);
    context.render();

    // A paused round resumes on its own terms — replaying only if the learner
    // never heard it through. Otherwise this is the first signal of the visit.
    if (state.mode === "learn" && !context.trainer.resumeRound()) context.trainer.playCurrentSignal();
    context.trainer.focusTrainer(trainerFocusTarget(state.mode));
    announce(
      state.mode === "sprint"
        ? `${THEMES[selectedTheme].label} is ready. Press Start sprint when you are ready.`
        : `${THEMES[selectedTheme].label} is ready.`,
    );
  }

  /**
   * S, D and Space, and nothing else. The rest of the alphabet belongs to the
   * trainer's answer keys, which are not what is on screen here.
   */
  function handleTrialKeydown(event) {
    if (!trial) return;
    if (event.code === "Space") {
      event.preventDefault();
      replayTrial();
      return;
    }
    const key = event.key.toUpperCase();
    if (key === "S") {
      event.preventDefault();
      answerTrial(true);
      return;
    }
    if (key === "D") {
      event.preventDefault();
      answerTrial(false);
    }
  }

  /**
   * A pair heard through a wall is not a measurement. Hiding the page stops the
   * signal and the run waits; coming back replays the same pair from the top,
   * without charging the learner a replay for a listen they never got.
   */
  function handleVisibility() {
    if (!trial) return;
    if (document.visibilityState !== "visible") {
      clearTrialTimers();
      audio.stop();
      trial.open = false;
      trial.active = "";
      trial.interrupted = true;
      render();
      return;
    }
    trial.interrupted = false;
    trial.feedback = "";
    if (trial.index >= trial.list.length) {
      finishTrial();
      return;
    }
    render();
    playTrial();
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
    elements.measureStart.addEventListener("click", startTrial);
    elements.measureReplay.addEventListener("click", replayTrial);
    elements.measureSame.addEventListener("click", () => answerTrial(true));
    elements.measureDifferent.addEventListener("click", () => answerTrial(false));
    document.addEventListener("keydown", handleTrialKeydown);
    document.addEventListener("visibilitychange", handleVisibility);
    elements.firstSignalButton.addEventListener("click", playFirstSignal);
    elements.finishGuide.addEventListener("click", finish);
  }

  return Object.freeze({ bind, clearSignalAnimation, open, render });
}
