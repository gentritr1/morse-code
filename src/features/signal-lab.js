import { DIFFICULTIES, STORAGE_KEYS } from "../config.js";
import { MORSE, STARTER_POOL, randomLetter, visiblePattern } from "../data/morse.js";
import {
  averageResponseMs,
  confusionInsight,
  createEmptyPerformanceProfile,
  performanceTotals,
  recognitionLabel,
  recognitionScore,
  recordPerformance as updatePerformanceProfile,
  topConfusion,
  totalMistakes,
} from "./signal-lab/performance-profile.js";

export function createSignalLabController(context) {
  const { state, elements, storage, audio, announce } = context;
  let profileResetTimer = null;

  function persistPerformanceProfile() {
    storage.setJson(STORAGE_KEYS.performance, state.performanceProfile);
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
    const totals = performanceTotals(state.performanceProfile);
    const isReady = totals.attempts >= 3;
    elements.fingerprintEmpty.hidden = isReady;
    elements.fingerprintTable.hidden = !isReady;
    elements.fingerprintProgress.textContent = `${Math.min(3, totals.attempts)} of 3 signals logged`;
    elements.fingerprintStart.textContent = isReady ? "Continue drilling" : "Start a drill";
    elements.fingerprintReset.hidden = totals.attempts + totals.mirrorAttempts === 0;
    elements.fingerprintReset.textContent = state.profileResetArmed ? "Confirm reset" : "Reset profile";

    const profiles = STARTER_POOL.map((letter) => {
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
      return STARTER_POOL.indexOf(a.letter) - STARTER_POOL.indexOf(b.letter);
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
    const mistakes = totalMistakes(state.performanceProfile);
    const confusion = topConfusion(state.performanceProfile);
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

  function render() {
    elements.signalLab.dataset.theme = state.theme;
    for (const tab of elements.labTabs) {
      const isSelected = tab.dataset.labView === state.labView;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    }
    for (const panel of elements.labPanels) panel.hidden = panel.dataset.labPanel !== state.labView;

    const totals = performanceTotals(state.performanceProfile);
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

  function playMirrorTarget() {
    const pattern = MORSE[state.mirrorTarget];
    const hasAudio = audio.playPattern(pattern, DIFFICULTIES[state.difficulty]);
    if (!hasAudio) {
      state.mirrorResult = "Audio is unavailable. Use the visible target after checking to continue practicing.";
      state.mirrorOutcome = "retry";
      render();
      announce("Mirror audio is unavailable.");
      return;
    }

    if (!state.mirrorMarks.length && !state.mirrorEvaluated) {
      state.mirrorResult = "Listening… now send the same rhythm back.";
      state.mirrorOutcome = "neutral";
      render();
    }
    announce(`Mystery signal played. It contains ${pattern.length} ${pattern.length === 1 ? "mark" : "marks"}.`);
  }

  function beginMirrorPress(pointerId = null) {
    const targetLength = MORSE[state.mirrorTarget].length;
    if (state.mirrorEvaluated || state.mirrorMarks.length >= targetLength || state.mirrorPressStartedAt) return;

    state.mirrorPressStartedAt = performance.now();
    state.mirrorPointerId = pointerId;
    elements.mirrorPad.dataset.pressing = "true";
    audio.startTone();
  }

  function finishMirrorPress(cancelled = false) {
    if (!state.mirrorPressStartedAt) return;
    const durationMs = performance.now() - state.mirrorPressStartedAt;
    state.mirrorPressStartedAt = 0;
    state.mirrorPointerId = null;
    elements.mirrorPad.dataset.pressing = "false";
    audio.stopTone();
    if (cancelled) return;

    const dashThresholdMs = (1.2 / DIFFICULTIES[state.difficulty]) * 2000;
    const symbol = durationMs >= dashThresholdMs ? "-" : ".";
    state.mirrorMarks.push({ symbol, durationMs });
    state.mirrorResult = symbol === "."
      ? "Dot recorded. Keep the next mark in the same pulse."
      : "Dash recorded. Keep its length close to three dots.";
    state.mirrorOutcome = "neutral";
    render();

    if (state.mirrorMarks.length === MORSE[state.mirrorTarget].length) {
      elements.mirrorCheck.focus({ preventScroll: true });
      announce("Transmission complete. Check your signal.");
    } else {
      announce(symbol === "." ? "Dot recorded." : "Dash recorded.");
    }
  }

  function clearMirrorAttempt(message = "Paddle cleared. Hear the target and try again.") {
    audio.stopTone();
    state.mirrorPressStartedAt = 0;
    state.mirrorPointerId = null;
    state.mirrorKeyboardPressed = false;
    state.mirrorMarks = [];
    state.mirrorEvaluated = false;
    state.mirrorResult = message;
    state.mirrorOutcome = "neutral";
    elements.mirrorPad.dataset.pressing = "false";
    render();
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
      navigator.vibrate?.(12);
    } else if (exactPattern) {
      state.mirrorResult = `${score}% fidelity · The pattern is right. Make dots quick and dashes about three times longer.`;
      state.mirrorOutcome = "retry";
    } else {
      state.mirrorResult = `${score}% fidelity · You sent ${visiblePattern(sentPattern)}. The target was ${visiblePattern(targetPattern)}.`;
      state.mirrorOutcome = "retry";
    }
    render();
    announce(state.mirrorResult);
  }

  function setLabView(view, moveFocus = false) {
    if (!["mirror", "fingerprint", "clinic"].includes(view)) return;
    state.labView = view;
    render();
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

  function resetPerformanceProfile() {
    if (!state.profileResetArmed) {
      state.profileResetArmed = true;
      render();
      announce("Press Confirm reset within five seconds to clear your recognition profile.");
      if (profileResetTimer) window.clearTimeout(profileResetTimer);
      profileResetTimer = window.setTimeout(() => {
        state.profileResetArmed = false;
        render();
      }, 5000);
      return;
    }

    if (profileResetTimer) window.clearTimeout(profileResetTimer);
    profileResetTimer = null;
    state.profileResetArmed = false;
    state.performanceProfile = createEmptyPerformanceProfile();
    state.clinicPair = null;
    state.roundStartedAt = performance.now();
    persistPerformanceProfile();
    context.render();
    announce("Recognition profile reset. Your current session score is unchanged.");
  }

  function recordPerformance(target, answered, hit, responseMs) {
    updatePerformanceProfile(state.performanceProfile, target, answered, hit, responseMs);
    persistPerformanceProfile();
  }

  function bind() {
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

    elements.fingerprintStart.addEventListener("click", () => context.trainer.launchDrill());
    elements.fingerprintReset.addEventListener("click", resetPerformanceProfile);
    elements.clinicStartDrill.addEventListener("click", () => context.trainer.launchDrill());
    elements.clinicPractice.addEventListener("click", () => {
      const confusion = topConfusion(state.performanceProfile);
      if (!confusion) {
        context.trainer.launchDrill();
        return;
      }
      context.trainer.launchDrill([confusion.target, confusion.answer]);
    });
    elements.clinicExit.addEventListener("click", () => context.trainer.launchDrill());
  }

  return Object.freeze({ bind, finishMirrorPress, recordPerformance, render });
}
