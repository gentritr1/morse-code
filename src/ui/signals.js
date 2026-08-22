import { MORSE } from "../data/morse.js";

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

/**
 * Each character's marks live in one `<i class="mark-group">`, so a burst or a
 * word wraps between characters instead of splitting one letter across two
 * lines. The marks themselves stay `span`s, which is what the themes style.
 */
function createMarkGroup(pattern, textMode) {
  const group = document.createElement("i");
  group.className = "mark-group";
  group.append(...[...pattern].map((symbol) => createSignalMark(symbol, textMode)));
  return group;
}

/**
 * Before the answer, nothing on screen may encode the pattern. The marks are
 * always rendered — `animateMarks` needs one element per mark — but the
 * container carries `data-revealed`, and CSS collapses every mark to the same
 * dim square while that is `false`. Count may show; shape may not.
 */
export function renderSignal(container, text, textMode = false, revealed = true) {
  const value = String(text ?? "").toUpperCase();
  container.dataset.revealed = String(Boolean(revealed));
  const renderKey = `${value}:${textMode ? "text" : "bars"}`;
  if (container.dataset.renderKey === renderKey) return;

  const nodes = [];
  for (const character of value) {
    if (character === " ") {
      const gap = document.createElement("i");
      gap.className = "mark-space";
      nodes.push(gap);
      continue;
    }
    const pattern = MORSE[character];
    if (pattern) nodes.push(createMarkGroup(pattern, textMode));
  }

  container.replaceChildren(...nodes);
  container.dataset.renderKey = renderKey;
}

/** The answer keys only ever show the letters the learner has unlocked. */
export function buildAnswerGrid(container, letters, onAnswer) {
  const renderKey = letters.join("");
  if (container.dataset.renderKey === renderKey) return;

  const buttons = letters.map((letter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-key";
    button.dataset.letter = letter;
    button.textContent = letter;
    button.setAttribute("aria-label", `Answer ${letter}`);
    button.addEventListener("click", () => onAnswer(letter));
    return button;
  });
  container.replaceChildren(...buttons);
  container.dataset.renderKey = renderKey;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Lights the marks on the same schedule the oscillator is playing, so a word
 * with Farnsworth gaps looks exactly like it sounds. `schedule` comes from
 * `scheduleText` in the audio boundary; every container is expected to hold one
 * mark element per scheduled mark. Returns a cancel function.
 */
/** Playback starts this long after the schedule is handed over. */
export const PLAYBACK_LEAD_MS = 60;

export function animateMarks(containers, schedule) {
  const markGroups = containers.map((container) => [...container.querySelectorAll("[data-symbol]")]);
  let timers = [];

  function cancel() {
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
    for (const group of markGroups) {
      for (const mark of group) mark?.classList.remove("is-playing");
    }
  }

  cancel();
  if (prefersReducedMotion()) return cancel;

  const lead = PLAYBACK_LEAD_MS;
  schedule.forEach((mark, index) => {
    timers.push(
      window.setTimeout(() => {
        for (const group of markGroups) group[index]?.classList.add("is-playing");
      }, lead + mark.start),
      window.setTimeout(() => {
        for (const group of markGroups) group[index]?.classList.remove("is-playing");
      }, lead + mark.start + mark.duration),
    );
  });

  return cancel;
}
