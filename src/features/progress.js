import {
  CONF_LIVE,
  GROUP_UNLOCK_AT,
  KOCH_ORDER,
  LAPSE_HALFLIFE,
  MIN_EFFECTIVE_WPM,
  SEED_SESSION_PHASES,
  SESSION_PHASES,
  SESSION_ROUNDS,
  SPACING_CLEAN_STREAK,
  SPACING_MISS_STREAK,
  SPACING_STEP,
  STORAGE_KEYS,
} from "../config.js";
import { wordsFrom } from "../data/words.js";
import { cleanAccuracy, retentionWindows } from "./events.js";
import {
  confForLetter,
  confusionKey,
  decayed,
  instantRate,
  isInstant,
  isOverdue,
  label,
  letterBaseline,
  median,
  poolBaseline,
  recallRisk,
  topCause,
  topPair,
} from "./performance-profile.js";

/**
 * Pure progression rules. No DOM, no timers, no storage: the trainer calls
 * these to decide which characters exist, what the next round should be, and
 * what to persist. The learner never chooses an exercise — this module does,
 * from their own data.
 */
export const STARTING_UNLOCKED = 2;

/** The old self-paced path was called "drill"; stored values now map to Learn. */
export const LEGACY_MODES = Object.freeze({ drill: "learn" });

function clampUnlocked(value) {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count)) return STARTING_UNLOCKED;
  return Math.min(KOCH_ORDER.length, Math.max(STARTING_UNLOCKED, count));
}

function clampOffset(value) {
  const offset = Math.round(Number(value));
  if (!Number.isFinite(offset) || offset > 0) return 0;
  return Math.max(-40, offset);
}

export function createProgress() {
  return { unlocked: STARTING_UNLOCKED, newPaused: false, effOffset: 0, sessions: 0, seeded: false };
}

/**
 * The first session is not a policy decision, it is an introduction: both
 * starting characters are taught, then contrasted against each other before
 * anything adaptive runs. A learner's very first minute should not be spent
 * proving something to a scheduler that has no data yet.
 */
export const SEED_QUEUE = Object.freeze([
  Object.freeze({ type: "intro", letter: KOCH_ORDER[0] }),
  Object.freeze({ type: "intro", letter: KOCH_ORDER[1] }),
  Object.freeze({ type: "letter", text: KOCH_ORDER[0], phase: "arrive" }),
  Object.freeze({ type: "letter", text: KOCH_ORDER[1], phase: "arrive" }),
  Object.freeze({ type: "letter", text: KOCH_ORDER[1], phase: "arrive" }),
  Object.freeze({ type: "letter", text: KOCH_ORDER[0], phase: "arrive" }),
  // Repair on the seed session is the same two characters contrasted once
  // more: there is no history yet for a confusion pair to come out of.
  Object.freeze({ type: "letter", text: KOCH_ORDER[1], phase: "repair" }),
  Object.freeze({ type: "letter", text: KOCH_ORDER[0], phase: "repair" }),
]);

export function needsSeeding(progress) {
  return !progress.seeded && (Number(progress.sessions) || 0) === 0;
}

/**
 * A visitor who already has history has already been introduced. The session
 * counter is new, so without this every returning learner would be taught the
 * two characters they have been practising for a week.
 */
export function markSeededFromHistory(progress, profile) {
  if (progress.seeded) return progress;
  const met = KOCH_ORDER.some((letter) => {
    const metrics = profile.letters[letter];
    return metrics && (metrics.attempts > 0 || metrics.exposures > 0 || metrics.firstListenAttempts > 0);
  });
  return met ? { ...progress, seeded: true } : progress;
}

export function readProgress(storage) {
  const stored = storage.getJson(STORAGE_KEYS.progress, null);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return createProgress();
  return {
    unlocked: clampUnlocked(stored.unlocked),
    newPaused: Boolean(stored.newPaused),
    effOffset: clampOffset(stored.effOffset),
    sessions: Math.max(0, Math.floor(Number(stored.sessions)) || 0),
    seeded: Boolean(stored.seeded) || (Math.floor(Number(stored.sessions)) || 0) > 0,
  };
}

