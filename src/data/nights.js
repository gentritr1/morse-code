/**
 * Night Watch: the authored data, and the audit that keeps it honest.
 *
 * Two layers live in here. Layer 1 is everything keyed or decoded, in either
 * direction, spelled from the ten letters and the word space — no digits and no
 * punctuation, because those are the only characters the learner has. Layer 2
 * is the operators talking, in plain text, and it may react to what was decoded
 * but never carry the message before the Morse does. `auditNights` is what makes
 * both of those rules facts rather than intentions.
 *
 * The beat format is the whole format, including the fields nights 5–8 need
 * (`mask`, `cut`, `fistOverride`, `cue`, `silent`). Only nights 1–4 ship here;
 * the later nights are data, not code, and drop into this file unchanged.
 */

/** The only characters any Layer 1 string may contain, besides the word space. */
export const WATCH_KEYS = Object.freeze(["K", "M", "R", "S", "A", "T", "O", "I", "N", "E"]);

/**
 * A fist is a keying personality, expressed as multipliers on the Cabin's own
 * Farnsworth output: `unit` scales the dot, `dash` and `intra` are element
 * ratios, `letter` and `word` scale the Farnsworth gaps (nominally 3 and 7),
 * `jitDot` / `jitDash` are per-element timing spread, `hesit` is the chance of a
 * doubled letter gap, and `amp` is signal strength. Experienced operators
 * recognise each other by this, which is why it is data rather than decoration.
 */
export const OPS = Object.freeze({
  SEAMARK: {
    place: "Harbour Light",
    who: "Holt",
    fist: { unit: 1.15, dash: 3.4, intra: 1.1, letter: 3.6, word: 7.5, jitDot: 0.03, jitDash: 0.03, hesit: 0.05, amp: 1 },
    band: { clean: "Steady hand.", dev: "That will do.", read: "Slow hands survive long nights." },
    mem: {
      good: "I knew you would answer.",
      bad: "I was not sure you were still there.",
      away: "You were away. The lamp does not mind waiting.",
    },
  },
  STONE: {
    place: "Ridge Relay",
    who: "Wren",
    fist: { unit: 0.82, dash: 2.6, intra: 0.9, letter: 2.3, word: 6, jitDot: 0.14, jitDash: 0.14, hesit: 0, amp: 0.95 },
    band: { clean: "Clean. Faster than last time.", dev: "Good enough for tonight.", read: "Your gaps ran together. So do mine." },
    mem: {
      good: "You keep up better than most.",
      bad: "I sent it twice and got nothing back.",
      away: "You missed a few nights. The ridge did too.",
    },
  },
  ROTOR: {
    place: "Mill Station",
    who: "Sal",
    fist: { unit: 1, dash: 3, intra: 1, letter: 3, word: 8.5, jitDot: 0.02, jitDash: 0.02, hesit: 0, amp: 1 },
    band: { clean: "Like a machine. I mean that kindly.", dev: "Read through.", read: "Long dashes. I counted them." },
    mem: {
      good: "You have not sent me a wrong ground yet.",
      bad: "I waited at the key, then went back to work.",
      away: "The mill ran without you. It was quieter.",
    },
  },
  MARKER: {
    place: "North Buoy",
    who: "Pike",
    fist: { unit: 1, dash: 3, intra: 1, letter: 3, word: 7, jitDot: 0, jitDash: 0, hesit: 0, amp: 0.72 },
    band: { clean: "No reply. The keyer runs on.", dev: "No reply. The keyer runs on.", read: "No reply. The keyer runs on." },
    mem: {
      good: "The buoy does not remember. It only repeats.",
      bad: "The buoy does not remember. It only repeats.",
      away: "The buoy does not remember. It only repeats.",
    },
  },
  STRAIT: {
    place: "Long Point",
    who: "Iris",
    // Her tell: an extra letter gap of pause before a closing K.
    fist: { unit: 1.05, dash: 3.1, intra: 1, letter: 3.2, word: 7.2, jitDot: 0.04, jitDash: 0.04, hesit: 0, amp: 1, pauseBeforeK: true },
    band: { clean: "Textbook. Logged.", dev: "Logged, with a note.", read: "I had to guess two letters. Do not make me guess." },
    mem: {
      good: "Your callsign is in my log more than anyone\u2019s.",
      bad: "I logged the silence. That is all I logged.",
      away: "Nothing from you for days. I left the page blank.",
    },
  },
  SMOKE: {
    place: "Summit Hut",
    who: "Ada",
    fist: { unit: 1.1, dash: 3, intra: 1.2, letter: 3.4, word: 7.5, jitDot: 0.18, jitDash: 0.05, hesit: 0.15, amp: 0.7 },
    band: { clean: "Clear as a bell up here.", dev: "I got it.", read: "You sound as cold as I am." },
    mem: {
      good: "It helps, knowing someone is down there.",
      bad: "I keyed into nothing for an hour. Cold work.",
      away: "I kept the stove going. Habit.",
    },
  },
});

