# Morse Trainer

A responsive Morse-code learning game with one shared training engine and three switchable machines:

- Amber Terminal
- Broadcast Teletext
- Pocket Trainer CW-83

The whole app is a single surface — the machine. Settings, the first-run guide and the letters drawer open over it.

## Modes

- **Learn** — the main path, and a guided session of twenty rounds (about five minutes, plus anything that slipped and had to come back) that runs in five parts: **arrive** on what you already know, **repair** the weak spots, take delivery of a **new** character, **mix** everything, then **use** it on groups and words. A five-segment rail under the Letters count shows which part you are in. You start with two characters, `K` and `M`, and your very first session opens by introducing each of them and then contrasting the two before anything adaptive begins. The trainer picks every round for you from how you have actually been doing: a review of something going stale, the character you keep missing, the pair your ear is blending, or a short group of characters — sometimes a real word like `MARK` or `STORM`. Answer a group by typing its letters in order; `Backspace` takes the last one back, and the round checks itself when you reach the full length. The next character opens with a short introduction card, and when it opens is decided by how much work you already have: new letters wait while reviews are piling up, while more than two characters are still settling, or while your clean accuracy has slipped, and they resume once things have cleared with room to spare rather than the moment you scrape past the line. The order is Koch-derived: `K M R S A T O I N E`. The ear leads: while a signal is sounding you see its real marks, and before and after it every mark is the same dim square — the count is honest, the shape stays in your ear until your answer or a hint reveals it. At the end of a session you get up to three short sentences about how it went and a **Keep going** button.
- **Sprint** — 30 seconds, as many letters as you can, at the speed you have chosen. It stays locked until five characters are open, because it is a checkpoint rather than a starting point. The marks stay hidden while you listen here too. Your best is remembered.
- **Send** — hear a target, then key it back on the paddle. Tap for a dot, hold for a dash. Nothing stops you at the target's length: key as much or as little as you like, and **Check** reads the whole transmission — the pattern first, then how long your dots and dashes ran and how much room you left between them. Nothing is measured against the machine's clock: the symbols are read from your own long/short split, and your unit is fitted from what you actually sent, so sending everything a little fast is not confused with sending it out of proportion. Under the readout, three short rows compare **You** with **Ideal** for dot, dash and gap, say in words what is off (`dashes short`, `gaps long`), and one line names your fist across the last few clean sends: `Rhythm · developing`, or `Rhythm · 3 of 5 clean sends` until there are enough to judge.

## Remembering, not just recognising

**Repeating something in one sitting does not make it yours.** A character has to come back cleanly after a real gap before the trainer will leave it alone for longer, so answering it four times in five minutes proves it is in short-term memory and nothing else. Two clean answers at least three minutes apart move a character out of learning and into review at twenty hours; after that the gap only grows — twenty hours, three days, a week, two weeks, a month, two months — and only when a review that was genuinely due comes back clean and unhurried. Answering it early is fine and is simply practice. Answer it slowly and it comes back sooner instead. A replay is free and honest, but a signal you needed twice is practice rather than proof — it is not counted for or against you, and the character simply returns a few rounds later. The same is true of a round you walked away from: if the tab loses focus between the signal and your answer, nothing is counted at all and the status line says so. Miss it and it drops a level, or two if it has slipped before recently, and returns inside the same session.

Each row in the letters drawer says where a character stands in one word — `Unheard`, `New`, `Settling`, `Steady`, `Stable`, `Instant` — and how brightly it burns is how likely it still is to be there. A row with an overdue review carries a small dim dot. Nothing needs to be read; brighter simply means it will last.

Sessions also mention retention in plain words when there is enough of it to mention: `3 of 4 signals survived a night.` Never a percentage.

## Spacing that meets you

Characters are never slowed down, but the gaps between them are. Miss two group rounds in a row and the spacing widens; get five clean in a row and it tightens back toward the preset you chose. Settings always shows the preset, not the adjustment.

## Speed

The three presets are Farnsworth: the characters always arrive fast enough to be heard as one sound, and only the space between them changes. Counting a slow dash is a habit that caps you later.

| Preset | Characters | Overall | Feel |
| --- | --- | --- | --- |
| Gentle | 18 wpm | 8 wpm | wide gaps |
| Steady | 22 wpm | 10 wpm | the default |
| Brisk | 25 wpm | 14 wpm | tight gaps |

The selected machine and speed persist between visits without resetting the active session.

The frontend is intentionally framework-free and build-free. Native ES modules separate trainer behavior, the progression rules, the first-run guide, audio, storage, and DOM rendering. CSS is split into explicit cascade layers and loaded in parallel. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the extension model.

## Run locally

Serve this folder with any static web server, then open `index.html` through that server. For example:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

No install or build command is required.

## First run

The guide is three steps: **hear your first letter**, **pick a rhythm**, **pick a machine**. The rhythm step plays the same two characters at each of the three presets so you can keep the one that arrives as sound rather than as marks you could count. Arrow keys move between the cards, `Space` auditions one, `Enter` chooses it. Reopening the guide from Settings shows the rhythm you are on.

## Keyboard controls

- `Space`: replay the current signal (in Send, replay the target) — a replay means the round no longer counts as a first listen. Asking again while the signal is still sounding is ignored, and costs you nothing.
- `A–Z`: answer with an unlocked letter; in a group round the letters go in left to right
- `Backspace`: take back the last letter of a group round
- `Enter`: show a hint, start a sprint, confirm a new letter with **Got it**, or start the next session with **Keep going**
- `Esc`: close settings, the letters drawer, or the guide

The answer keys open when the last tone ends, not before: until then they sit dimmed and a keypress does nothing. Opening settings, the letters drawer or the guide, or leaving the page, pauses the round — the signal stops and nothing advances. If the signal had not finished, it plays again when you come back and the round counts as usual; if you had already heard it, the round is kept out of your record rather than scored on a memory.

## Progress and storage

Three keys hold everything, all read defensively and never wiped by an upgrade:

- `morse-trainer-progress-v1` — `{ "unlocked": 2, "newPaused": false, "effOffset": 0, "sessions": 0, "seeded": false }`: how many characters are open, whether new ones are on hold, the spacing adjustment, how many sessions you have finished, and whether the opening introduction has been given. A corrupted or unknown value simply starts you at two characters.
- `morse-trainer-performance-v1` — per character: its phase (`acq`, `rev`, `rel`), stability, due time, acquisition step, lapse times, clean response times, plus clean first listens, replays and hints. Beside the characters it holds the confusion pairs, their cures and the reason each was missed, the per-character word-round counters, the pooled response logs, and the log of clean sends. A profile written before this scheduler existed is *placed*, not reset: a character with five clean first listens and a good recent record starts in review, due twenty hours after you last saw it, and everything else starts learning. Old confusion counts become that many timestamps, and old `mirrorAttempts` are still read once as `sendAttempts`.
- `morse-trainer-events-v1` — one append-only record per answered signal, capped at 4000. It is the only thing that can say whether a character survived a night, because a counter can only say how it is doing now.

A stored mode of `drill` from an earlier version opens Learn. **Reset progress** in Settings clears all three keys and the sprint best after a confirmation press; it also stops any signal that is playing, cancels every pending timer, and puts you back at the opening introduction without reloading the page.

## Development parameters

`?theme=terminal|teletext|pocket` and `?mode=learn|sprint|send` open a specific machine and mode. `?guide=off` suppresses the first-run guide for screenshots and visual checks; it does not change stored progress.