export function writeProgress(storage, progress) {
  return storage.setJson(STORAGE_KEYS.progress, {
    unlocked: progress.unlocked,
    newPaused: Boolean(progress.newPaused),
    effOffset: clampOffset(progress.effOffset),
    sessions: Math.max(0, Math.floor(Number(progress.sessions)) || 0),
    seeded: Boolean(progress.seeded),
  });
}

export function unlockedLetters(progress) {
  return KOCH_ORDER.slice(0, progress.unlocked);
}

export function isUnlocked(progress, letter) {
  const index = KOCH_ORDER.indexOf(letter);
  return index > -1 && index < progress.unlocked;
}

export function isComplete(progress) {
  return progress.unlocked >= KOCH_ORDER.length;
}

export function nextLetter(progress) {
  return isComplete(progress) ? null : KOCH_ORDER[progress.unlocked];
}

export function unlockLetter(progress) {
  if (isComplete(progress)) return { progress, unlockedLetter: null };
  return {
    progress: { ...progress, unlocked: progress.unlocked + 1 },
    unlockedLetter: KOCH_ORDER[progress.unlocked],
  };
}

/* ------------------------------------------------------- selection lanes -- */

/**
 * Lanes come before scoring, so a character the learner has actually forgotten
 * never has to out-argue one that is merely new. Relearning first, then reviews
 * that are genuinely due, then acquisition, then anything fragile or caught in
 * a live confusion, then the rest.
 */
export function lane(profile, letter, now = Date.now()) {
  const metrics = profile.letters[letter];
  if (!metrics) return 4;
  if (metrics.phase === "rel") return 0;
  if (metrics.phase === "rev" && now >= metrics.dueAt) return 1;
  if (metrics.phase === "acq") return 2;
  if (metrics.stab <= 1 || confForLetter(profile, letter, now) > CONF_LIVE) return 3;
  return 4;
}

/** Inside a lane: how much this character is costing the learner right now. */
export function score(profile, letter, now = Date.now()) {
  const metrics = profile.letters[letter];
  if (!metrics) return 0;
  const own = median(metrics.rts);
  const baseline = poolBaseline(profile);
  const slowness = own === null ? 0.5 : Math.min(1, own / (2 * baseline));
  const lapse = Math.min(1, decayed(metrics.lapses, LAPSE_HALFLIFE, now) / 4);
  const conf = Math.min(1, confForLetter(profile, letter, now));
  return 0.5 * recallRisk(metrics, now) + 0.2 * lapse + 0.15 * slowness + 0.15 * conf;
}

export function ranked(profile, progress, now = Date.now()) {
  return unlockedLetters(progress).slice().sort((a, b) => {
    const laneA = lane(profile, a, now);
    const laneB = lane(profile, b, now);
    if (laneA !== laneB) return laneA - laneB;
    return score(profile, b, now) - score(profile, a, now);
  });
}

function padPick(list, count, pool) {
  const out = [...list];
  let index = 0;
  while (out.length < count && pool.length) {
    out.push(pool[index % pool.length]);
    index += 1;
  }
  return out.slice(0, count);
}

/* ------------------------------------------------------- the new-letter brake -- */

/**
 * New material is gated on workload, not on a count. It pauses when overdue
 * reviews pile up, when more than two characters are already being acquired or
 * relearned, or when clean accuracy slips; it resumes at forty percent of the
 * pause threshold with accuracy back up — hysteresis, so it cannot flicker
 * around one boundary. `progress.newPaused` is the one field this writes.
 */
