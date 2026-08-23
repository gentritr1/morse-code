import {
  EVENT_CAP,
  NIGHT_GAP_HOURS,
  STORAGE_KEYS,
  TREND_MIN_SAMPLES,
  TREND_WINDOW_MS,
} from "../config.js";
import { median } from "./performance-profile.js";

/**
 * The attempt log: one append-only record per answered target, capped at
 * `EVENT_CAP`. Counters can only ever say how a character is doing *now*;
 * retention is a claim about a gap, so it has to be counted from the attempts
 * themselves. Nothing here is rendered as a number — the log decides which
 * sentence the learner reads at the end of a session.
 */
const HOUR = 60 * 60 * 1000;
const CONTEXTS = new Set(["char", "word", "send"]);

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function safeEvent(entry) {
  if (!entry || typeof entry !== "object") return null;
  const ts = safeNumber(entry.ts);
  const target = typeof entry.target === "string" ? entry.target : "";
  if (!ts || !target) return null;
  const replay = Boolean(entry.replay);
  const hint = Boolean(entry.hint);
  const interrupted = Boolean(entry.interrupted);
  const event = {
    ts,
    target,
    correct: Boolean(entry.correct),
    ctx: CONTEXTS.has(entry.ctx) ? entry.ctx : "char",
    rt: Math.round(safeNumber(entry.rt)),
    replay,
    hint,
    interrupted,
    // Whether the trial is evidence at all. Records written before the flag
    // existed are judged by the same three conditions it was derived from.
    scored: entry.scored === undefined
      ? !replay && !hint && !interrupted
      : Boolean(entry.scored),
  };
  if (typeof entry.reason === "string" && entry.reason) event.reason = entry.reason;
  return event;
}

export function readEvents(storage) {
  const stored = storage.getJson(STORAGE_KEYS.events, null);
  if (!Array.isArray(stored)) return [];
  return stored.map(safeEvent).filter(Boolean).slice(-EVENT_CAP);
}

export function writeEvents(storage, events) {
  return storage.setJson(STORAGE_KEYS.events, events.slice(-EVENT_CAP));
}

/** Appends one attempt and returns the capped list. Never mutates its input. */
export function appendEvent(events, entry) {
  const event = safeEvent({ ...entry, ts: entry?.ts || Date.now() });
  if (!event) return events;
  return [...events, event].slice(-EVENT_CAP);
}

/**
 * Only a scored trial is evidence of anything. An interrupted round and a
 * replay-assisted hit are both unscored; a replayed *miss* still counts,
 * because failing to name a character you have just heard twice is a fact.
 */
function cleanEvents(events, ctx = "char") {
  return events.filter((event) => {
    if (event.ctx !== ctx) return false;
    // A record written before the flag existed is judged by the three
    // conditions the flag was derived from, so an older log still counts.
    if (event.scored === undefined) return !event.replay && !event.hint && !event.interrupted;
    return Boolean(event.scored);
  });
}

/**
 * Did it survive the gap? One opportunity per gap: the first clean attempt that
 * lands `minH..maxH` hours after the last correct answer on the same target
 * closes that opportunity — correct or not — and the anchor then moves on. The
 * dedupe is the whole point. Without it, a character answered twice inside one
 * session against the same overnight anchor is counted twice, and a session
 * over ten characters can report sixteen signals surviving a night from ten
 * real overnight opportunities. Retention is a claim about elapsed time, so it
 * must never be inflatable by repetition inside one sitting.
 */
export function retention(events, minH, maxH, ctx = "char") {
  const byTarget = new Map();
  for (const event of cleanEvents(events, ctx)) {
    if (!byTarget.has(event.target)) byTarget.set(event.target, []);
    byTarget.get(event.target).push(event);
  }

  let hit = 0;
  let tot = 0;
  for (const list of byTarget.values()) {
    let anchor = null;
    for (const event of list) {
      if (anchor === null) {
        if (event.correct) anchor = event.ts;
        continue;
      }
      const gapH = (event.ts - anchor) / HOUR;
      if (gapH >= minH && gapH <= maxH) {
        tot += 1;
        if (event.correct) hit += 1;
        anchor = event.correct ? event.ts : null;
        continue;
      }
      if (gapH > maxH) {
        anchor = event.correct ? event.ts : null;
        continue;
      }
      if (event.correct) anchor = event.ts;
    }
  }
  return { hit, tot };
}

/** Overnight and week-long retention, the only two windows the product reads. */
export function retentionWindows(events) {
  return { r24: retention(events, 20, 28), r7: retention(events, 6 * 24, 8 * 24) };
}

/**
 * Whether recognition is getting faster, measured rather than asserted. The
 * current pace is the median clean response of the last seven days and the
 * comparison is the seven days before that; either window with fewer than
 * `TREND_MIN_SAMPLES` samples is not a pace, so it comes back null and the
 * sentence that would have quoted it is simply not written.
 */
export function latencyTrend(events, now = Date.now()) {
  const scored = cleanEvents(events).filter((event) => event.correct);
  const recent = scored
    .filter((event) => now - event.ts <= TREND_WINDOW_MS)
    .map((event) => event.rt);
  if (recent.length < TREND_MIN_SAMPLES) return null;

  const prior = scored
    .filter((event) => now - event.ts > TREND_WINDOW_MS && now - event.ts <= 2 * TREND_WINDOW_MS)
    .map((event) => event.rt);
  return {
    current: median(recent),
    before: prior.length >= TREND_MIN_SAMPLES ? median(prior) : null,
  };
}

/**
 * Which characters have come back after a night. The claim is about a gap, so
 * it is counted the same way retention is: only scored attempts, and only the
 * span between one correct answer and the next correct answer on the same
 * target. Answering something twice in one sitting can never produce it.
 */
export function survivedNight(events) {
  const anchors = new Map();
  const held = new Set();
  for (const event of cleanEvents(events)) {
    const anchor = anchors.get(event.target);
    if (!event.correct) continue;
    if (anchor && (event.ts - anchor) / HOUR >= NIGHT_GAP_HOURS) held.add(event.target);
    anchors.set(event.target, event.ts);
  }
  return [...held];
}

/** Clean accuracy over the last `n` attempts, or null while the sample is thin. */
export function cleanAccuracy(events, n = 30) {
  const recent = cleanEvents(events).slice(-n);
  if (recent.length < 8) return null;
  return recent.filter((event) => event.correct).length / recent.length;
}
