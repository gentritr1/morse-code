import { SPEEDS, STORAGE_KEYS } from "../config.js";
import { MORSE } from "../data/morse.js";
import {
  NIGHTS, ON_AIR_NAMES, OPEN_CORPUS, OPEN_FRAME, OPEN_KIND, OPS, WATCHES, WATCH_KEYS,
} from "../data/nights.js";
import { fistSchedule, speedTiming, stableHash } from "../platform/morse-audio.js";
import { animateMarks, PLAYBACK_LEAD_MS, renderSignal } from "../ui/signals.js";
import { classify, fitUnit, label, letterBaseline } from "./performance-profile.js";

/**
 * Night Watch: six people, one frequency, and a conversation conducted entirely
 * in the ten letters the learner has actually earned.
 *
 * Two rules hold the whole mode up. The first is the gate: it opens only when
 * every letter is Stable or Instant by the scheduler's own reckoning, because a
 * dialogue is unreadable until the letters are — nothing here is withheld as a
 * reward. The second is that **nothing in here is evidence**: no beat writes to
 * the letter scheduler, the attempt log or the progress record, so a night that
 * goes badly cannot cost a letter its interval and a night that goes well cannot
 * buy one. The failure copy says so in as many words.
 */

/* ------------------------------------------------------------ pure parts -- */

const REVERSE_MORSE = Object.freeze(Object.fromEntries(WATCH_KEYS.map((letter) => [MORSE[letter], letter])));

/** The two labels that mean a letter has held across real gaps. */
const STABLE_LABELS = new Set(["Stable", "Instant"]);

export const LOCKED_LINE = "Night Watch opens when every letter is stable.";

/** The retry gate: a station that closed down is off air for ten real hours. */
export const WAIT_MS = 10 * 60 * 60 * 1000;

/** More than this since the last contact and the operator says you were away. */
const AWAY_MS = 3 * 24 * 60 * 60 * 1000;

/** Layer 2 lines arrive at reading pace, one at a time. */
const TALK_MS = 1300;
const TALK_LEAD_MS = 260;
/** Three visible, oldest dropping off — so a warning can still be glanced back at. */
const TALK_VISIBLE = 3;
/** Confirmed Layer 1 lines kept under the paddle. */
const TRANSCRIPT_CAP = 6;
/** The station sends one fainter repeat this far into the window. */
const REPEAT_AT = 0.62;
/** Two decays, then they close down. */
const WINDOW_SPAN = 1.6;
/** A defensive ceiling on a copy line. */
const TYPED_CAP = 64;
/** A stuck paddle should not grow the readout forever. */
const MAX_PRESSES = 64;
/** A silent beat: the lamp is lit and nothing arrives, for this long. */
const SILENT_MS = 4000;
/** Then the note lands, and it is left up long enough to be read. */
const SILENT_HOLD_MS = 2600;
/** Open Channel is one call a day, and a day is a calendar day. */
const DAY_MS = 24 * 60 * 60 * 1000;
/** The prompt a masked beat says once. */
const MASK_PROMPT = "Part of it was never sent. Fill what you know.";
/** What the station says when it chooses to send a masked line whole. */
const UNMASK_LINE = "Once more. All of it this time.";

const FAILURE_LINES = Object.freeze({
  window: "They stopped sending. Nothing was confirmed.",
  copy: "It did not come through twice, and they closed down.",
  send: "Your line was not readable at their end.",
  branch: "You confirmed the wrong thing, and they would not take it.",
});

/**
 * The one paragraph that opens the mode. It is shown once, ever, and it is
 * where the net hands over a name that can be keyed.
 */
export function unlockParagraph(name) {
  return "All ten letters hold now, across real gaps. That was the whole entry requirement: "
    + "six stations have been working this coast after dark the entire time, and none of it was "
    + "withheld from you — it was simply unreadable. They send fast, in their own hands, over "
    + "whatever weather there is. Your callsign carries digits, and digits do not key in ten letters, "
    + `so the net has given you one that does. On air you are ${name}. Short names survive weather.`;
}

/** The gate, read off the scheduler's own labels rather than a mirror of them. */
export function nightWatchUnlocked(profile) {
  return WATCH_KEYS.every((letter) => {
    const metrics = profile?.letters?.[letter];
    if (!metrics) return false;
    return STABLE_LABELS.has(label(metrics, letterBaseline(profile, letter)));
  });
}

/**
 * The on-air name is derived, not chosen: the same callsign is the same name in
 * every session and on every machine, and it is stored so a later change to this
 * pool cannot rename somebody the operators already know.
 */
export function onAirName(callsign) {
  return ON_AIR_NAMES[stableHash(String(callsign ?? "")) % ON_AIR_NAMES.length];
}