export function readyForNew(profile, progress, now = Date.now(), events = []) {
  if (isComplete(progress)) return false;
  const pool = unlockedLetters(progress);
  const dueCount = pool.filter((letter) => {
    const metrics = profile.letters[letter];
    return metrics.phase === "rev" && metrics.dueAt <= now;
  }).length;
  const active = pool.filter((letter) => profile.letters[letter].phase !== "rev").length;
  const acc = cleanAccuracy(events, 30);
  const pauseAt = Math.max(4, Math.ceil(0.3 * progress.unlocked));

  if (progress.newPaused) {
    const clear = dueCount <= Math.floor(0.4 * pauseAt) && active <= 2 && (acc === null || acc >= 0.88);
    if (!clear) return false;
    progress.newPaused = false;
    return true;
  }
  if (dueCount >= pauseAt || active > 2 || (acc !== null && acc < 0.85)) {
    progress.newPaused = true;
    return false;
  }
  return true;
}

/** The character still being acquired that is furthest from settling. */
export function settlingLetter(profile, progress) {
  const pool = unlockedLetters(progress)
    .filter((letter) => profile.letters[letter].phase !== "rev")
    .sort((a, b) => profile.letters[a].step - profile.letters[b].step);
  return pool[0] ?? null;
}

/** One line for the letters drawer. Never a percentage, never a table. */
export function nextLetterLine(profile, progress, now = Date.now(), introPending = false) {
  if (isComplete(progress)) return "All 10 unlocked";
  if (introPending) return "Ready for the next letter";
  const dueCount = unlockedLetters(progress)
    .filter((letter) => isOverdue(profile.letters[letter], now)).length;

  if (progress.newPaused) {
    if (dueCount) return `New letters paused · ${dueCount} need${dueCount === 1 ? "s" : ""} review`;
    const settling = settlingLetter(profile, progress);
    if (settling) return `Next letter · when ${settling} settles`;
    return "New letters paused";
  }
  const settling = settlingLetter(profile, progress);
  if (settling) return `Next letter · when ${settling} settles`;
  return "Ready for the next letter";
}

/* -------------------------------------------------------------- the draw -- */

/** What one session owes every unlocked character, at minimum. */
export function coverageFloor(rounds = SESSION_ROUNDS, unlocked = 2) {
  return Math.max(0, Math.floor(rounds / Math.max(1, unlocked)) - 1);
}

/**
 * Weighted by `score`, but never at the cost of coverage: a character that is
 * behind waits at most one extra draw, and once the rounds left are only just
 * enough to clear every deficit the draw is restricted to the characters still
 * short. Repeats stay possible early, so a two-character pool cannot be
 * answered by alternating without listening.
 */
export function weightedLetter(profile, progress, previous, random = Math.random, history = {}) {
  const pool = unlockedLetters(progress);
  const served = history.served ?? {};
  const round = history.round ?? 1;
  const now = history.now ?? Date.now();
  const count = (letter) => Math.max(0, Number(served[letter]) || 0);

  const floor = coverageFloor(SESSION_ROUNDS, pool.length);
  const remaining = Math.max(0, SESSION_ROUNDS - round + 1);
  const behind = pool.filter((letter) => count(letter) < floor);
  const deficit = behind.reduce((sum, letter) => sum + (floor - count(letter)), 0);

  let source = behind.length && deficit >= remaining ? behind : pool;
  if (source.length > 1) {
    const lowest = Math.min(...source.map(count));
    const even = source.filter((letter) => count(letter) <= lowest + 1);
    if (even.length) source = even;
  }

  const choices = source.length > 2 && previous && previous.length === 1
    ? source.filter((letter) => letter !== previous)
    : source;
  const draw = choices.length ? choices : source;
  const weights = draw.map((letter) => 1 + 3 * score(profile, letter, now));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let ticket = random() * total;
  for (let index = 0; index < draw.length; index += 1) {
    ticket -= weights[index];
    if (ticket < 0) return draw[index];
  }
  return draw[draw.length - 1];
}

function burstText(progress, random = Math.random) {
  const pool = [...unlockedLetters(progress)];
  const length = pool.length >= 3 && random() < 0.5 ? 3 : 2;
  const letters = [];
  for (let index = 0; index < length && pool.length; index += 1) {
    const pick = Math.floor(random() * pool.length);
    letters.push(pool.splice(pick, 1)[0]);
  }
  return letters.join("");
}

