import { KOCH_ORDER } from "../config.js";
import { MORSE, visiblePattern } from "../data/morse.js";
import {
  label as letterLabel,
  letterBaseline,
  recognitionScore,
  retentionOf,
  retentionState,
} from "../features/performance-profile.js";
import { nextLetterLine } from "../features/progress.js";

/**
 * The letters drawer is one list with two presentations: a column beside the
 * stage on wide screens, and a bottom sheet summoned from the machine footer on
 * handsets. The markup and the render pass are identical; only CSS moves it.
 */
export function createLettersController(context) {
  const { state, elements, announce } = context;

  function dimmedPattern(letter) {
    return Array.from(MORSE[letter], () => "·").join(" ");
  }

  function buildRow(letter, index) {
    const now = Date.now();
    const unlocked = index < state.progress.unlocked;
    const metrics = state.performanceProfile.letters[letter];
    // Heard, not scored: an interrupted or replay-assisted round still means
    // the learner has met the character, so the pattern stops being a secret.
    const heard = metrics.attempts > 0 || metrics.exposures > 0 || state.revealedLetters.includes(letter);
    const row = document.createElement("li");
    row.dataset.letter = letter;
    row.dataset.locked = String(!unlocked);

    const letterCell = document.createElement("strong");
    letterCell.textContent = letter;

    const pattern = document.createElement("span");
    pattern.className = "letter-pattern";
    if (unlocked && heard) {
      pattern.textContent = visiblePattern(MORSE[letter]);
    } else {
      pattern.textContent = dimmedPattern(letter);
      pattern.dataset.placeholder = "true";
    }

    const track = document.createElement("span");
    track.className = "recognition-track";
    const fill = document.createElement("span");
    fill.style.setProperty("--recognition", recognitionScore(metrics).toFixed(3));
    track.append(fill);

    const label = document.createElement("small");
    label.textContent = unlocked
      ? letterLabel(metrics, letterBaseline(state.performanceProfile, letter))
      : "Locked";

    // Retention, not recognition: how bright the row burns is how likely the
    // character is to still be there. No legend — brighter means it will last.
    const retention = unlocked ? retentionState(metrics, now) : "locked";
    row.dataset.retention = retention;
    if (unlocked) {
      row.style.setProperty("--row-brightness", (0.55 + 0.45 * retentionOf(metrics, now)).toFixed(3));
    }
    const dot = document.createElement("i");
    dot.className = "retention-dot";
    dot.setAttribute("aria-hidden", "true");

    row.append(letterCell, pattern, track, label, dot);
    const retentionWord = retention === "stable" ? " Stable." : retention === "fading" ? " Fading." : "";
    row.setAttribute("aria-label", `${letter}. ${unlocked ? label.textContent : "Locked"}.${retentionWord}`);
    return row;
  }

  function render() {
    const { progress } = state;
    elements.lettersCount.textContent = `Letters · ${progress.unlocked} / ${KOCH_ORDER.length}`;
    elements.lettersNext.textContent = nextLetterLine(
      state.performanceProfile,
      progress,
      Date.now(),
      Boolean(state.introLetter),
    );

    elements.sessionScore.textContent = `${state.correct} / ${state.total}`;
    elements.bestScore.textContent = `Best ${state.sprintBest}`;
    elements.bestScore.hidden = !state.sprintCompleted && state.sprintBest === 0;

    const highlight = state.mode !== "send" && state.lastOutcome !== null ? state.target : "";
    const renderKey = KOCH_ORDER.map((letter, index) => {
      const metrics = state.performanceProfile.letters[letter];
      return `${index < state.progress.unlocked ? "u" : "l"}${metrics.attempts}/${metrics.exposures}:${metrics.phase}${metrics.stab}:${metrics.step}:${Math.round(metrics.dueAt / 60000)}:${Math.round(metrics.lastOk / 60000)}:${metrics.rts.length}:${state.revealedLetters.includes(letter) ? "r" : ""}`;
    }).join("|");

    if (elements.lettersList.dataset.renderKey !== renderKey) {
      elements.lettersList.replaceChildren(...KOCH_ORDER.map(buildRow));
      elements.lettersList.dataset.renderKey = renderKey;
    }
    for (const row of elements.lettersList.children) {
      row.classList.toggle("current", highlight.includes(row.dataset.letter));
    }

    elements.lettersToggle.setAttribute("aria-expanded", String(state.lettersOpen));
    document.body.dataset.letters = state.lettersOpen ? "open" : "closed";
    elements.sheetScrim.hidden = !state.lettersOpen;
  }

  function open() {
    state.lettersOpen = true;
    render();
    elements.letters.focus?.({ preventScroll: true });
    announce("Letters open.");
  }

  function close(moveFocus = true) {
    if (!state.lettersOpen) return;
    state.lettersOpen = false;
    render();
    if (moveFocus) elements.lettersToggle.focus({ preventScroll: true });
  }

  function bind() {
    elements.lettersToggle.addEventListener("click", () => {
      if (state.lettersOpen) close();
      else open();
    });
    elements.sheetScrim.addEventListener("click", () => close());
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !state.lettersOpen) return;
      event.preventDefault();
      close();
    });
  }

  return Object.freeze({ bind, close, open, render });
}
