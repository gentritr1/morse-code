import { KOCH_ORDER, MIN_EFFECTIVE_WPM, SPEEDS } from "../config.js";
import { median } from "./performance-profile.js";

/**
 * Placement by performance, not by preference.
 *
 * Asking a beginner to pick a speed asks them to judge a sound they have never
 * heard. A same-or-different trial asks nothing they do not already know: two
 * signals arrive with a wide gap between them, and the only question is whether
 * they were one character twice or two different ones. Discriminating two
 * characters is the skill the whole trainer is built on, so the fastest rhythm
 * a learner can still tell apart is the honest place to start them, and how
 * long they take to decide is the honest amount of room to leave between
 * characters.
 *
 * Pure: no DOM, no audio, no storage. The guide plays the trials and stores the
 * result; everything decided here is decided from the log alone.
 */

/** Gentle · Steady · Brisk, slowest character speed first. */
export const PLACEMENT_PRESETS = Object.freeze(Object.keys(SPEEDS));
export const PLACEMENT_PER_PRESET = 4;
export const PLACEMENT_TRIALS = PLACEMENT_PRESETS.length * PLACEMENT_PER_PRESET;
/**
 * The pair is always sent with very wide spacing. The trial measures character
 * discrimination, so the gap must never be the thing that makes it hard.
 */
export const PLACEMENT_EFFECTIVE_WPM = 8;
/** How long the verdict stays on screen before the next pair. */
export const PLACEMENT_FEEDBACK_MS = 900;
/** A beat of silence before each pair, so the answer never lands on a tone. */
export const PLACEMENT_LEAD_MS = 320;

/** Three of four right is the floor for calling a rhythm audible. */
const PASS_ACCURACY = 0.75;
/** Deciding faster than this needs no extra room; slower than this needs more. */
const QUICK_MS = 1400;
const CONSIDERED_MS = 2600;
/** With nothing correct to measure, assume the slow end rather than the fast one. */
export const PLACEMENT_DEFAULT_LAT_MS = 2600;

function shuffle(items, random) {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

/**
 * Twelve pairs: four at each rhythm, two of them the same character twice and
 * two of them two different characters, then shuffled so the learner cannot
 * read the answer off the order. The characters are never shown — they are
 * drawn from the teaching pool only because those are the sounds the trainer
 * will go on to use.
 */
export function buildTrials(random = Math.random) {
  const draw = () => KOCH_ORDER[Math.min(KOCH_ORDER.length - 1, Math.floor(random() * KOCH_ORDER.length))];
  const trials = [];

  for (const preset of PLACEMENT_PRESETS) {
    for (let index = 0; index < PLACEMENT_PER_PRESET; index += 1) {
      const same = index % 2 === 0;
      const a = draw();
      let b = a;
      if (!same) {
        // A "different" pair that drew the same character twice would be
        // unanswerable, so it is redrawn — and, if the generator is degenerate,
        // stepped to its neighbour rather than left wrong.
        for (let guard = 0; b === a && guard < 50; guard += 1) b = draw();
        if (b === a) b = KOCH_ORDER[(KOCH_ORDER.indexOf(a) + 1) % KOCH_ORDER.length];
      }
      trials.push({ preset, a, b, same });
    }
  }

  return shuffle(trials, random);
}

/** The pair is played at the preset's character speed with a very wide gap. */
export function placementSpeed(preset) {
  const speed = SPEEDS[preset] ?? SPEEDS.gentle;
  return { ...speed, effectiveWpm: PLACEMENT_EFFECTIVE_WPM };
}

/**
 * Spacing follows the decision, not the answer: a learner who was right but
 * needed two and a half seconds is not ready for the gaps the preset ships
 * with. The offset is floored so the effective speed can never drop below the
 * slowest the trainer will send.
 */
function offsetFor(preset, lat) {
  const raw = lat < QUICK_MS ? 0 : lat < CONSIDERED_MS ? -2 : -4;
  const base = Number(SPEEDS[preset]?.effectiveWpm) > 0 ? Number(SPEEDS[preset].effectiveWpm) : 0;
  const floor = Math.min(0, MIN_EFFECTIVE_WPM - base);
  return Math.max(floor, raw);
}

/**
 * The fastest rhythm the learner could still tell apart, and the room they need
 * at it. Accuracy decides the character speed; the median time to decide on the
 * trials they got right at that speed decides the spacing.
 */
export function placeFrom(log) {
  const entries = Array.isArray(log) ? log : [];
  const rows = {};
  for (const entry of entries) {
    if (!PLACEMENT_PRESETS.includes(entry?.preset)) continue;
    (rows[entry.preset] ??= []).push(entry);
  }

  const acc = {};
  let chosen = PLACEMENT_PRESETS[0];
  for (const preset of PLACEMENT_PRESETS) {
    const trials = rows[preset] ?? [];
    acc[preset] = trials.length ? trials.filter((entry) => entry.hit).length / trials.length : 0;
    // The list runs slowest to fastest, so the last one that clears the bar wins.
    if (acc[preset] >= PASS_ACCURACY) chosen = preset;
  }

  const decided = (rows[chosen] ?? [])
    .filter((entry) => entry.hit)
    .map((entry) => Number(entry.rt))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const lat = decided.length ? Math.round(median(decided)) : PLACEMENT_DEFAULT_LAT_MS;

  return {
    chosen,
    effOffset: offsetFor(chosen, lat),
    acc,
    lat,
    replayed: entries.filter((entry) => Number(entry?.replays) > 0).length,
    trials: entries.length,
  };
}

/** `Steady · you told same from different at 22 wpm, deciding in about 1.2 s.` */
export function placementLine(placement) {
  const speed = SPEEDS[placement?.chosen];
  if (!speed) return "";
  const seconds = (Math.max(0, Number(placement.lat) || 0) / 1000).toFixed(1);
  return `${speed.label} · you told same from different at ${speed.charWpm} wpm, deciding in about ${seconds} s.`;
}

/** `Measured · 22 wpm` — the quiet line under the Speed label in settings. */
export function measuredLabel(placement) {
  const speed = SPEEDS[placement?.chosen];
  return speed ? `Measured · ${speed.charWpm} wpm` : "";
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * A stored measurement is read the way every other stored record is: coerced
 * into shape, never trusted, and dropped whole rather than half-applied.
 */
export function normalisePlacement(stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  if (!PLACEMENT_PRESETS.includes(stored.chosen)) return null;

  const acc = {};
  for (const preset of PLACEMENT_PRESETS) {
    acc[preset] = Math.min(1, Math.max(0, finiteOr(stored.acc?.[preset], 0)));
  }
  const effOffset = Math.min(0, Math.max(-40, Math.round(finiteOr(stored.effOffset, 0))));

  return {
    chosen: stored.chosen,
    effOffset,
    acc,
    lat: Math.max(0, Math.round(finiteOr(stored.lat, PLACEMENT_DEFAULT_LAT_MS))),
    at: Math.max(0, Math.round(finiteOr(stored.at, 0))),
  };
}