/**
 * The phase table this session runs on. The first sitting spends its Arrive
 * phase on the opening run and only needs two Repair rounds after it, so it
 * finishes in the same twenty rounds as every session that follows.
 */
export function phaseTable(seeded = false) {
  return seeded ? SEED_SESSION_PHASES : SESSION_PHASES;
}

/** Which part of the session a round belongs to. The rail shows only this. */
export function phaseFor(round = 1, seeded = false) {
  const table = phaseTable(seeded);
  const clamped = Math.max(1, Math.min(SESSION_ROUNDS, Math.floor(round) || 1));
  return table.find((phase) => clamped <= phase.through) ?? table[table.length - 1];
}

/* ------------------------------------------------------------ the policy -- */

/**
 * Why this character is back, in the learner's words. Exactly one reason, in a
 * fixed priority, and only ever for a round that really was chosen for one.
 */
function roundReason(profile, letter, options) {
  const { now = Date.now(), pair = null, cause = null } = options;
  const metrics = profile.letters[letter];
  if (!metrics) return null;

  // Only a character that actually slipped says so. A splice that follows a
  // correct answer during acquisition is scheduling, not a verdict, and gets
  // no reason line at all.
  if (metrics.phase === "rel") return "slipped earlier";
  if (isOverdue(metrics, now)) return "back from yesterday";

  // A repair round exists *because* of the pair, and the cause says which of
  // three different faults it is — so it outranks the generic pace line, which
  // for a hesitation round would only be saying the same thing less usefully.
  if (pair) {
    const other = pair[0] === letter ? pair[1] : pair[0];
    if (cause === "discrimination") return `${pair[0]} and ${pair[1]} blur together`;
    if (cause === "hesitation") return `you know ${pair[0]}, but slowly`;
    if (cause === "uncertain") return `${pair[0]} slipped, even with a replay`;
    return `you mix this with ${other}`;
  }

  const own = median(metrics.rts);
  const baseline = letterBaseline(profile, letter);
  if (own !== null && baseline > 0 && own > baseline * 2) return "slow last time";
  return null;
}

function letterRound(profile, letter, phase, options = {}) {
  const withReason = phase.id === "arrive" || phase.id === "repair" || options.retry;
  return {
    type: "letter",
    text: letter,
    phase: phase.id,
    contrast: options.pair ?? null,
    cause: options.cause ?? null,
    retry: Boolean(options.retry),
    reason: withReason ? roundReason(profile, letter, options) : null,
  };
}

/**
 * The next round, from the phase the session is in and the lane order inside
 * it. Two things override the phase: a character that slipped and was spliced
 * back into the queue, and an earned character — an unlock is never made to
 * wait once the workload brake has released between rounds.
 */
