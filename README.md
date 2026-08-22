# Morse Trainer

A responsive Morse-code learning game with one shared training engine and three switchable visual themes:

- Amber Terminal
- Broadcast Teletext
- Pocket Trainer CW-83

The selected theme persists between visits without resetting the active session. Learn, Drill, and Sprint modes support mouse, touch, and keyboard input.

The frontend is intentionally framework-free and build-free. Native ES modules separate trainer behavior, onboarding, adaptive learning, audio, storage, and DOM rendering. CSS is split into explicit cascade layers and loaded in parallel. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the extension model.

## Run locally

Serve this folder with any static web server, then open `index.html` through that server. For example:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

No install or build command is required.

## Keyboard controls

- `Space`: replay the current Morse signal
- `A–Z`: answer with a letter from the starter set
- `Enter`: show a hint or start/restart a sprint
- `Left` / `Right`: move through guided lessons
