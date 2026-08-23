import { KOCH_ORDER } from "../config.js";
import { MORSE, visiblePattern } from "../data/morse.js";
import {
  archiveHeading,
  archiveRemaining,
  archivedTransmissions,
  transmissionNumber,
} from "../data/transmissions.js";
import {
  label as letterLabel,
  letterBaseline,
  recognitionScore,
  retentionOf,
  retentionState,
} from "../features/performance-profile.js";
import { cabinMemory, nextLetterLine } from "../features/progress.js";

/**
 * The letters drawer is one list with two presentations: a column beside the
 * stage on wide screens, and a bottom sheet summoned from the machine footer on
 * handsets. The markup and the render pass are identical; only CSS moves it.
 */
export function createLettersController(context) {
  const { state, elements, announce } = context;

  /**
   * `22 Aug` — the only date the product ever prints. The month name is the
   * reader's, the order is ours: a log line reads day-first everywhere.
   */
  function formatDay(ts) {
    try {
      const date = new Date(ts);
      return `${date.getDate()} ${date.toLocaleDateString(undefined, { month: "short" })}`;
    } catch {
      return "";
    }
  }

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

  /**
   * The archive is a section of the drawer, not a screen: the messages the
   * learner has actually decoded, in catalog order, with nothing to press. The
   * note each one carries is spoken once, on the session-end card, and never
   * repeated here — a list that explains itself twice is a database.
   */
  function renderArchive() {
    const archive = state.progress.archive ?? {};
    const held = archivedTransmissions(archive);
    elements.lettersArchive.hidden = held.length === 0;
    elements.lettersArchiveCount.textContent = archiveHeading(archive);
    elements.lettersArchiveRemaining.textContent = archiveRemaining(archive);

    const renderKey = held.map((entry) => entry.id).join(",");
    if (elements.lettersArchiveList.dataset.renderKey === renderKey) return;
    elements.lettersArchiveList.replaceChildren(...held.map((entry) => {
      const row = document.createElement("li");
      const num = document.createElement("span");
      num.className = "archive-number";
      num.textContent = `no. ${transmissionNumber(entry.id)}`;
      const text = document.createElement("strong");
      text.textContent = entry.text.toLowerCase();
      const origin = document.createElement("small");
      origin.textContent = entry.origin;
      row.append(num, text, origin);
      return row;
    }));
    elements.lettersArchiveList.dataset.renderKey = renderKey;
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

    // One dated line, and only when something has actually happened. It is the
    // cabin's memory, not a log: the most recent fact, never a list.
    const memory = cabinMemory(state.performanceProfile, state.progress, state.events);
    elements.lettersMemory.hidden = !memory;
    elements.lettersMemory.textContent = memory ? `${formatDay(memory.ts)} · ${memory.text}` : "";

    renderArchive();

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
    context.trainer.pauseRound();
    render();
    elements.letters.focus?.({ preventScroll: true });
    announce("Letters open.");
  }

  function close(moveFocus = true) {
    if (!state.lettersOpen) return;
    state.lettersOpen = false;
    render();
    context.trainer.resumeRound();
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