export function pickRound({ profile, progress, events = [], history = {}, random = Math.random }) {
  const {
    round = 1,
    baseRound = round,
    previous = null,
    now = Date.now(),
    retries = [],
    wasReady = true,
  } = history;
  const seeding = needsSeeding(progress);
  const phase = phaseFor(baseRound, history.seeded ?? seeding);
  const order = ranked(profile, progress, now);

  // The opening run is fixed: teach both starting characters, then contrast
  // them. It overrides everything, including a retry, because nothing has been
  // answered yet for a retry to exist.
  if (seeding) {
    const item = SEED_QUEUE[history.seedIndex ?? 0];
    if (item && item.type === "intro") {
      return { type: "intro", text: item.letter, letter: item.letter, phase: "arrive", seed: true, unlock: false, reason: null, contrast: null, retry: false };
    }
    if (item) {
      return { type: "letter", text: item.text, phase: item.phase, seed: true, reason: null, contrast: null, retry: false };
    }
  }

  const dueRetry = retries.find((entry) => !entry.served && entry.atRound <= round);
  if (dueRetry) {
    return { ...letterRound(profile, dueRetry.letter, phase, { now, retry: true }), retryOf: dueRetry };
  }

  // The brake is normally evaluated by the caller once per round, so the one
  // field it writes is persisted with the rest of the progress record.
  const ready = history.ready === undefined ? readyForNew(profile, progress, now, events) : history.ready;
  if (ready && (phase.id === "new" || wasReady === false)) {
    const letter = nextLetter(progress);
    return { type: "intro", text: letter, letter, phase: phase.id, reason: null, contrast: null, retry: false };
  }

  const draw = (currentPhase = phase, extra = {}) => ({
    type: "letter",
    text: weightedLetter(profile, progress, previous, random, { ...history, now }),
    phase: currentPhase.id,
    contrast: null,
    reason: null,
    retry: false,
    ...extra,
  });

  if (phase.id === "arrive") {
    // The top of the lane order, one per round, padded so four rounds always
    // have four characters even in a two-character pool.
    const arrivals = padPick(order.slice(0, 4), 4, order);
    const letter = arrivals[Math.max(0, baseRound - 1)] ?? order[0];
    return letterRound(profile, letter, phase, { now });
  }

  if (phase.id === "repair") {
    const index = Math.max(0, baseRound - 5) % 2;
    const pair = topPair(profile, now, unlockedLetters(progress));
    if (pair) {
      const key = confusionKey(pair[0], pair[1]);
      const cause = topCause(profile, key);
      // Not everything that looks like a confusion is one. A pair the learner
      // only ever misses after a replay has not been discriminated at all yet,
      // so it is re-taught once before being drilled; a pair they get right
      // when given time is a speed problem, and alternating the two characters
      // would drill the wrong thing.
      if (cause === "uncertain" && history.pairRefreshed !== key) {
        return {
          type: "intro",
          text: pair[0],
          letter: pair[0],
          phase: phase.id,
          unlock: false,
          refresh: true,
          pairKey: key,
          reason: null,
          contrast: pair,
          retry: false,
        };
      }
      if (cause === "hesitation") return letterRound(profile, pair[0], phase, { now, pair, cause });
      return letterRound(profile, pair[index], phase, { now, pair, cause });
    }
    const two = order.length > 1 ? [order[0], order[1]] : padPick([], 2, order);
    return letterRound(profile, two[index] ?? order[0], phase, { now });
  }

  if (phase.id === "new") {
    // Nothing to hand over: the phase costs one ordinary round and the rail
    // marks the segment skipped rather than done.
    return draw(phase, { skipped: "new" });
  }

  if (phase.id === "use" && progress.unlocked >= GROUP_UNLOCK_AT) {
    const words = wordsFrom(unlockedLetters(progress));
    if (words.length >= 3) {
      const word = words[Math.floor(random() * words.length)] ?? words[0];
      return { type: "word", text: word, phase: phase.id, contrast: null, reason: null, retry: false };
    }
    const burst = burstText(progress, random);
    if (burst.length > 1) {
      return { type: "burst", text: burst, phase: phase.id, contrast: null, reason: null, retry: false };
    }
  }

  return draw();
}

/**
 * Where a slipped character goes back into the live session: `min..max` rounds
 * ahead, capped at two splices per character per session so one bad answer
 * cannot take the sitting over.
 */
export function scheduleRetry(retries, letter, round, retry, random = Math.random) {
  // Served splices stay in the list so the cap counts the whole session.
  if (retries.filter((entry) => entry.letter === letter).length >= 2) return retries;
  const span = Math.max(0, retry.max - retry.min);
  const offset = retry.min + Math.floor(random() * (span + 1));
  return [...retries, { letter, atRound: round + offset, served: false }];
}

/* ------------------------------------------------------ adaptive spacing -- */

/** The gaps adapt; the characters never do. */
export function effectiveWpmFor(speed, progress) {
  const base = Number(speed?.effectiveWpm) > 0 ? Number(speed.effectiveWpm) : 0;
  if (!base) return base;
  return Math.max(MIN_EFFECTIVE_WPM, base + clampOffset(progress?.effOffset));
}

