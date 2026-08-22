import { MORSE, STARTER_POOL, visiblePattern } from "../data/morse.js";

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

export function renderSignal(container, pattern, textMode = false) {
  const renderKey = `${pattern}:${textMode ? "text" : "bars"}`;
  if (container.dataset.renderKey === renderKey) return;

  container.replaceChildren(...pattern.split("").map((symbol) => createSignalMark(symbol, textMode)));
  container.dataset.renderKey = renderKey;
}

export function buildRoster(container) {
  const rows = STARTER_POOL.map((letter) => {
    const row = document.createElement("li");
    row.dataset.letter = letter;

    const letterCell = document.createElement("strong");
    letterCell.textContent = letter;

    const patternCell = document.createElement("span");
    patternCell.className = "roster-pattern";
    patternCell.textContent = visiblePattern(MORSE[letter]);
    row.append(letterCell, patternCell);
    return row;
  });
  container.replaceChildren(...rows);
}

export function buildAnswerGrid(container, onAnswer) {
  const buttons = STARTER_POOL.map((letter) => {
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
}