function safeCount(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function safeTime(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function createNightWatchStore() {
  // `openAt` is the moment night 8 was confirmed — the Open Channel counts its
  // days from there. `openHeard` is that day index plus one, so zero can mean
  // "nothing heard yet" without a sentinel that survives a clamp.
  return { unlockSeen: false, onAir: "", nights: {}, stations: {}, beats: [], openAt: 0, openHeard: 0 };
}

/**
 * Additive and clamped, the way `readProgress` is: every field is read on its
 * own with an empty default, so a record written by an older build is placed
 * rather than discarded.
 */
export function readNightWatch(storage) {
  const store = createNightWatchStore();
  const stored = storage.getJson(STORAGE_KEYS.nightwatch, null);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return store;

  store.unlockSeen = Boolean(stored.unlockSeen);
  store.onAir = ON_AIR_NAMES.includes(stored.onAir) ? stored.onAir : "";
  store.openAt = safeTime(stored.openAt);
  store.openHeard = safeCount(stored.openHeard);

  if (stored.nights && typeof stored.nights === "object") {
    for (const night of NIGHTS) {
      const record = stored.nights[String(night.id)];
      if (!record || typeof record !== "object") continue;
      const status = record.status === "confirmed" || record.status === "failed" ? record.status : "";
      store.nights[String(night.id)] = { status, waitUntil: safeTime(record.waitUntil), at: safeTime(record.at) };
    }
  }
  if (stored.stations && typeof stored.stations === "object") {
    for (const key of Object.keys(OPS)) {
      const record = stored.stations[key];
      if (!record || typeof record !== "object") continue;
      store.stations[key] = {
        attempted: safeCount(record.attempted),
        confirmed: safeCount(record.confirmed),
        failed: safeCount(record.failed),
        lastContact: safeTime(record.lastContact),
      };
    }
  }
  if (Array.isArray(stored.beats)) {
    store.beats = stored.beats
      .filter((entry) => entry && typeof entry === "object")
      .slice(0, 32)
      .map((entry) => ({
        dir: entry.dir === "tx" ? "tx" : "rx",
        quality: ["unaided", "with help", "not counted"].includes(entry.quality) ? entry.quality : "unaided",
        band: ["clean", "developing", "readable"].includes(entry.band) ? entry.band : null,
        again: Boolean(entry.again),
        context: safeCount(entry.context),
      }));
  }
  return store;
}

export function writeNightWatch(storage, store) {
  return storage.setJson(STORAGE_KEYS.nightwatch, store);
}

/**
 * At most one remembered line on a brief card, and only when a recorded fact
 * supports it. The buoy says the same thing in all three slots, which is the
 * joke and also the point.
 */
export function trustLine(station, record, now = Date.now()) {
  const operator = OPS[station];
  if (!operator || !record) return "";
  if (record.failed > 0 && record.confirmed === 0) return operator.mem.bad;
  if (record.lastContact && now - record.lastContact > AWAY_MS) return operator.mem.away;
  if (record.confirmed >= 2) return operator.mem.good;
  return "";
}

/** Levenshtein distance, for how close a copy came rather than whether it is exact. */
function distance(a, b) {
  const rows = a.length;
  const columns = b.length;
  const table = [];
  for (let row = 0; row <= rows; row += 1) table[row] = [row];
  for (let column = 0; column <= columns; column += 1) table[0][column] = column;
  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      table[row][column] = Math.min(
        table[row - 1][column] + 1,
        table[row][column - 1] + 1,
        table[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
  }
  return table[rows][columns];
}

export function normalise(text) {
  return String(text ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * A copy is a copy of a degraded signal, not a spelling test: it passes when it
 * is close enough that an operator at the other end would have taken it. The
 * threshold is the design's own default.
 */
export const COPY_TOLERANCE = 0.8;

/** Midnight local time, because a day on this net is a calendar day. */
export function dayStart(at) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Days since night 8 was confirmed. Zero on the night it was confirmed. */
export function openDayIndex(openAt, now = Date.now()) {
  if (!openAt) return 0;
  return Math.max(0, Math.round((dayStart(now) - dayStart(openAt)) / DAY_MS));
}

/**
 * What actually went out over the air: a masked word is silence of its own
 * length, so it is not in the marks and must not be in the bars either.
 */
export function airText(text, mask = []) {
  return normalise(text).split(" ").filter((_, index) => !mask.includes(index)).join(" ");
}

/**
 * The hole, sized to the word that was never sent. It appears only once the
 * learner has typed their way to it — before that there is nothing to mark,
 * and afterwards it shrinks as they fill it. Without it the mechanic reads as
 * a fault in the machine rather than as weather.
 */
export function maskSlot(typed, target, mask = []) {
  if (!mask.length) return "";
  const words = String(typed ?? "").toUpperCase().split(" ");
  const at = words.length - 1;
  if (!mask.includes(at)) return "";
  const want = (normalise(target).split(" ")[at] ?? "").length;
  const have = words[at].length;
  return have >= want ? "" : "_".repeat(want - have);
}

/**
 * Hand back exactly the words that were never sent, and nothing else. A learner
 * who left the hole empty has one word fewer than the line; one who guessed and
 * was wrong has the same count. Any other shape means the fault is not confined
 * to the hole, and there is nothing here to adjudicate.
 */
function repaired(typed, target, mask) {
  const want = normalise(target).split(" ").filter(Boolean);
  const got = normalise(typed).split(" ").filter(Boolean);
  const holes = [...mask].sort((a, b) => a - b);
  if (got.length === want.length) {
    for (const at of holes) got[at] = want[at];
  } else if (got.length === want.length - holes.length) {
    for (const at of holes) got.splice(at, 0, want[at]);
  } else {
    return null;
  }
  return got.join(" ");
}

/**
 * Was the hidden word actually remembered? Not "close enough" — a masked word
 * is the one thing in the mode that is not a copy at all, and a plausible guess
 * that scored inside tolerance would turn Blackout from memory into luck.
 */
export function maskExact(typed, target, mask = []) {
  if (!mask.length) return true;
  const want = normalise(target).split(" ").filter(Boolean);
  const got = normalise(typed).split(" ").filter(Boolean);
  if (got.length !== want.length) return false;
  return mask.every((at) => got[at] === want[at]);
}

/**
 * The adjudication for a failed masked copy: if everything that was actually
 * transmitted came through, the fault is in the guess and not in the ear, and
 * the station will choose to send the line whole once.
 */
export function remainderPasses(typed, target, mask = []) {
  if (!mask.length) return false;
  const fixed = repaired(typed, target, mask);
  if (fixed === null) return false;
  return copyScore(fixed, target) >= COPY_TOLERANCE;
}

/**
 * The Open Channel's daily pull, by index and nothing else: the same day is
 * the same transmission, and a pairing recurs only far away from itself.
 *
 * The line advances on the kind's own turn rather than on the day, because a
 * kind only comes round every fourth night: indexing a four-line pool by the
 * day number would pin it to one line for ever.
 */
export function openPull(day, { confirmed = [] } = {}) {
  const stations = Object.keys(OPS);
  const from = stations[day % stations.length];
  const kind = OPEN_KIND[day % OPEN_KIND.length];
  const frame = OPEN_FRAME[kind][day % 2];
  const turn = Math.floor(day / OPEN_KIND.length);
  if (kind === "old" && confirmed.length) {
    // A coprime stride scatters the recordings across the arc instead of
    // replaying it front to back, while still reaching every confirmed line
    // (7 shares no factor with any pool size the arc can produce except 7
    // itself, and a stride of 1 walks a 7-line pool in full anyway).
    const stride = confirmed.length % 7 === 0 ? 1 : 7;
    const line = confirmed[(turn * stride) % confirmed.length];
    // A recording keeps the hand that made it, and the weather it is heard in
    // is the worst the net has.
    return { from, kind, frame, text: line.text, fist: line.from, watch: 4, night: line.night };
  }
  const pool = OPEN_CORPUS[kind];
  return { from, kind, frame, text: pool[turn % pool.length], fist: from, watch: kind === "old" ? 4 : 2, night: 0 };
}

export function copyScore(typed, target) {
  const a = normalise(typed);
  const b = normalise(target);
  if (!b.length) return 0;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

/** The ideal element weights for a line: 1 for a dot, 3 for a dash. */
export function idealElements(target) {
  const symbols = [];
  for (const character of normalise(target).replace(/ /g, "")) {
    for (const symbol of MORSE[character] ?? "") symbols.push(symbol);
  }
  return symbols.join("");
}

/**
 * Sending is judged the way Echo Send judges it. The learner's own unit is
 * fitted by least squares first, so tempo and rhythm come apart, and only then
 * is the keying decoded against that unit and compared to the line they were
 * asked to send.
 *
 * The comparison deliberately ignores word spacing. Running two words together
 * is the single most common fault in a hand that is otherwise fine, and failing
 * a night for it would fail the wrong skill; a wrong or missing letter still
 * does not decode.
 */
export function judgeKeying(presses, target, nominalUnit) {
  const durations = presses.map((press) => press.durationMs);
  const gaps = presses.slice(1).map((press) => press.gapMs);
  const want = idealElements(target);
  const sent = classify(durations, nominalUnit);
  const fitted = fitUnit(durations, want) ?? fitUnit(durations, sent) ?? nominalUnit;

  let decoded = "";
  let pattern = "";
  const flush = () => {
    if (!pattern) return;
    decoded += REVERSE_MORSE[pattern] ?? "?";
    pattern = "";
  };
  durations.forEach((duration, index) => {
    if (index > 0) {
      const gap = gaps[index - 1] ?? 0;
      if (gap > fitted * 5) {
        flush();
        decoded += " ";
      } else if (gap > fitted * 2) {
        flush();
      }
    }
    pattern += sent[index] === "-" ? "-" : ".";
  });
  flush();

  let residual = 1;
  if (want.length === durations.length && durations.length) {
    const sum = durations.reduce((total, duration, index) => {
      const ideal = want[index] === "." ? 1 : 3;
      const error = (duration - fitted * ideal) / fitted;
      return total + error * error;
    }, 0);
    residual = Math.sqrt(sum / durations.length);
  }

  const letters = (value) => normalise(value).replace(/ /g, "");
  return {
    decoded: normalise(decoded),
    decodes: letters(decoded) === letters(target) && letters(target).length > 0,
    residual,
    unit: fitted,
    band: residual < 0.35 ? "clean" : residual < 0.7 ? "developing" : "readable",
  };
}

/**
 * Three sentences at most, every one of them assembled from something that was
 * recorded. Copy quality with its counts kept apart, the worst sending band
 * across the night, and the authored consequence for the network.
 */
export function debriefSentences(beats, close) {
  const received = beats.filter((entry) => entry.dir === "rx");
  const unaided = received.filter((entry) => entry.quality === "unaided").length;
  const helped = received.filter((entry) => entry.quality === "with help").length;
  const uncounted = received.filter((entry) => entry.quality === "not counted").length;
  const filled = received.reduce((total, entry) => total + (entry.context || 0), 0);
  const sent = beats.filter((entry) => entry.dir === "tx");
  const bands = sent.map((entry) => entry.band);
  const worst = bands.includes("readable") ? "readable" : bands.includes("developing") ? "developing" : "clean";

  const first = `${unaided} of ${received.length} lines decoded unaided`
    + (helped ? `; ${helped} with help` : "")
    + (filled ? ` (${filled} letters filled from context, not heard)` : "")
    + (uncounted ? `; ${uncounted} not counted, the tab lost focus` : "")
    + ".";
  const second = sent.length
    ? `Sending read ${worst}${sent.some((entry) => entry.again) ? ", after one line was keyed twice" : ""}.`
    : "";
  return [first, second, close].filter(Boolean);
}

/* ------------------------------------------------------------- controller -- */

export function createNightWatchController(context) {
  const { state, elements, storage, audio, announce } = context;

  let store = createNightWatchStore();
  let timers = [];
  let cancelMarks = null;
  /** locked · unlock · wait · brief · open · talk · listen · rx · copy · choice · send · beatend · openend · debrief · failed */
  let phase = "locked";
  let nightIndex = 0;
  let beatIndex = 0;
  let talk = [];
  let transcript = [];
  let typed = "";
  let options = null;
  let sendTarget = "";
  let prompt = "";
  let kicker = "";
  let lamp = "off";
  let repeats = 0;
  let windowMs = 0;
  let debrief = [];
  let card = null;
  let beatLog = [];
  let assisted = false;
  let interrupted = false;
  let missCount = 0;
  let wrongCount = 0;
  let sendMiss = 0;
  let sentAgain = false;
  let presses = [];
  /** The Open Channel's beat for tonight, or null while a night is running. */
  let openBeat = null;
  /** True once the station has chosen to send a masked line whole. */
  let unmasked = false;
  let pressStartedAt = 0;
  let pressPointerId = null;
  let padKeyboardHeld = false;
  let lastUpAt = null;
  /** When the second decay runs out and the station closes down. */
  let windowEndsAt = 0;

  function clearTimers() {
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
  }

  function later(fn, ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  function persist() {
    writeNightWatch(storage, store);
  }

  function night() {
    return NIGHTS[nightIndex] ?? null;
  }

  function beat() {
    if (openBeat) return openBeat;
    const current = night();
    return current ? current.beats[beatIndex] ?? null : null;
  }

  function watch() {
    if (openBeat) return WATCHES[openBeat.watch] ?? WATCHES[2];
    const current = night();
    return WATCHES[current ? current.watch : 1];
  }

  function operator(target = beat()) {
    return OPS[target?.from ?? "SEAMARK"] ?? OPS.SEAMARK;
  }

  function name() {
    return store.onAir || onAirName(state.progress.callsign);
  }

  function resolve(text) {
    return String(text ?? "").replace(/\{C\}/g, name());
  }

  /** The preset the learner chose, plus whatever the Watch adds to it. */
  function speed() {
    const preset = SPEEDS[state.difficulty] ?? SPEEDS.steady;
    const bump = watch().speed ?? 0;
    if (!bump) return preset;
    return { ...preset, charWpm: preset.charWpm + bump, effectiveWpm: preset.effectiveWpm + bump };
  }

  function nightRecord(id) {
    return store.nights[String(id)] ?? { status: "", waitUntil: 0, at: 0 };
  }

  /** The next night the net has for the learner, in order. */
  function firstUnconfirmed() {
    const index = NIGHTS.findIndex((entry) => nightRecord(entry.id).status !== "confirmed");
    return index < 0 ? NIGHTS.length : index;
  }

  function gate(index = nightIndex, now = Date.now()) {
    const target = NIGHTS[index];
    if (!target) return "open";
    return nightRecord(target.id).waitUntil > now ? "wait" : "brief";
  }

  /**
   * Every Layer 1 line the learner has actually confirmed, with the hand that
   * sent it. This is the Open Channel's `old` corpus: the arc becomes the pool,
   * which is the only rule in the mode that scales without more authoring.
   */
  function confirmedLines() {
    const lines = [];
    for (const entry of NIGHTS) {
      if (nightRecord(entry.id).status !== "confirmed") continue;
      for (const item of entry.beats) {
        if (!item.rx || item.cut || item.silent) continue;
        lines.push({ text: item.rx, from: item.fistOverride ?? item.from, night: entry.id });
      }
    }
    return lines;
  }

  /* ----------------------------------------------------------- rendering -- */

  /**
   * Whose turn it is decides whether the ten answer keys are open, and that
   * rule lives in the trainer's render beside every other mode's. A phase
   * change therefore asks for the whole surface rather than restating it here.
   */
  function refresh() {
    context.render();
  }

  function say(who, text) {
    talk = [...talk, { who, text }].slice(-TALK_VISIBLE);
    refresh();
  }

  function pushTranscript(who, text) {
    transcript = [...transcript, { who, text }].slice(-TRANSCRIPT_CAP);
  }

  function cardCopy() {
    const current = night();
    if (phase === "locked") {
      return {
        tag: "Night Watch",
        title: "The net is out of reach.",
        body: LOCKED_LINE,
        note: "Every letter has to hold across a real gap first. Nothing is withheld as a reward — the exchanges are unreadable until the letters are.",
        action: "",
      };
    }
    if (phase === "unlock") {
      return { tag: "Night Watch", title: "Three in the morning.", body: unlockParagraph(name()), note: "", action: "Take the watch" };
    }
    if (phase === "wait" && current) {
      return {
        tag: "Off air",
        title: `${OPS[current.station].place} is off air.`,
        body: "It calls again after a night. Answered once, with help — that does not confirm. Come back after moonrise and it will be sending.",
        note: "",
        action: "",
      };
    }
    if (phase === "open") {
      const day = openDayIndex(store.openAt);
      return {
        tag: "Open Channel",
        title: "The net is yours. One call a night.",
        body: "Every night the coast had for you is confirmed. What is left is the traffic: one transmission "
          + "a night, whoever is due, in their own hand. Nothing to confirm and nothing to lose.",
        note: store.openHeard === day + 1 ? "Same one as tonight\u2019s round." : "",
        action: "Open the channel",
      };
    }
    if (phase === "brief" && current) {
      const remembered = trustLine(current.station, store.stations[current.station]);
      return {
        tag: `Watch ${current.watch} · ${WATCHES[current.watch].name}`,
        title: current.title,
        body: current.cond,
        note: remembered ? `“${remembered}” — ${OPS[current.station].who}` : "",
        action: "Open the channel",
      };
    }
    if (phase === "debrief") {
      return { tag: "Confirmed", title: "", body: debrief.join(" "), note: "", action: "Close down" };
    }
    if (phase === "failed") {
      return { tag: "Unconfirmed", title: "", body: debrief.join(" "), note: "", action: "Close down" };
    }
    return null;
  }

  function renderMemoryCard() {
    const showing = phase === "debrief" && Boolean(card);
    elements.watchMemory.hidden = !showing;
    if (!showing) return;
    if (elements.watchArt.dataset.night !== String(night()?.id)) {
      elements.watchArt.textContent = card.art;
      elements.watchArt.dataset.night = String(night()?.id);
      const cells = [];
      card.grid.forEach((row, rowIndex) => {
        [...row].forEach((glyph, columnIndex) => {
          const cell = document.createElement("i");
          cell.dataset.ink = glyph;
          cell.style.setProperty("--row", String(rowIndex));
          cell.style.setProperty("--column", String(columnIndex));
          cells.push(cell);
        });
      });
      elements.watchMosaic.style.setProperty("--columns", String(card.grid[0].length));
      elements.watchMosaic.replaceChildren(...cells);
    }
    elements.watchMemoryLine.textContent = card.line;
  }

  function renderTalk() {
    const showing = talk.length > 0;
    elements.watchTalk.hidden = !showing;
    if (!showing) return;
    const key = talk.map((line) => `${line.who}|${line.text}`).join("•");
    if (elements.watchTalk.dataset.renderKey === key) return;
    elements.watchTalk.replaceChildren(...talk.map((line) => {
      const row = document.createElement("p");
      const who = document.createElement("b");
      who.textContent = line.who;
      row.append(who, document.createTextNode(line.text));
      return row;
    }));
    elements.watchTalk.dataset.renderKey = key;
  }

  function renderTranscript() {
    elements.watchTranscript.hidden = transcript.length === 0;
    const key = transcript.map((line) => `${line.who}|${line.text}`).join("•");
    if (elements.watchTranscript.dataset.renderKey === key) return;
    elements.watchTranscript.replaceChildren(...transcript.map((line) => {
      const row = document.createElement("p");
      row.dataset.dir = line.who === "you" ? "tx" : "rx";
      const who = document.createElement("b");
      who.textContent = line.who;
      row.append(who, document.createTextNode(line.text));
      return row;
    }));
    elements.watchTranscript.dataset.renderKey = key;
  }

  function renderOptions() {
    const showing = phase === "choice" && Array.isArray(options);
    elements.watchOptions.hidden = !showing;
    if (!showing) return;
    const key = options.map((option) => option.text).join("•");
    if (elements.watchOptions.dataset.renderKey === key) return;
    elements.watchOptions.replaceChildren(...options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "watch-option";
      button.textContent = option.text;
      button.addEventListener("click", () => pickOption(option.index));
      return button;
    }));
    elements.watchOptions.dataset.renderKey = key;
  }

  /**
   * The copy line, and the hole in it. A masked word is silence of exactly its
   * own length on the air; on screen it is a slot of exactly its own length,
   * shown once the learner has typed their way to it. Both are the same fact.
   */
  function renderDecode(copying) {
    const current = beat();
    const slot = copying && !unmasked && Array.isArray(current?.mask)
      ? maskSlot(typed, resolve(current.rx), current.mask)
      : "";
    const text = copying ? (typed || (slot ? "" : "\u00b7")) : sendTarget;
    const key = `${copying ? "rx" : "tx"}|${text}|${slot}`;
    if (elements.watchDecodeText.dataset.renderKey === key) return;
    const nodes = [document.createTextNode(text)];
    if (slot) {
      const hole = document.createElement("span");
      hole.className = "watch-slot";
      hole.textContent = slot;
      nodes.push(hole);
    }
    elements.watchDecodeText.replaceChildren(...nodes);
    elements.watchDecodeText.dataset.renderKey = key;
  }

  function renderPresses() {
    const key = presses.map((press) => press.symbol).join("");
    if (elements.watchSequence.dataset.renderKey === key) return;
    elements.watchSequence.replaceChildren(...presses.map((press) => {
      const mark = document.createElement("span");
      mark.className = `send-mark${press.symbol === "-" ? " dash" : ""}`;
      mark.setAttribute("aria-hidden", "true");
      return mark;
    }));
    elements.watchSequence.dataset.renderKey = key;
  }

  function render() {
    if (state.mode !== "watch") return;
    const copy = cardCopy();
    const live = !copy;

    elements.watchCard.hidden = !copy;
    elements.watchLive.hidden = !live;
    if (copy) {
      elements.watchCardTag.textContent = copy.tag;
      elements.watchCardTitle.textContent = copy.title;
      elements.watchCardTitle.hidden = !copy.title;
      elements.watchCardBody.textContent = copy.body;
      elements.watchCardNote.textContent = copy.note;
      elements.watchCardNote.hidden = !copy.note;
      elements.watchCardAction.textContent = copy.action;
      elements.watchCardAction.hidden = !copy.action;
      renderMemoryCard();
    } else {
      elements.watchMemory.hidden = true;
    }

    renderTalk();
    renderTranscript();
    renderOptions();
    renderPresses();

    elements.watchKicker.textContent = kicker;
    elements.watchKicker.hidden = !live || !kicker;
    elements.watchStatus.textContent = prompt;
    elements.watchLamp.dataset.lamp = lamp;
    elements.watchLamp.hidden = !live;
    elements.watchLampLabel.textContent = lamp === "rx" ? "RX" : lamp === "open" ? "OPEN" : "";

    const copying = phase === "copy";
    const keying = phase === "send";
    const revealed = phase === "openend";
    elements.watchDecode.hidden = !(copying || keying || revealed);
    elements.watchDecodeLabel.textContent = copying ? "Copy" : revealed ? "Sent" : "Key";
    elements.watchDecode.dataset.dir = keying ? "tx" : "rx";
    renderDecode(copying);
    elements.watchPad.hidden = !keying;
    elements.watchSequence.hidden = !keying;
    elements.watchRepeat.hidden = !copying;
    elements.watchGap.hidden = !copying;
    elements.watchBack.hidden = !copying;
    const acting = copying || keying || phase === "beatend" || revealed;
    elements.watchConfirm.hidden = !acting;
    elements.watchConfirm.textContent = copying
      ? "Send copy"
      : keying ? "That is my line" : revealed ? "Close down" : "Continue";
    elements.watchActions.hidden = !acting;

    // The incoming signal is never shown as text, so the marks are the only
    // thing on screen while it plays — and they carry no shape until it does.
    elements.watchSignal.hidden = phase !== "rx";
  }

  /* --------------------------------------------------------------- flow -- */

  function stopSignal() {
    cancelMarks?.();
    cancelMarks = null;
    audio.stop();
  }

  function setLamp(next, decayMs = 0) {
    lamp = next;
    const shell = elements.watchLamp;
    const glow = shell.querySelector(".watch-lamp-glow");
    shell.dataset.lamp = next;
    // Pin the glow to whatever it is painting at this instant. A copy window
    // leaves a half-finished thirty-second decay behind it, and setting the
    // custom property to the value it is already decaying toward restarts
    // nothing — the lamp would go on quietly fading long after the channel had
    // closed, which is the one thing in this mode that must not lie.
    shell.style.setProperty("--glow-ms", "0ms");
    shell.style.setProperty("--glow", glow ? getComputedStyle(glow).opacity : "0");
    void shell.offsetWidth;
    if (next === "open" && decayMs > 0) {
      // The only clock in the mode: a glow that runs out. No countdown anywhere.
      shell.style.setProperty("--glow", "1");
      void shell.offsetWidth;
      shell.style.setProperty("--glow-ms", `${Math.round(decayMs)}ms`);
      shell.style.setProperty("--glow", "0");
      return;
    }
    shell.style.setProperty("--glow-ms", "240ms");
    shell.style.setProperty("--glow", next === "rx" ? "1" : "0");
  }

  function startNight(index) {
    nightIndex = index;
    beatIndex = 0;
    openBeat = null;
    talk = [];
    transcript = [];
    beatLog = [];
    debrief = [];
    card = null;
    store.beats = [];
    persist();
    startBeat();
  }

  function startBeat() {
    clearTimers();
    stopSignal();
    const current = beat();
    if (!current) {
      finishNight();
      return;
    }
    assisted = false;
    interrupted = false;
    missCount = 0;
    wrongCount = 0;
    sendMiss = 0;
    sentAgain = false;
    unmasked = false;
    typed = "";
    options = null;
    repeats = 0;
    prompt = "";
    kicker = "";
    phase = "talk";
    setLamp("off");
    refresh();

    const person = operator(current);
    // A cue beat has no transmission to react to, so the cue itself is the only
    // Layer 2 line it gets — and it is the one place Layer 2 may name the line.
    const lines = current.before ?? (current.cue ? [current.cue] : []);
    lines.forEach((line, index) => {
      later(() => say(`${person.who} · ${person.place}`, line), TALK_LEAD_MS + index * TALK_MS);
    });
    const after = 400 + lines.length * TALK_MS;

    if (current.silent) {
      later(() => holdSilence(current), after);
      return;
    }
    // No incoming: the learner opens. First transmission of the arc they start.
    if (!current.rx) {
      later(() => beginSend(resolve(current.tx.t), true), after);
      return;
    }
    later(() => playIncoming(false), after);
  }

  /**
   * A beat where nothing arrives. The lamp stays lit on RX with an empty band
   * under it, which is what listening to a station that has stopped actually
   * looks like; the note is the content, and it lands late enough that the
   * silence is felt first.
   */
  function holdSilence(current) {
    phase = "listen";
    setLamp("rx");
    kicker = `LISTENING · ${current.from} · ${OPS[current.from]?.place ?? ""}`;
    prompt = "Nothing yet.";
    refresh();
    later(() => {
      setLamp("off");
      kicker = "";
      prompt = current.note;
      pushTranscript(current.from, "no tone");
      refresh();
    }, SILENT_MS);
    later(() => {
      beatIndex += 1;
      startBeat();
    }, SILENT_MS + SILENT_HOLD_MS);
  }

  function playIncoming(isRepeat) {
    const current = beat();
    if (!current) return;
    const conditions = watch();
    // Whose hand this is need not be whose station it is. Night 6 turns on
    // exactly that gap, so the fist and the seed follow the override and the
    // Layer 2 attribution follows the station.
    const hand = current.fistOverride ?? current.fist ?? current.from;
    const person = OPS[hand] ?? operator(current);
    // A repeat is fainter: the same hand, a worse band.
    const band = isRepeat
      ? { ...conditions, noise: conditions.noise + 0.02, fade: Math.min(0.7, conditions.fade + 0.2) }
      : conditions;
    const text = resolve(current.rx);
    // Once the station has chosen to send a masked line whole, there is no hole
    // left in it — that is the whole of the concession.
    const mask = unmasked ? [] : current.mask ?? [];
    const voice = { fist: person.fist, watch: band, seed: hand, mask };

    phase = "rx";
    setLamp("rx");
    kicker = `INCOMING · ${current.from} · ${OPS[current.from]?.place ?? ""}`;
    prompt = isRepeat ? "Again, fainter." : conditions.name === "Fading Signal" ? "The band is moving." : "";
    refresh();

    const marks = audio.playFist(text, speed(), voice);
    const schedule = marks ?? fistSchedule(text, speed(), voice);
    // The bars are what went out, not what was written: a masked word is not on
    // the air, so it is not among the marks either.
    renderSignal(elements.watchSignal, airText(text, mask), false, false);
    cancelMarks?.();
    cancelMarks = animateMarks([elements.watchSignal], schedule);
    const last = schedule[schedule.length - 1];
    const durationMs = last ? last.start + last.duration : 0;
    // A cut transmission has no settle after it. The elements just end.
    later(() => openWindow(isRepeat), PLAYBACK_LEAD_MS + durationMs + (current.cut ? 0 : 250));
  }

  /**
   * The window opens on the last tone, never before it — the same principle the
   * Cabin's answer keys already obey. What runs out is the lamp, not a number.
   */
  function openWindow(isRepeat = false) {
    const conditions = watch();
    const current = beat();
    phase = "copy";
    windowMs = conditions.win;
    prompt = Array.isArray(current?.mask) && !unmasked ? MASK_PROMPT : "Copy it. Type the letters you heard.";
    kicker = `COPY · ${current?.from ?? ""}`;
    // The Open Channel is not a night: the lamp is a lamp, not a deadline, and
    // there is nothing here to lose by taking as long as it takes.
    if (openBeat) {
      clearTimers();
      setLamp("open", conditions.win);
      refresh();
      focusStage();
      return;
    }
    // A repeat is not a new window. The station gave the line again out of the
    // same closing window, so the glow picks up where it left off and the
    // deadline it is counting down to does not move.
    if (isRepeat) {
      setLamp("open", Math.max(400, windowEndsAt - Date.now()));
      refresh();
      focusStage();
      return;
    }
    clearTimers();
    windowEndsAt = Date.now() + conditions.win * WINDOW_SPAN;
    setLamp("open", conditions.win);
    refresh();
    focusStage();
    if (conditions.autoRepeat) {
      later(() => {
        if (repeats >= conditions.repeats) return;
        repeats += 1;
        assisted = true;
        playIncoming(true);
      }, conditions.win * REPEAT_AT);
    }
    later(() => failNight("window"), conditions.win * WINDOW_SPAN);
  }

  function askRepeat() {
    const conditions = watch();
    if (repeats >= conditions.repeats) {
      prompt = conditions.repeats ? "One repeat. Then they close down." : "Not tonight. They will not send it twice.";
      refresh();
      return;
    }
    repeats += 1;
    assisted = true;
    playIncoming(true);
  }

  function typeLetter(character) {
    if (phase !== "copy") return;
    typed = `${typed}${character}`.slice(0, TYPED_CAP);
    refresh();
  }

  function backspace() {
    if (phase !== "copy") return;
    typed = typed.slice(0, -1);
    refresh();
  }

  function confirmCopy() {
    const current = beat();
    if (!current) return;
    const target = resolve(current.rx);
    clearTimers();
    if (openBeat) {
      revealOpen(target);
      return;
    }
    // Once the station has sent the line whole there is nothing hidden left to
    // get right, and the copy is judged like any other.
    const mask = unmasked ? [] : (Array.isArray(current.mask) ? current.mask : []);
    // Two ways to not have it: the copy missed, or the word in the hole is not
    // the word that was never sent. Both are the same answer from the station.
    if (copyScore(typed, target) < COPY_TOLERANCE || !maskExact(typed, target, mask)) {
      // The Blackout concession: if everything that was actually transmitted
      // came through and only the guess was wrong, the station is not being
      // asked to repeat itself — it is choosing to stop hiding a word.
      if (mask.length && remainderPasses(typed, target, mask)) {
        unmasked = true;
        assisted = true;
        typed = "";
        const person = operator(current);
        say(`${person.who} · ${person.place}`, UNMASK_LINE);
        prompt = "";
        refresh();
        later(() => playIncoming(true), 1100);
        return;
      }
      missCount += 1;
      if (missCount >= 2) {
        failNight("copy");
        return;
      }
      assisted = true;
      typed = "";
      prompt = "Not copied. They send once more.";
      refresh();
      later(() => playIncoming(true), 1100);
      return;
    }

    // A word filled from context was never heard, so it is never unaided, and
    // the debrief counts the letters rather than rounding them into the line.
    const filled = mask.reduce((total, at) => total + (normalise(target).split(" ")[at] ?? "").length, 0);
    const quality = interrupted ? "not counted" : (assisted || filled) ? "with help" : "unaided";
    beatLog.push({ dir: "rx", quality, band: null, again: false, context: filled });
    pushTranscript(current.from, target);
    stopSignal();
    setLamp("off");

    if (current.tx.k === "pick") {
      phase = "choice";
      prompt = "Choose the reply, then key it.";
      kicker = "REPLY";
      options = current.tx.o.map((option, index) => ({ text: resolve(option.t), index }));
      refresh();
      return;
    }
    beginSend(resolve(current.tx.t));
  }

  function pickOption(index) {
    const current = beat();
    const option = current?.tx?.o?.[index];
    if (!option) return;
    const person = operator(current);
    if (!option.ok) {
      wrongCount += 1;
      if (wrongCount >= 2) {
        failNight("branch");
        return;
      }
      say(`${person.who} · ${person.place}`, current.tx.wrong ?? "That is not it. Read the line again.");
      return;
    }
    if (current.tx.right) say(`${person.who} · ${person.place}`, current.tx.right);
    beginSend(resolve(option.t));
  }

  function beginSend(target, opening = false) {
    presses = [];
    lastUpAt = null;
    pressStartedAt = 0;
    padKeyboardHeld = false;
    phase = "send";
    sendTarget = target;
    options = null;
    kicker = opening ? "OPEN THE CALL" : "KEY IT BACK";
    prompt = opening
      ? "Nothing is coming. Call her yourself."
      : "Key it on the paddle. Choosing is the judgement; keying is the skill.";
    setLamp("off");
    refresh();
    // The render above is synchronous, so the paddle exists now: focusing it on
    // the next frame instead leaves a window in which Space reaches nothing.
    elements.watchPad.focus({ preventScroll: true });
  }

  function beginPress(pointerId = null) {
    if (phase !== "send" || pressStartedAt || presses.length >= MAX_PRESSES) return;
    pressStartedAt = performance.now();
    pressPointerId = pointerId;
    elements.watchPad.dataset.pressing = "true";
    audio.startTone();
  }

  function finishPress(cancelled = false) {
    if (!pressStartedAt) return;
    const downAt = pressStartedAt;
    const upAt = performance.now();
    pressStartedAt = 0;
    pressPointerId = null;
    elements.watchPad.dataset.pressing = "false";
    audio.stopTone();
    if (cancelled) return;
    const durationMs = upAt - downAt;
    const gapMs = lastUpAt === null ? 0 : downAt - lastUpAt;
    lastUpAt = upAt;
    const unit = speedTiming(speed()).unitMs;
    presses.push({ symbol: durationMs >= unit * 2 ? "-" : ".", downAt, upAt, durationMs, gapMs });
    refresh();
  }

  function finishSend() {
    const current = beat();
    if (!current) return;
    if (!presses.length) {
      prompt = "Key it on the paddle. Space bar, or press and hold.";
      refresh();
      return;
    }
    const person = operator(current);
    const verdict = judgeKeying(presses, sendTarget, speedTiming(speed()).unitMs);
    if (!verdict.decodes) {
      sendMiss += 1;
      if (sendMiss >= 2) {
        failNight("send");
        return;
      }
      sentAgain = true;
      say(`${person.who} · ${person.place}`, "Nothing readable came through. Key it again.");
      presses = [];
      lastUpAt = null;
      prompt = "Key it again.";
      refresh();
      return;
    }
    beatLog.push({ dir: "tx", quality: "unaided", band: verdict.band, again: sentAgain, context: 0 });
    pushTranscript("you", sendTarget);
    say(`${person.who} · ${person.place}`, person.band[verdict.band === "clean" ? "clean" : verdict.band === "developing" ? "dev" : "read"]);
    phase = "beatend";
    prompt = "";
    kicker = "";
    refresh();
  }

  /**
   * One call a night, and the same call twice in one night. Everything about
   * tonight's transmission comes out of the day index, so a second visit is not
   * a second pull — it is the same one, and the card says so.
   */
  function startOpen() {
    clearTimers();
    stopSignal();
    const day = openDayIndex(store.openAt);
    const pull = openPull(day, { confirmed: confirmedLines() });
    const person = OPS[pull.from];
    openBeat = {
      from: pull.from,
      rx: pull.text,
      fist: pull.fist,
      watch: pull.watch,
      kind: pull.kind,
      night: pull.night,
      tx: { k: "free", t: "R" },
    };
    talk = [];
    transcript = [];
    beatLog = [];
    debrief = [];
    card = null;
    typed = "";
    options = null;
    unmasked = false;
    assisted = false;
    interrupted = false;
    missCount = 0;
    repeats = 0;
    phase = "talk";
    prompt = "";
    kicker = "";
    setLamp("off");
    refresh();
    later(() => say(`${person.who} · ${person.place}`, pull.frame), TALK_LEAD_MS);
    if (store.openHeard === day + 1) {
      later(() => say(`${person.who} · ${person.place}`, "Same one as tonight\u2019s round."), TALK_LEAD_MS + TALK_MS);
    }
    later(() => playIncoming(false), 400 + (store.openHeard === day + 1 ? 2 : 1) * TALK_MS);
  }

  /**
   * There is no failing an Open Channel line: sending the copy is what reveals
   * it. Nothing about it is written down anywhere except the day it was heard,
   * because a transmission with nothing at stake cannot be evidence.
   */
  function revealOpen(target) {
    clearTimers();
    stopSignal();
    setLamp("off");
    const day = openDayIndex(store.openAt);
    store.openHeard = day + 1;
    persist();
    pushTranscript(openBeat.from, target);
    sendTarget = target;
    typed = "";
    phase = "openend";
    kicker = "";
    prompt = "That was all of it. Nothing to confirm, nothing to lose.";
    refresh();
  }

  function advance() {
    if (phase === "beatend") {
      beatIndex += 1;
      startBeat();
      return;
    }
    if (phase === "open") {
      startOpen();
      return;
    }
    if (phase === "openend") {
      openBeat = null;
      clearTimers();
      stopSignal();
      talk = [];
      transcript = [];
      phase = "open";
      prompt = "";
      kicker = "";
      setLamp("off");
      refresh();
      return;
    }
    if (phase === "debrief" || phase === "failed") {
      clearTimers();
      talk = [];
      transcript = [];
      openBeat = null;
      nightIndex = firstUnconfirmed();
      phase = gate(nightIndex);
      refresh();
      return;
    }
    if (phase === "unlock") {
      store.unlockSeen = true;
      persist();
      nightIndex = firstUnconfirmed();
      phase = gate(nightIndex);
      refresh();
      return;
    }
    if (phase === "brief") {
      startNight(nightIndex);
    }
  }

  function recordStation(station, confirmed, now = Date.now()) {
    const record = store.stations[station] ?? { attempted: 0, confirmed: 0, failed: 0, lastContact: 0 };
    record.attempted += 1;
    record.lastContact = now;
    if (confirmed) record.confirmed += 1;
    else record.failed += 1;
    store.stations[station] = record;
  }

  function finishNight() {
    clearTimers();
    stopSignal();
    const current = night();
    if (!current) return;
    const now = Date.now();
    debrief = debriefSentences(beatLog, current.close);
    card = current.card;
    store.nights[String(current.id)] = { status: "confirmed", waitUntil: 0, at: now };
    store.beats = beatLog.slice(-32);
    recordStation(current.station, true, now);
    // The last night confirmed is where the Open Channel starts counting days.
    if (firstUnconfirmed() >= NIGHTS.length && !store.openAt) store.openAt = now;
    persist();
    phase = "debrief";
    setLamp("off");
    refresh();
    announce("Night confirmed.");
  }

  function failNight(reason) {
    clearTimers();
    stopSignal();
    const current = night();
    if (!current) return;
    const now = Date.now();
    store.nights[String(current.id)] = { status: "failed", waitUntil: now + WAIT_MS, at: now };
    store.beats = beatLog.slice(-32);
    recordStation(current.station, false, now);
    persist();
    debrief = [
      FAILURE_LINES[reason] ?? FAILURE_LINES.window,
      "Nothing here touches your letters.",
      `${OPS[current.station].place} calls again after a night.`,
    ];
    card = null;
    phase = "failed";
    setLamp("off");
    refresh();
    announce("The station closed down.");
  }

  /* ------------------------------------------------------------ plumbing -- */

  /**
   * The copy window puts focus on the machine, not on a key. Space is the word
   * gap while copying, and a focused button would swallow it — the same reason
   * the Cabin lets Space and Enter defer to whatever button owns them.
   */
  function focusStage() {
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active.hidden) {
        elements.machine.focus({ preventScroll: true });
      }
    });
  }

  /** True while the ten answer keys are the learner's input. */
  function copyOpen() {
    return state.mode === "watch" && phase === "copy";
  }

  function unlocked() {
    return nightWatchUnlocked(state.performanceProfile);
  }

  function markInterrupted() {
    if (state.mode !== "watch") return;
    if (["talk", "rx", "copy", "choice", "send", "listen"].includes(phase)) interrupted = true;
  }

  function pause() {
    markInterrupted();
    if (state.mode !== "watch") return;
    stopSignal();
    if (phase === "copy") prompt = "Copy it. Not counted — you stepped away.";
    refresh();
  }

  function resume() {
    if (state.mode !== "watch") return;
    refresh();
  }

  /** Entering the mode: the gate, then the unlock card, then whatever is due. */
  function activate() {
    store = readNightWatch(storage);
    clearTimers();
    stopSignal();
    talk = [];
    transcript = [];
    beatLog = [];
    debrief = [];
    card = null;
    typed = "";
    options = null;
    presses = [];
    openBeat = null;
    unmasked = false;
    if (!unlocked()) {
      phase = "locked";
      refresh();
      return;
    }
    if (!store.onAir) {
      store.onAir = onAirName(state.progress.callsign);
      persist();
    }
    nightIndex = firstUnconfirmed();
    phase = store.unlockSeen ? gate(nightIndex) : "unlock";
    refresh();
  }

  function deactivate() {
    clearTimers();
    stopSignal();
    finishPress(true);
    openBeat = null;
  }

  function bind() {
    elements.watchCardAction.addEventListener("click", advance);
    elements.watchConfirm.addEventListener("click", () => {
      if (phase === "copy") confirmCopy();
      else if (phase === "send") finishSend();
      else advance();
    });
    elements.watchRepeat.addEventListener("click", askRepeat);
    elements.watchGap.addEventListener("click", () => typeLetter(" "));
    elements.watchBack.addEventListener("click", backspace);
    elements.watchPad.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      try {
        elements.watchPad.setPointerCapture(event.pointerId);
      } catch {
        // A pointer that has already gone cannot be captured; pointerup still ends it.
      }
      beginPress(event.pointerId);
    });
    elements.watchPad.addEventListener("pointerup", (event) => {
      if (pressPointerId !== event.pointerId) return;
      event.preventDefault();
      finishPress();
    });
    elements.watchPad.addEventListener("pointercancel", (event) => {
      if (pressPointerId === event.pointerId) finishPress(true);
    });
    elements.watchPad.addEventListener("keydown", (event) => {
      if (event.code !== "Space" || event.repeat || padKeyboardHeld) return;
      event.preventDefault();
      padKeyboardHeld = true;
      beginPress();
    });
    elements.watchPad.addEventListener("keyup", (event) => {
      if (event.code !== "Space" || !padKeyboardHeld) return;
      event.preventDefault();
      padKeyboardHeld = false;
      finishPress();
    });
    elements.watchPad.addEventListener("blur", () => {
      if (!padKeyboardHeld) return;
      padKeyboardHeld = false;
      finishPress(true);
    });
  }

  return Object.freeze({
    activate,
    advance,
    backspace,
    bind,
    confirm: () => {
      if (phase === "copy") confirmCopy();
      else if (phase === "send") finishSend();
      else advance();
    },
    copyOpen,
    deactivate,
    markInterrupted,
    pause,
    phase: () => phase,
    render,
    resume,
    typeLetter,
    unlocked,
    wordGap: () => typeLetter(" "),
  });
}
