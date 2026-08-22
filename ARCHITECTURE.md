# Frontend architecture

Morse Trainer is a zero-dependency static web application. It uses native ES modules and modern CSS so it can run from any static host without a build step.

## JavaScript boundaries

```text
src/
├── app.js                         Composition root and initial state
├── config.js                      Stable product configuration
├── data/
│   └── morse.js                   Morse domain data and pattern helpers
├── features/
│   ├── onboarding.js              First-run guide
│   ├── speed-picker.js            Popover and keyboard behavior
│   ├── trainer.js                 Learn, Drill, Sprint, and clinic rounds
│   ├── signal-lab.js              Signal Lab interaction controller
│   └── signal-lab/
│       └── performance-profile.js Pure adaptive-learning calculations
├── platform/
│   ├── morse-audio.js             Web Audio boundary
│   └── storage.js                 Resilient localStorage boundary
└── ui/
    ├── elements.js                Required DOM contract
    └── signals.js                 Shared signal and answer rendering
```

`src/app.js` is the composition root. It creates one shared context, wires feature controllers, and owns the single top-level render function. Feature modules receive their dependencies instead of importing one another, which keeps the dependency direction explicit and prevents circular imports.

The performance profile is separated from its view controller because it is domain logic: it can later be tested, moved to a worker, or synced to an account without rewriting Echo Mirror or the trainer.

## CSS boundaries

```text
styles/
├── foundation.css      Tokens, reset, app bar, toolbar, and popover
├── onboarding.css      First-run guide and coach strip
├── trainer.css         Shared machine structure and practice controls
├── themes.css          Terminal, Teletext, and Pocket variants
├── signal-lab.css      Echo Mirror, Fingerprint, and Clinic
├── responsive.css      Viewport and orientation adaptations
└── accessibility.css   Reduced motion and forced-colors support
```

The root `styles.css` declares cascade order. Every stylesheet wraps its rules in a named `@layer`, and the HTML loads them in parallel. This gives the modular files deterministic precedence without an `@import` waterfall or specificity escalation.

The interface intentionally uses native platform features where they improve the product:

- ES modules, private class fields, optional chaining, and `Object.hasOwn`
- the Popover API for the custom speed picker
- cascade layers, `oklch()`, and `color-mix()` for predictable theme styling
- Pointer Events and Web Audio for the Morse paddle
- `prefers-reduced-motion` and `forced-colors` adaptations

## Extending the product

Add new Morse data in `src/data/morse.js`. Add a new trainer path in `src/features/trainer.js` only when it shares the existing round lifecycle. Add a new independent adaptive tool beside `src/features/signal-lab.js`, then register its controller in `src/app.js`.

Keep platform access behind `src/platform/`. New persistence, account sync, microphone input, or analytics should not be called directly from rendering code.

Prefer a new file when a capability has its own state lifecycle, platform dependency, or testing boundary. Keep code together when it changes for the same reason; file size alone is not an architecture rule.
