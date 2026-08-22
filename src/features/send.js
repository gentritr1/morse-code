import { SEND_BAND_MIN, SPEEDS } from "../config.js";
import { MORSE, visiblePattern } from "../data/morse.js";
import { speedTiming } from "../platform/morse-audio.js";
import { classify, fitUnit, recordSend, sendAggregate } from "./performance-profile.js";
import { nextTarget, unlockedLetters } from "./progress.js";

/**
 * Sending is judged the way an operator hears it, and against the learner's own
 * unit rather than the machine's. Symbols are decided after the fact from the
 * durations themselves; the unit is then fitted by least squares, so tempo (the
 * whole transmission running fast or slow) and rhythm (the proportions inside
 * it being wrong) come apart instead of being blamed on each other. A fist is
 * an average, so the word under the trace is read off the last few clean sends,
 * never off one transmission.
 */
/** The trace is drawn against four units, which is one unit past a dash. */
const TRACE_UNITS = 4;
const SHORT_RATIO = 0.75;
const LONG_RATIO = 1.35;
/** A defensive ceiling: a stuck paddle should not grow the readout forever. */
const MAX_MARKS = 12;

/**
 * Send mode: the learner keys a target back on the paddle. Tap for a dot, hold
 * for a dash. Pointer, keyboard, blur and visibility changes all end a press so
 * a held tone can never be stranded.
 */