/**
 * Two consecutive missed group rounds widen the gaps; five consecutive clean
 * ones walk the offset back toward the preset the learner picked. Nothing here
 * touches character speed, so the sound of a character never changes.
 */
export function updateSpacing(progress, streaks, clean, baseEffectiveWpm) {
  const next = {
    miss: clean ? 0 : (streaks.miss ?? 0) + 1,
    clean: clean ? (streaks.clean ?? 0) + 1 : 0,
  };
  let offset = clampOffset(progress.effOffset);
  let direction = null;

  if (next.miss >= SPACING_MISS_STREAK) {
    const floor = Math.min(0, MIN_EFFECTIVE_WPM - baseEffectiveWpm);
    const target = Math.max(floor, offset - SPACING_STEP);
    if (target !== offset) direction = "wider";
    offset = target;
    next.miss = 0;
  } else if (next.clean >= SPACING_CLEAN_STREAK) {
    const target = Math.min(0, offset + SPACING_STEP);
    if (target !== offset) direction = "tighter";
    offset = target;
    next.clean = 0;
  }
  return { offset, streaks: next, direction };
}

/* ------------------------------------------------------------- sentences -- */

function instantClause(profile, progress) {
  const pool = unlockedLetters(progress);
  const instant = pool.filter((letter) => isInstant(profile.letters[letter], letterBaseline(profile, letter)));
  const rest = pool.filter((letter) => !instant.includes(letter));

  if (instantRate(profile, pool) === 1) {
    return [isComplete(progress)
      ? `All ${pool.length} letters are instant.`
      : `All ${pool.length} letters are instant — the next one is close.`];
  }
  const weakest = rest.reduce((worst, letter) => {
    const value = score(profile, letter, Date.now());
    return !worst || value > worst.value ? { letter, value } : worst;
  }, null);
  const tail = weakest ? `${weakest.letter} needs another listen.` : null;
  if (!instant.length) return tail ? [tail] : [];

  const named = instant.slice(0, 2);
  const lead = named.length === 2
    ? `${named[0]} and ${named[1]} are instant.`
    : `${named[0]} is instant.`;
  return tail ? [lead, tail] : [lead];
}

function retentionClause(events) {
  const { r24, r7 } = retentionWindows(events);
  const say = (window, noun) => (window.hit === window.tot
    ? `All ${window.tot} survived ${noun}.`
    : `${window.hit} of ${window.tot} signals survived ${noun}.`);
  if (r7.tot >= 3) return say(r7, "a week");
  if (r24.tot >= 3) return say(r24, "a night");
  return null;
}

/**
 * The one calm passage at the end of a session, built from clauses that are
 * true and dropped when they are not. Never more than three sentences, never
 * a number that is not a count of signals.
 */
export function sessionSentence(profile, progress, options = {}) {
  const { heldBack = [], lapsed = [], events = [], spacing = null } = options;
  const sentences = [...instantClause(profile, progress)];

  if (heldBack.length) sentences.push(`${heldBack[0]} answered, but slowly — it comes back sooner.`);
  if (lapsed.length) sentences.push(`${lapsed[0]} slipped and was relearned.`);
  if (progress.newPaused) {
    const settling = settlingLetter(profile, progress);
    if (settling) sentences.push(`New letters wait until ${settling} settles.`);
  }
  const retention = retentionClause(events);
  if (retention) sentences.push(retention);
  if (spacing === "wider") sentences.push("Gaps widened a little.");
  if (spacing === "tighter") sentences.push("Gaps tightened.");

  return sentences.slice(0, 3).join(" ");
}

/**
 * A plain draw from the unlocked pool, used where the schedule has no say: the
 * Send paddle and the very first target of a visit.
 */
export function nextTarget(pool, previous = null, random = Math.random) {
  const choices = pool.length > 2 && previous ? pool.filter((letter) => letter !== previous) : pool;
  const source = choices.length ? choices : pool;
  return source[Math.floor(random() * source.length)] ?? source[0];
}

/** Re-exported so the view can label a row without importing two modules. */
export { label };