/**
 * Radio conditions, not difficulty labels: each Watch adds one axis. Watches 3
 * and 4 are defined because the nights that use them are authored against these
 * numbers; nothing in this pass reaches them.
 */
export const WATCHES = Object.freeze({
  1: { name: "Clear Channel", noise: 0.015, fade: 0, drop: 0, expr: 0.6, autoRepeat: true, repeats: 2, speed: 0, win: 42000 },
  2: { name: "Fading Signal", noise: 0.05, fade: 0.45, drop: 0.05, expr: 1, autoRepeat: true, repeats: 1, speed: 0, win: 36000 },
  3: { name: "Deep Night", noise: 0.07, fade: 0.45, drop: 0.04, expr: 1, autoRepeat: false, repeats: 1, speed: 2, win: 30000 },
  4: { name: "Blackout", noise: 0.11, fade: 0.5, drop: 0.07, expr: 1, autoRepeat: false, repeats: 0, speed: 2, win: 30000 },
});

/**
 * The memory card, drawn three ways. `art` is the terminal's ASCII idiom;
 * `grid` is the same picture as a mosaic the teletext set fills with blocks and
 * the pocket unit renders as LCD pixels. `#` is structure, `o` the accent, `-` a
 * horizon, `x` something struck out, `.` nothing. No images, no assets.
 */
export const ART = Object.freeze({
  lamp: "   \\   |   /\n    \\  |  /\n  ----[O]----\n       |\n  ~~~~~~~~~~~",
  log: "  +-------------+\n  | IRENE  NOON |\n  +-------------+\n     |     |\n  ---+-----+---",
  ground: "      /  x  \\\n     /       \\\n  --o    .    o--\n     \\_______/\n       SEA MOOR",
  peak: "        /\\\n       /  \\ .\n      /    \\\n   __/      \\__\n    .  .  .   .",
});

export const GRIDS = Object.freeze({
  lamp: Object.freeze([
    "o...........o",
    "..o.......o..",
    "....o###o....",
    ".....###.....",
    ".....###.....",
    "....#####....",
    "-------------",
  ]),
  log: Object.freeze([
    "#############",
    "#...........#",
    "#.oo.o.ooo..#",
    "#...........#",
    "#.ooo.oo.o..#",
    "#############",
    "..---------..",
  ]),
  ground: Object.freeze([
    "..x.......o..",
    "...x.....o...",
    "....x...o....",
    ".....x.o.....",
    "......#......",
    "......#......",
    "......#......",
  ]),
  peak: Object.freeze([
    "......#......",
    ".....###...o.",
    "....#####....",
    "...#######...",
    "..#########..",
    ".###########.",
    "-------------",
  ]),
});

/**
 * The nights. `{C}` is the learner's on-air name; every Layer 1 string resolves
 * it before it is keyed or compared. `before` is Layer 2 and arrives before the
 * transmission, which is exactly why the audit checks it for leaks.
 */