export function createSendController(context) {
  const { state, elements, audio, announce } = context;

  function targetPattern() {
    return MORSE[state.sendTarget];
  }

  function speed() {
    return SPEEDS[state.difficulty] ?? SPEEDS.steady;
  }

  /** Keying is judged against the character speed, never the Farnsworth gaps. */
  function unitMs() {
    return speedTiming(speed()).unitMs;
  }

  function renderReadout() {
    const length = targetPattern().length;
    const sent = state.sendMarks.map((mark) => mark.symbol).join("");
    const renderKey = `${sent}:${length}:${state.sendEvaluated}`;
    if (elements.sendSequence.dataset.renderKey === renderKey) return;

    const marks = state.sendMarks.map((mark, index) => {
      const item = document.createElement("span");
      item.className = `send-mark${mark.symbol === "-" ? " dash" : ""}`;
      if (state.sendEvaluated) {
        item.dataset.match = String(targetPattern()[index] === mark.symbol);
      }
      item.setAttribute("aria-hidden", "true");
      return item;
    });
    for (let index = state.sendMarks.length; index < length; index += 1) {
      const placeholder = document.createElement("span");
      placeholder.className = "send-mark placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      marks.push(placeholder);
    }

    elements.sendSequence.replaceChildren(...marks);
    elements.sendSequence.setAttribute(
      "aria-label",
      state.sendMarks.length
        ? state.sendMarks.map((mark) => (mark.symbol === "." ? "dot" : "dash")).join(", ")
        : "No marks recorded yet",
    );
    elements.sendSequence.dataset.renderKey = renderKey;
  }

  function render() {
    const length = targetPattern().length;
    elements.sendTargetLabel.textContent = `Target · ${length} ${length === 1 ? "mark" : "marks"}`;
    elements.sendStatus.textContent = state.sendStatus;
    elements.sendStatus.dataset.outcome = state.sendOutcome;
    elements.sendDecode.textContent = state.sendEvaluated ? state.sendTarget : "_";
    renderReadout();

    elements.sendPad.disabled = state.sendEvaluated || state.sendMarks.length >= MAX_MARKS;
    elements.sendClear.disabled = !state.sendMarks.length || state.sendEvaluated;
    elements.sendCheck.disabled = !state.sendEvaluated && !state.sendMarks.length;
    elements.sendCheck.textContent = state.sendEvaluated ? "Next" : "Check";
    elements.sendTrace.hidden = !state.sendEvaluated;

    // A fist is an average: one word for the last few clean sends, or how many
    // are still needed before there is anything worth calling it.
    const aggregate = sendAggregate(state.performanceProfile);
    elements.sendBand.textContent = aggregate.band
      ? `Rhythm · ${aggregate.band}`
      : `Rhythm · ${aggregate.clean} of ${SEND_BAND_MIN} clean sends`;
  }

  function playTarget() {
    const pattern = targetPattern();
    if (!audio.playPattern(pattern, speed())) {
      state.sendStatus = "Audio unavailable · the target appears after you check";
      state.sendOutcome = "retry";
      context.render();
      announce("Send audio is unavailable.");
      return;
    }
    announce(`Target played. It contains ${pattern.length} ${pattern.length === 1 ? "mark" : "marks"}.`);
  }

  function beginPress(pointerId = null) {
    // Free-form: the learner may key more or fewer marks than the target holds.
    if (state.sendEvaluated || state.sendMarks.length >= MAX_MARKS) return;
    if (state.sendPressStartedAt) return;
    state.sendPressStartedAt = performance.now();
    state.sendPointerId = pointerId;
    elements.sendPad.dataset.pressing = "true";
    audio.startTone();
  }

  /**
   * Every press is kept as a raw `{ downAt, upAt }` timeline. The symbol and the
   * silence in front of it are derived from it, so spacing can be judged instead
   * of being thrown away at capture time.
   */
  function finishPress(cancelled = false) {
    if (!state.sendPressStartedAt) return;
    const downAt = state.sendPressStartedAt;
    const upAt = performance.now();
    state.sendPressStartedAt = 0;
    state.sendPointerId = null;
    elements.sendPad.dataset.pressing = "false";
    audio.stopTone();
    if (cancelled) return;

    const durationMs = upAt - downAt;
    const previous = state.sendMarks[state.sendMarks.length - 1];
    const gapMs = previous ? downAt - previous.upAt : 0;
    const symbol = durationMs >= unitMs() * 2 ? "-" : ".";
    state.sendMarks.push({ symbol, downAt, upAt, durationMs, gapMs });
    state.sendStatus = symbol === "." ? "Dot." : "Dash.";
    state.sendOutcome = "neutral";
    context.render();

    if (state.sendMarks.length === targetPattern().length) {
      elements.sendCheck.focus({ preventScroll: true });
      announce("Transmission complete. Check your signal.");
    } else {
      announce(symbol === "." ? "Dot recorded." : "Dash recorded.");
    }
  }

  function clearAttempt(message = "Hear the target, then send it back") {
    elements.sendTrace.hidden = true;
    audio.stopTone();
    state.sendPressStartedAt = 0;
    state.sendPointerId = null;
    state.sendKeyboardPressed = false;
    state.sendMarks = [];
    state.sendEvaluated = false;
    state.sendStatus = message;
    state.sendOutcome = "neutral";
    elements.sendPad.dataset.pressing = "false";
    context.render();
  }

  function newTarget() {
    state.sendTarget = nextTarget(unlockedLetters(state.progress), state.sendTarget);
    clearAttempt();
    context.render();
    elements.sendPad.focus({ preventScroll: true });
    playTarget();
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function ratioWord(ratio, noun) {
    if (ratio === null) return "";
    if (ratio < SHORT_RATIO) return `${noun} short`;
    if (ratio > LONG_RATIO) return `${noun} long`;
    return "";
  }

  /**
   * You against Ideal, drawn to scale against four units. The only comparison
   * bars in the product, and they exist only after a check.
   */
  function renderTrace(rows) {
    for (const row of elements.sendTrace.children) {
      const note = row.querySelector(".trace-note");
      const data = rows[note.dataset.trace];
      const [you, ideal] = row.querySelectorAll(".trace-you, .trace-ideal");
      you.style.setProperty("--scale", (Math.min(1, (data.you ?? 0) / TRACE_UNITS)).toFixed(3));
      ideal.style.setProperty("--scale", (Math.min(1, data.ideal / TRACE_UNITS)).toFixed(3));
      note.textContent = data.word;
    }
  }

  function standardDeviation(values, average) {
    if (!values.length) return 0;
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  function evaluate() {
    if (state.sendEvaluated) {
      newTarget();
      return;
    }
    if (!state.sendMarks.length) return;

    const nominal = unitMs();
    const target = targetPattern();
    const durations = state.sendMarks.map((mark) => mark.durationMs);
    // The learner's own long/short split decides the symbols; only a
    // transmission that never varied falls back to the preset's threshold.
    const sent = classify(durations, nominal);
    const exactPattern = sent === target;
    // Fit against what they meant, then against what they sent, then give up
    // and use the preset — in that order, so a wrong pattern still gets a
    // sensible unit to be measured against.
    const fitted = fitUnit(durations, target) ?? fitUnit(durations, sent) ?? nominal;

    const dots = durations.filter((value, index) => sent[index] === ".");
    const dashes = durations.filter((value, index) => sent[index] === "-");
    const gaps = state.sendMarks.slice(1).map((mark) => mark.gapMs);
    const dotAvg = dots.length ? mean(dots) : null;
    const dashAvg = dashes.length ? mean(dashes) : null;
    const gapAvg = gaps.length ? mean(gaps) : null;

    const ratio = dotAvg && dashAvg ? dashAvg / dotAvg : null;
    const gapUnits = gapAvg !== null && fitted > 0 ? gapAvg / fitted : null;
    // Evenness only means something once there are enough dots to be uneven.
    const cv = dots.length >= 3 && dotAvg ? standardDeviation(dots, dotAvg) / dotAvg : null;

    // The readout shows the symbols the judgement actually used.
    state.sendMarks = state.sendMarks.map((mark, index) => ({ ...mark, symbol: sent[index] ?? mark.symbol }));

    const traceRows = {
      dot: {
        you: dotAvg !== null && fitted > 0 ? dotAvg / fitted : null,
        ideal: 1,
        word: ratioWord(dotAvg !== null && fitted > 0 ? dotAvg / fitted : null, "dots"),
      },
      dash: {
        you: dashAvg !== null && fitted > 0 ? dashAvg / fitted : null,
        ideal: 3,
        word: ratioWord(dashAvg !== null && fitted > 0 ? dashAvg / (fitted * 3) : null, "dashes"),
      },
      gap: { you: gapUnits, ideal: 1, word: ratioWord(gapUnits, "gaps") },
    };
    renderTrace(traceRows);
    const flagged = Object.values(traceRows).some((row) => row.word);

    recordSend(state.performanceProfile, state.sendTarget, {
      hit: exactPattern,
      ratio,
      gapUnits,
      cv,
      unit: fitted,
    });
    context.persistProfile();

    state.sendEvaluated = true;
    if (exactPattern && !flagged) {
      state.sendStatus = "Clean copy";
      state.sendOutcome = "strong";
      navigator.vibrate?.(12);
    } else if (exactPattern) {
      const dashRatio = dashAvg !== null && fitted > 0 ? dashAvg / (fitted * 3) : null;
      state.sendStatus = dashRatio !== null && dashRatio < SHORT_RATIO
        ? "Right pattern · make dashes longer"
        : "Right pattern · watch the proportions";
      state.sendOutcome = "retry";
    } else {
      state.sendStatus = `You sent ${visiblePattern(sent)} · target was ${visiblePattern(target)}`;
      state.sendOutcome = "retry";
    }
    context.render();
    announce(state.sendStatus);
  }

  function activate() {
    state.sendTarget = nextTarget(unlockedLetters(state.progress), null);
    clearAttempt();
    playTarget();
  }

  function deactivate() {
    finishPress(true);
    audio.stopTone();
  }

  function bind() {
    elements.sendReplay.addEventListener("click", playTarget);
    elements.sendClear.addEventListener("click", () => {
      clearAttempt();
      elements.sendPad.focus({ preventScroll: true });
    });
    elements.sendCheck.addEventListener("click", evaluate);
    elements.sendPad.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      elements.sendPad.setPointerCapture(event.pointerId);
      beginPress(event.pointerId);
    });
    elements.sendPad.addEventListener("pointerup", (event) => {
      if (state.sendPointerId !== event.pointerId) return;
      event.preventDefault();
      finishPress();
    });
    elements.sendPad.addEventListener("pointercancel", (event) => {
      if (state.sendPointerId === event.pointerId) finishPress(true);
    });
    elements.sendPad.addEventListener("keydown", (event) => {
      if (event.code !== "Space" || event.repeat || state.sendKeyboardPressed) return;
      event.preventDefault();
      state.sendKeyboardPressed = true;
      beginPress();
    });
    elements.sendPad.addEventListener("keyup", (event) => {
      if (event.code !== "Space" || !state.sendKeyboardPressed) return;
      event.preventDefault();
      state.sendKeyboardPressed = false;
      finishPress();
    });
    elements.sendPad.addEventListener("blur", () => {
      if (!state.sendKeyboardPressed) return;
      state.sendKeyboardPressed = false;
      finishPress(true);
    });
  }

  return Object.freeze({ activate, bind, deactivate, finishPress, playTarget, render });
}
