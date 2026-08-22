export function createSpeedPickerController(context) {
  const { state, elements } = context;

  function positionMenu() {
    const triggerRect = elements.speedTrigger.getBoundingClientRect();
    const viewportGutter = 12;
    const menuWidth = Math.min(Math.max(320, triggerRect.width), window.innerWidth - viewportGutter * 2);
    const estimatedMenuHeight = 208;
    const left = Math.max(
      viewportGutter,
      Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - viewportGutter),
    );
    const fitsBelow = triggerRect.bottom + estimatedMenuHeight + 8 <= window.innerHeight;
    const top = fitsBelow
      ? triggerRect.bottom + 8
      : Math.max(viewportGutter, triggerRect.top - estimatedMenuHeight - 8);

    elements.speedMenu.style.setProperty("--menu-width", `${menuWidth}px`);
    elements.speedMenu.style.setProperty("--menu-left", `${left}px`);
    elements.speedMenu.style.setProperty("--menu-top", `${top}px`);
    elements.speedMenu.style.transformOrigin = fitsBelow ? "top right" : "bottom right";
  }

  function isOpen() {
    return elements.speedMenu.matches(":popover-open");
  }

  function open(focusLast = false) {
    positionMenu();
    if (!isOpen()) elements.speedMenu.showPopover();

    window.requestAnimationFrame(() => {
      const target = focusLast
        ? elements.difficultyOptions.at(-1)
        : elements.difficultyOptions.find((option) => option.dataset.difficulty === state.difficulty);
      target?.focus();
    });
  }

  function select(difficulty) {
    context.trainer.setDifficulty(difficulty);
    if (isOpen()) elements.speedMenu.hidePopover();
    elements.speedTrigger.focus();
  }

  function handleTriggerKeydown(event) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    open(event.key === "ArrowUp" || event.key === "End");
  }

  function handleMenuKeydown(event) {
    const activeIndex = elements.difficultyOptions.indexOf(document.activeElement);
    let nextIndex = activeIndex;

    if (["Enter", " "].includes(event.key) && activeIndex >= 0) {
      event.preventDefault();
      select(elements.difficultyOptions[activeIndex].dataset.difficulty);
      return;
    }

    if (event.key === "ArrowDown") nextIndex = Math.min(elements.difficultyOptions.length - 1, activeIndex + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, activeIndex - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = elements.difficultyOptions.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      elements.speedMenu.hidePopover();
      elements.speedTrigger.focus();
      return;
    } else {
      return;
    }

    event.preventDefault();
    elements.difficultyOptions[nextIndex]?.focus();
  }

  function bind() {
    elements.speedTrigger.addEventListener("click", positionMenu);
    elements.speedTrigger.addEventListener("keydown", handleTriggerKeydown);
    elements.speedMenu.addEventListener("keydown", handleMenuKeydown);
    elements.speedMenu.addEventListener("toggle", (event) => {
      const menuIsOpen = event.newState === "open";
      elements.speedTrigger.setAttribute("aria-expanded", String(menuIsOpen));
      if (menuIsOpen) positionMenu();
    });
    for (const option of elements.difficultyOptions) {
      option.addEventListener("click", () => select(option.dataset.difficulty));
    }
    window.addEventListener("resize", () => {
      if (isOpen()) positionMenu();
    });
  }

  return Object.freeze({ bind });
}
