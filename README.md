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
- **Night Watch** — the endgame, and it stays locked until every one of the ten letters is `Stable` or `Instant`. Six stations you have been intercepting turn out to be six people, and something is happening outside that none of them will say on the air. Each night is a conversation held in Morse: they key a line in their own fist, over that night's radio conditions; you copy it on the same ten keys, then key your reply back on the paddle. The operators also talk in plain text on a strip above the lamp — atmosphere and procedure only, never the message before it has crossed in Morse. Your callsign has digits in it and digits will not key in ten letters, so the net gives you an on-air name the first time the gate opens. There is no countdown: the lamp's glow runs out instead, and in the first two Watches the station sends one fainter repeat before it closes down. A night that closes down unconfirmed calls again after a night — and **nothing in the whole mode touches your letters**, in either direction.

A confirmed night ends with one picture the machine draws itself — ASCII on the terminal, a mosaic on the teletext set, LCD pixels on the pocket unit — and one line about what happened. A night that was not confirmed gets no card; the absence is the record.

## Coming back

A returning visit opens with a short card instead of a signal: what came due while you were away, which characters have survived a night, or the pair that is still blurring together — at most two lines, each of them only there because the log says so, and `Nothing is due yet — this round is practice.` when none of them is true. `Start`, or `Enter`, begins the first round. It appears once per visit and never on a first-ever visit; the guide and the opening introduction cover those.

Your very first round is a transmission you cannot read. The **incoming** card plays `K M` behind blank marks, the trainer then teaches both characters, contrasts them, and sends the same transmission back as a round — and reading it says so: `You read it. Two minutes ago that was noise.`

The end of a session mentions the first time something lands: a character held to a seven-day interval, a whole word decoded with no replay, the first character that arrives instantly, all ten letters open. Each is said once, ever, and the card's tag reads `MILESTONE` when it happens. When there is enough evidence for it, the passage also says how fast you are recognising signals against a week ago, and which characters are scheduled to come back tomorrow. Nothing there is encouragement — if a line is not supported by the record, it is simply not written.

Your station has a callsign, minted on your first visit and shown on the machine plate (`AMBER TERMINAL · KX-412`). The Letters drawer keeps one dated line of what has actually happened, most recent first — `22 Aug · first word read unaided`. Both are cleared and re-minted by **Reset progress**.

## Unknown transmissions

Somewhere in a session, once every letter in it has been taught, a message arrives from a station that is not us — `ARMS` from Harbour Light, `SOS` from something unknown and very weak. It sounds over a faint bed of static, it is tagged `UNKNOWN TRANSMISSION · no. 3` above the marks, and it is decoded like any group of letters. Decode it and it is archived, with its origin; decode it with a replay or a hint and it is archived anyway, noted as having had help; miss it and it will come through again another day. Twelve exist, they arrive in the order your letters open them, and the archive is a short section at the bottom of the Letters drawer rather than a screen of its own. Each message says what it meant exactly once, on the card at the end of the session it arrived in.

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

The frontend is intentionally framework-free, and **development is build-free**. Native ES modules separate trainer behavior, the progression rules, the first-run guide, audio, storage, and DOM rendering. CSS is split into explicit cascade layers and loaded in parallel. Deployment adds one zero-dependency script that content-hashes the same files; nothing about writing them changes. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the extension model.

## Run locally

Serve this folder with any static web server, then open `index.html` through that server. For example:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

No install or build command is required for development: `index.html` loads `./src/*.js` and `./styles/*.css` exactly as they are written.

## Deploy

```sh
node scripts/build.mjs   # writes dist/ — no packages, Node 18+
```

Vercel runs that command itself (`vercel.json` sets `buildCommand` and `outputDirectory`), so deploying is a push. The script copies the site into `dist/`, renames every asset to `name.<8-hex>.ext` from a hash of its own contents, rewrites every import and `<link>`/`<script>` that pointed at it, and generates one `<link rel="modulepreload">` per module so the browser does not discover the graph one round trip at a time.

The caching contract, which is the reason the hashes exist:

- **Hashed assets** (`/src/**`, `/styles/**`, `/styles.<hash>.css`, `/favicon.<hash>.svg`) are served `public, max-age=31536000, immutable` — the browser never asks about them again, and a change ships under a new filename.
- **`/`** is the only unhashed URL: `max-age=0, must-revalidate` for the browser, `Vercel-CDN-Cache-Control: max-age=31536000` for the edge, so the document is always current and a deploy purges it.
- The result, measured: a cold visit costs 27 requests, a return visit costs **1**.

## First run

The guide is three steps: **hear your first letter**, **pick a rhythm**, **pick a machine**. The rhythm step plays the same two characters at each of the three presets so you can keep the one that arrives as sound rather than as marks you could count. Arrow keys move between the cards, `Space` auditions one, `Enter` chooses it. Reopening the guide from Settings shows the rhythm you are on.

You do not have to guess. **Measure my rhythm** on that step runs twelve pairs of signals — about two minutes — and asks only whether the two you just heard were the same character or two different ones; you never need to know which ones they were. `S` says same, `D` says different, `Space` plays the pair again, and the answers stay shut until the second signal has finished. Your starting speed is then the fastest rhythm you could still tell apart, and the room between characters comes from how long you took to decide. Settings › Speed has a **Measure** link that opens the same trial, and shows `Measured · 22 wpm` under the label once you have run it.

## Keyboard controls

- `Space`: replay the current signal (in Send, replay the target) — a replay means the round no longer counts as a first listen. Asking again while the signal is still sounding is ignored, and costs you nothing.
- `A–Z`: answer with an unlocked letter; in a group round the letters go in left to right
- `Backspace`: take back the last letter of a group round
- `Enter`: show a hint, start a sprint, confirm a new letter with **Got it**, continue past the incoming transmission, begin a returning visit with **Start**, or start the next session with **Keep going**
- `S` / `D`: during the placement trial in the guide, answer *same* or *different* (`Space` replays the pair)
- `Esc`: close settings, the letters drawer, or the guide — during the placement trial it discards the run and nothing is stored

The answer keys open when the last tone ends, not before: until then they sit dimmed and a keypress does nothing. Opening settings, the letters drawer or the guide, or leaving the page, pauses the round — the signal stops and nothing advances. If the signal had not finished, it plays again when you come back and the round counts as usual; if you had already heard it, the round is kept out of your record rather than scored on a memory.

## Progress and storage

Three keys hold everything, all read defensively and never wiped by an upgrade:

- `morse-trainer-progress-v1` — `{ "unlocked": 2, "newPaused": false, "effOffset": 0, "sessions": 0, "seeded": false, "placement": null, "callsign": "KX-412", "milestones": {}, "unaidedWords": 0, "archive": {} }`: how many characters are open, whether new ones are on hold, the spacing adjustment, how many sessions you have finished, whether the opening introduction has been given, your station callsign, the timestamp of each milestone you have reached, how many whole words you have read unaided, the transmissions you have decoded, and — once you have run it — the placement measurement (`{ chosen, effOffset, acc, lat, at }`). A record written before callsigns and milestones existed loads with an empty milestone map, a zero word count, and a freshly minted callsign that is then kept. A corrupted or unknown value simply starts you at two characters, and an unreadable measurement is dropped whole rather than half-applied.
- `morse-trainer-performance-v1` — per character: its phase (`acq`, `rev`, `rel`), stability, due time, acquisition step, lapse times, clean response times, plus clean first listens, replays and hints. Beside the characters it holds the confusion pairs, their cures and the reason each was missed, the per-character word-round counters, the pooled response logs, and the log of clean sends. A profile written before this scheduler existed is *placed*, not reset: a character with five clean first listens and a good recent record starts in review, due twenty hours after you last saw it, and everything else starts learning. Old confusion counts become that many timestamps, and old `mirrorAttempts` are still read once as `sendAttempts`.
- `morse-trainer-events-v1` — one append-only record per answered signal, capped at 4000. It is the only thing that can say whether a character survived a night, because a counter can only say how it is doing now.

A stored mode of `drill` from an earlier version opens Learn. **Reset progress** in Settings clears all three keys and the sprint best after a confirmation press; it also stops any signal that is playing, cancels every pending timer, and puts you back at the opening introduction without reloading the page.

## Development parameters

`?theme=terminal|teletext|pocket` and `?mode=learn|sprint|send` open a specific machine and mode. `?guide=off` suppresses the first-run guide for screenshots and visual checks; it does not change stored progress.
