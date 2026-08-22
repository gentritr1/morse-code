# Trainer page override

This page is a focused product surface, not a marketing landing page. These rules override the generated master wherever they conflict.

## Experience model

- One learning engine powers three switchable themes: Terminal, Teletext, and Pocket Trainer.
- Theme changes never reset the active lesson, target, score, streak, timer, or selected difficulty.
- Learn, Drill, and Sprint are the only top-level modes. The signal remains the visual center of gravity.
- On desktop, use the extra width for the starter alphabet and session context. On mobile, prioritize the active exercise and visible controls.
- First use is a skippable three-step path: hear a real signal, choose a practice goal, then choose a machine. Completion is remembered, and “How it works” can reopen it at any time.
- Keep a compact path coach visible during practice so the active learning loop is understandable without reopening the guide.

## Visual direction

- Global shell: quiet neutral near-black with a restrained teal focus/selection color derived from the project seed `oklch(0.72 0.10 188)`.
- Terminal: amber phosphor on brown-black, monospaced type, square controls, sparse glow only on the active signal.
- Teletext: deep broadcast blue, VT323 pixel type, cyan/yellow/magenta/green system bars, block-shaped Morse marks.
- Pocket Trainer: graphite plastic, grey-green recessed LCD, rubber keys, silkscreen labels, restrained red play control.
- Use theme color as structure and state, never as decoration detached from function.

## Type

- Shell and Pocket Trainer: Archivo with a system sans fallback.
- Terminal and data: DM Mono with Courier New fallback.
- Teletext: VT323 with DM Mono fallback.
- Minimum functional copy size is 14px. Use tabular numerals for timers and scores.

## Components and motion

- Minimum control target: 44×44px, with at least 8px between targets.
- Branded selection menus use a styled popover/listbox with full keyboard navigation; do not fall back to an unstyled browser select.
- One border or one compact shadow per surface; do not combine borders with wide decorative shadows.
- Radii: 4px for machine controls, 8–12px for the outer machine and shell controls, pills only for segmented selectors.
- Interaction transitions use 180–220ms ease-out-quart. Theme changes crossfade the machine surface; practice content never waits for an entrance animation.
- Reduced-motion mode removes transitions and the terminal cursor blink.

## Accessibility

- WCAG 2.2 AA contrast, strong visible focus, logical tab order, keyboard shortcuts, and an aria-live result announcement.
- Never rely on theme color alone for correct/incorrect status; always pair it with explicit text.
- Every signal is both audible and visible. Audio failure must not block the exercise.
