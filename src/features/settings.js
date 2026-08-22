import { SPEEDS, STORAGE_KEYS, THEMES } from "../config.js";
import { writeEvents } from "./events.js";
import { createEmptyPerformanceProfile } from "./performance-profile.js";
import { createProgress, writeProgress } from "./progress.js";

/**
 * Everything that is not practice lives here: machine, speed, guide and reset.
 * One element, two presentations — an anchored popover on pointer-size screens
 * and a bottom sheet on handsets (CSS decides which).
 */
export function createSettingsController(context) {
  const { state, elements, storage, announce } = context;
  let resetTimer = null;

  function isOpen() {
    return elements.settingsPanel.matches(":popover-open");
  }

  function isSheet() {
    return window.matchMedia("(max-width: 39.9375rem)").matches;
  }

  // The sheet is positioned entirely in CSS; only the anchored popover needs numbers.
  function position() {
    if (isSheet()) return;
    const trigger = elements.settingsButton.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(340, window.innerWidth - gutter * 2);
    const left = Math.max(gutter, Math.min(trigger.right - width, window.innerWidth - width - gutter));
    elements.settingsPanel.style.setProperty("--panel-width", `${width}px`);
    elements.settingsPanel.style.setProperty("--panel-left", `${left}px`);
    elements.settingsPanel.style.setProperty("--panel-top", `${trigger.bottom + 8}px`);
  }

  function close() {
    if (isOpen()) elements.settingsPanel.hidePopover();
  }

  function groupFor(element) {
    return element.closest(".machine-picker, .speed-segments");
  }

  function handleGroupKeydown(event) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const group = groupFor(event.currentTarget);
    if (!group) return;
    const options = [...group.querySelectorAll("button")];
    const index = options.indexOf(event.currentTarget);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else next = options.length - 1;

    event.preventDefault();
    options[next]?.focus();
  }

  function disarmReset() {
    if (resetTimer) window.clearTimeout(resetTimer);
    resetTimer = null;
    state.resetArmed = false;
  }

  function resetProgress() {
    if (!state.resetArmed) {
      state.resetArmed = true;
      context.render();
      announce("Press Confirm reset within five seconds to clear your progress.");
      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        state.resetArmed = false;
        context.render();
      }, 5000);
      return;
    }

    disarmReset();
    state.progress = createProgress();
    state.performanceProfile = createEmptyPerformanceProfile();
    state.events = [];
    writeProgress(storage, state.progress);
    context.persistProfile();
    writeEvents(storage, state.events);
    storage.set(STORAGE_KEYS.sprintBest, 0);
    context.trainer.resetSession();
    announce("Progress reset. You are back to two letters.");
  }

  function render() {
    for (const button of elements.themeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === state.theme));
    }
    for (const button of elements.difficultyButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficulty));
    }
    elements.resetProgress.textContent = state.resetArmed ? "Confirm reset" : "Reset progress";
    elements.resetProgress.dataset.armed = String(state.resetArmed);
  }

  function bind() {
    elements.settingsButton.addEventListener("click", position);
    elements.settingsPanel.addEventListener("toggle", (event) => {
      const open = event.newState === "open";
      elements.settingsButton.setAttribute("aria-expanded", String(open));
      if (open) {
        position();
        window.requestAnimationFrame(() => {
          elements.themeButtons
            .find((button) => button.dataset.themeChoice === state.theme)
            ?.focus({ preventScroll: true });
        });
        return;
      }
      disarmReset();
      render();
      if (document.activeElement === document.body) {
        elements.settingsButton.focus({ preventScroll: true });
      }
    });

    for (const button of elements.themeButtons) {
      button.addEventListener("click", () => {
        if (Object.hasOwn(THEMES, button.dataset.themeChoice)) context.trainer.setTheme(button.dataset.themeChoice);
      });
      button.addEventListener("keydown", handleGroupKeydown);
    }
    for (const button of elements.difficultyButtons) {
      button.addEventListener("click", () => {
        if (Object.hasOwn(SPEEDS, button.dataset.difficulty)) context.trainer.setDifficulty(button.dataset.difficulty);
      });
      button.addEventListener("keydown", handleGroupKeydown);
    }

    elements.showGuide.addEventListener("click", () => {
      close();
      context.guide.open();
    });
    elements.resetProgress.addEventListener("click", resetProgress);
    window.addEventListener("resize", () => {
      if (isOpen()) position();
    });
  }

  return Object.freeze({ bind, close, render });
}