export const NIGHTS = Object.freeze([
  {
    id: 1,
    watch: 1,
    station: "SEAMARK",
    title: "The first answer",
    cond: "Clear. Sea calm.",
    card: { art: ART.lamp, grid: GRIDS.lamp, line: "Harbour Light answered on the first call." },
    close: "Holt has your callsign written down now.",
    beats: [
      {
        from: "SEAMARK",
        before: ["I have called your callsign three nights running.", "Answer when you have it."],
        rx: "{C} SEAMARK K",
        tx: { k: "free", t: "R" },
      },
      {
        from: "SEAMARK",
        before: ["Then listen. This is procedure, not conversation."],
        rx: "MONITOR AT MOONRISE K",
        tx: { k: "pick", o: [{ t: "R AT MOONRISE", ok: true }, { t: "NO" }, { t: "AS ONE MIN" }] },
      },
      {
        from: "SEAMARK",
        before: ["One more, then I sleep."],
        rx: "TKS {C} SK",
        tx: { k: "free", t: "SK" },
      },
    ],
  },
  {
    id: 2,
    watch: 1,
    station: "STRAIT",
    title: "A name and a time",
    cond: "Clear. Long Point on schedule.",
    card: { art: ART.log, grid: GRIDS.log, line: "Long Point held the name until noon." },
    close: "Iris logged you, which from Iris is a great deal.",
    beats: [
      {
        from: "STRAIT",
        before: ["You are the new tone on this net.", "I keep a log. Names, times, nothing else."],
        rx: "{C} STRAIT K",
        tx: { k: "free", t: "R" },
      },
      {
        from: "STRAIT",
        before: ["Take this the way I send it."],
        rx: "NAME IS IRENE K",
        tx: { k: "free", t: "IRENE R" },
      },
      {
        from: "STRAIT",
        before: ["And the hour. Once only."],
        rx: "IRENE AT MOORS AT NOON K",
        tx: { k: "pick", o: [{ t: "R IRENE AT NOON", ok: true }, { t: "IRENE AT TEN" }, { t: "AS" }] },
      },
      { from: "STRAIT", before: ["Logged."], rx: "TKS SK", tx: { k: "free", t: "SK" } },
    ],
  },
  {
    id: 3,
    watch: 2,
    station: "ROTOR",
    title: "The ground you name",
    cond: "Mist on the moors. Mill Station fades.",
    card: { art: ART.ground, grid: GRIDS.ground, line: "Mill Station moved on the ground you named." },
    close: "Sal moves at nine, on the ground you named.",
    beats: [
      {
        from: "ROTOR",
        before: ["Mist came up an hour ago. You will hear it in the signal, not in me."],
        rx: "{C} ROTOR K",
        tx: { k: "free", t: "R" },
      },
      {
        from: "ROTOR",
        before: ["Ridge sent me something I do not like."],
        rx: "MIST ON EAST MOOR K",
        tx: { k: "free", t: "R MIST EAST" },
      },
      {
        from: "ROTOR",
        before: ["So there is a choice, and I am not making it alone."],
        rx: "MEN ON EAST MOOR OR SEA MOOR K",
        tx: { k: "pick", o: [{ t: "SEA MOOR", ok: true }, { t: "EAST MOOR" }, { t: "NO MOOR" }] },
      },
      {
        from: "ROTOR",
        before: ["Then that is where they walk."],
        rx: "AT NINE TKS SK",
        tx: { k: "free", t: "SK" },
      },
    ],
  },
  {
    id: 4,
    watch: 2,
    station: "SMOKE",
    title: "Eleven silent hours",
    cond: "Summit Hut is weak tonight. Cold up there.",
    card: { art: ART.peak, grid: GRIDS.peak, line: "Summit Hut answered after eleven silent hours." },
    close: "A name is moving down the mountain toward Harbour Light.",
    beats: [
      {
        from: "SMOKE",
        before: ["Eleven hours of nothing. I did not know if the aerial was still up."],
        rx: "{C} SMOKE K",
        tx: { k: "free", t: "R" },
      },
      {
        from: "SMOKE",
        before: ["My hands are not good tonight. Read the shape, not the timing."],
        rx: "ONE MAN NOT SEEN K",
        tx: { k: "free", t: "R ONE MAN" },
      },
      {
        from: "SMOKE",
        before: ["Take it down to the light."],
        rx: "NAME IS OMAR K",
        tx: { k: "free", t: "OMAR R" },
      },
      {
        from: "SMOKE",
        before: ["Is the light still awake?"],
        rx: "IS SEAMARK ON K",
        tx: { k: "pick", o: [{ t: "SEAMARK IS ON", ok: true }, { t: "SEAMARK SENT NO TONE" }, { t: "ASK MARKER" }] },
      },
    ],
  },
]);

/**
 * On air the learner needs a name that can actually be keyed. The Cabin's
 * callsign carries digits and a dash, so the net hands out one of these — every
 * one of them spelled from the same ten letters.
 */
export const ON_AIR_NAMES = Object.freeze([
  "TAMSIN", "SIMON", "KIRA", "MONA", "ROSE", "MARTA", "AMIR",
  "TOMAS", "ESTER", "MIRO", "SONIA", "RENATA", "NINA", "KAI",
]);

/**
 * Prosigns and function words carry no content: `R` after a transmission that
 * contained `R` is procedure, not a leak. Everything else in a transmission is
 * content the pre-line is not allowed to have said first.
 */
const STOP_WORDS = new Set(["K", "R", "AS", "SK", "TKS", "OK", "IS", "AT", "ON", "TO", "A", "IT", "NO", "NOT", "OR", "ONE"]);

const LEGAL = /^[KMRSATOINE ]*$/;

function legal(text) {
  return LEGAL.test(String(text ?? "").replace(/\{C\}/g, ""));
}

/**
 * The guard between the layers, enforced offline. (a) every Layer 1 string is
 * spellable in the ten letters the learner has; (b) no Layer 2 line before a
 * transmission shares a content word with it. Both are counted rather than
 * asserted, so the answer is a number and the number can be zero.
 */
export function auditNights(nights = NIGHTS) {
  const badLetters = [];
  const leaks = [];
  let strings = 0;

  const check = (text, where) => {
    strings += 1;
    if (!legal(text)) badLetters.push(`${where}: ${text}`);
  };

  for (const night of nights) {
    for (const [index, beat] of night.beats.entries()) {
      const where = `night ${night.id} beat ${index + 1}`;
      if (beat.rx) check(beat.rx, `${where} rx`);
      if (beat.tx?.k === "free") check(beat.tx.t, `${where} tx`);
      if (beat.tx?.k === "pick") for (const option of beat.tx.o) check(option.t, `${where} option`);
      if (!beat.rx || !beat.before) continue;

      const spoken = beat.before.join(" ").toUpperCase();
      const words = String(beat.rx).replace(/\{C\}/g, "").split(/\s+/).filter(Boolean);
      for (const word of words) {
        if (STOP_WORDS.has(word) || word.length <= 2) continue;
        if (spoken.includes(word)) leaks.push(`${where}: ${word} in Layer 2`);
      }
    }
  }

  return { strings, badLetters, leaks };
}
