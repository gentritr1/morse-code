import {
  ACQ_MIN_GAP,
  CONF_HALFLIFE,
  CONF_LIVE,
  DEFAULT_BASELINE_MS,
  FIRST_LISTEN_MIN,
  LAPSE_CAP,
  MAX_STAB,
  PAIR_LIST_CAP,
  RECENT_WINDOW,
  RT_CAP,
  RT_LOG_CAP,
  RT_WINDOW,
  SEND_BAND_MIN,
  SEND_BAND_WINDOW,
  SEND_LOG_CAP,
  SHORT_FOLLOWUP,
  SLOW_FACTOR,
  STAB_INTERVALS,
  STEADY_HITS,
  STORAGE_KEYS,
} from "../config.js";
import { STARTER_POOL } from "../data/morse.js";

/**
 * Per-character retention state. The rule the whole module exists to enforce:
 * **same-session repetition cannot buy a long-term interval.** Answering a
 * character cleanly four times in one sitting proves it is in short-term
 * memory and nothing else; the same character coming back clean after a real
 * elapsed gap is the only evidence that it stuck, so stability only ever rises
 * on a review that was genuinely due.
 *
 * Each letter carries a phase — `acq` (acquiring), `rev` (in long-term review)
 * or `rel` (relearning after a lapse) — beside its stability index, due time,
 * acquisition step, lapse timestamps and clean response times.
 */
const OUTCOMES = new Set(["hit", "miss"]);
const PHASES = new Set(["acq", "rev", "rel"]);

function emptyLetterMetrics() {
  return {
    attempts: 0,
    correct: 0,
    totalResponseMs: 0,
    fastestMs: 0,
    exposures: 0,
    sendAttempts: 0,
    sendClean: 0,
    firstListenAttempts: 0,
    firstListenCorrect: 0,
    replays: 0,
    hints: 0,
    lastSeenAt: 0,
    lastHitAt: 0,
    recent: [],
    responseMs: [],
    phase: "acq",
    stab: 0,
    step: 0,
    acqStart: 0,
    dueAt: 0,
    lastOk: 0,
    lapses: [],
    rts: [],
  };
}

function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function safeOutcomes(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => OUTCOMES.has(entry)).slice(-RECENT_WINDOW);
}

function safeTimes(value, cap) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => safeCount(entry)).filter((entry) => entry > 0).slice(-cap);
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Exponential decay on a half-life: an event from one half-life ago counts
 * half. Used for confusions, their cures, and lapses, so nothing a learner has
 * long since fixed keeps steering the session.
 */
export function decayed(timestamps, halfLife, now = Date.now()) {
  if (!Array.isArray(timestamps) || halfLife <= 0) return 0;
  return timestamps.reduce((total, ts) => total + 2 ** (-(now - ts) / halfLife), 0);
}

/**
 * Reading a character inside a word is a different skill from naming it on its
 * own, and mixing the two corrupts both: one wrong letter in a five-letter word
 * used to push every character in it into relearning. Word rounds therefore
 * keep their own counters and never touch the schedule.
 *
 * `att` is every position seen, `elig` the ones that were not interrupted, `ok`
 * the correct ones among those, and `indep` the ones that were also clean.
 */
export function emptyContextRecord() {
  return { att: 0, elig: 0, ok: 0, indep: 0 };
}

/**
 * Why a pair was missed, not merely that it was. Two characters that genuinely
 * sound alike, a character the learner knows but cannot reach in time, and one
 * they could not name even after a second listen are three different faults
 * with three different cures — and drilling the pair is the right answer to
 * only the first of them.
 */
export function emptyCauseRecord() {
  return { discrimination: 0, hesitation: 0, uncertain: 0 };
}

export function createEmptyPerformanceProfile() {
  return {
    letters: Object.fromEntries(STARTER_POOL.map((letter) => [letter, emptyLetterMetrics()])),
    context: Object.fromEntries(STARTER_POOL.map((letter) => [letter, emptyContextRecord()])),
    confusions: {},
    pairWins: {},
    confCause: {},
    rtLog: { char: [], word: [] },
    sendLog: [],
  };
}

export function confusionKey(target, answered) {
  return `${target}>${answered}`;
}

function readPairList(source) {
  const pairs = {};
  if (!source || typeof source !== "object") return pairs;
  for (const [key, value] of Object.entries(source)) {
    if (!/^[A-Z]>[A-Z]$/.test(key)) continue;
    const list = safeTimes(value, PAIR_LIST_CAP);
    if (list.length) pairs[key] = list;
  }
  return pairs;
}

/**
 * Word-round counters, read defensively. The record was `{n, ok}` before
 * interrupted and replay-assisted positions were separated out; `n` counted
 * every attempt, so it maps onto both `att` and `elig` — reading it as `att`
 * alone would leave `elig` at zero and let a later accuracy divide by nothing.
 */
function readContext(source) {
  const out = {};
  for (const letter of STARTER_POOL) {
    const record = source?.[letter];
    if (!record || typeof record !== "object") {
      out[letter] = emptyContextRecord();
      continue;
    }
    const legacy = !Number.isFinite(Number(record.elig));
    const n = safeCount(record.n);
    const att = Number.isFinite(Number(record.att)) ? safeCount(record.att) : n;
    const elig = legacy ? n : safeCount(record.elig);
    const ok = Math.min(safeCount(record.ok), elig);
    out[letter] = { att: Math.max(att, elig), elig, ok, indep: Math.min(safeCount(record.indep), ok) };
  }
  return out;
}

/** Cause counts, read defensively: a missing or malformed record is zeros. */
function readCauseMap(source) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const [key, value] of Object.entries(source)) {
    if (!/^[A-Z]>[A-Z]$/.test(key) || !value || typeof value !== "object") continue;
    const record = {
      discrimination: Math.floor(safeCount(value.discrimination)),
      hesitation: Math.floor(safeCount(value.hesitation)),
      uncertain: Math.floor(safeCount(value.uncertain)),
    };
    if (record.discrimination || record.hesitation || record.uncertain) out[key] = record;
  }
  return out;
}

/**
 * Read-migration, never a wipe. Every field is read on its own with a
 * zero-or-empty default, and a letter written before the scheduler existed is
 * placed rather than reset: one that already came back cleanly five times with
 * a recent record good enough to trust starts in review, due twenty hours
 * after it was last seen; everything else starts acquiring.
 */
export function readPerformanceProfile(storage, now = Date.now()) {
  const profile = createEmptyPerformanceProfile();
  const stored = storage.getJson(STORAGE_KEYS.performance, null);
  if (!stored || typeof stored !== "object" || !stored.letters) return profile;

  const legacyConfusions = {};

  for (const letter of STARTER_POOL) {
    const source = stored.letters[letter];
    if (!source || typeof source !== "object") continue;

    const metrics = {
      attempts: safeCount(source.attempts),
      correct: safeCount(source.correct),
      totalResponseMs: safeCount(source.totalResponseMs),
      fastestMs: safeCount(source.fastestMs),
      exposures: safeCount(source.exposures),
      // Send was stored as `mirrorAttempts` before Send left the Signal Lab.
      // The old name is read once here and never written again.
      sendAttempts: safeCount(source.sendAttempts) || safeCount(source.mirrorAttempts),
      sendClean: safeCount(source.sendClean),
      firstListenAttempts: safeCount(source.firstListenAttempts),
      firstListenCorrect: safeCount(source.firstListenCorrect),
      replays: safeCount(source.replays),
      hints: safeCount(source.hints),
      lastSeenAt: safeCount(source.lastSeenAt),
      lastHitAt: safeCount(source.lastHitAt),
      recent: safeOutcomes(source.recent),
      responseMs: safeTimes(source.responseMs, RECENT_WINDOW),
      phase: PHASES.has(source.phase) ? source.phase : null,
      stab: Math.min(MAX_STAB, safeCount(source.stab)),
      step: safeCount(source.step),
      acqStart: safeCount(source.acqStart),
      dueAt: safeCount(source.dueAt),
      lastOk: safeCount(source.lastOk) || safeCount(source.lastHitAt),
      lapses: safeTimes(source.lapses, LAPSE_CAP),
      rts: safeTimes(source.rts, RT_WINDOW),
    };

    // Invariants the rest of the module is entitled to assume. A record that
    // claims more correct answers than attempts, or fewer exposures than
    // attempts, is not an error to throw on — it is a number to bring back
    // inside the range that makes an accuracy meaningful.
    metrics.correct = Math.min(metrics.correct, metrics.attempts);
    metrics.exposures = Math.max(metrics.exposures, metrics.attempts);
    metrics.firstListenCorrect = Math.min(metrics.firstListenCorrect, metrics.firstListenAttempts);

    if (!metrics.phase) {
      const hits = metrics.recent.filter((outcome) => outcome === "hit").length;
      const trusted = metrics.firstListenAttempts >= FIRST_LISTEN_MIN && hits >= STEADY_HITS;
      if (trusted) {
        metrics.phase = "rev";
        metrics.stab = Math.max(1, metrics.stab);
        metrics.dueAt = (metrics.lastSeenAt || now) + STAB_INTERVALS[1];
      } else {
        metrics.phase = "acq";
        metrics.step = Math.min(1, metrics.firstListenCorrect);
      }
    }

    // Counts written by the pre-decay profile become timestamps, so an old
    // confusion still exists but is allowed to fade like any other.
    if (source.confusions && typeof source.confusions === "object") {
      for (const answer of STARTER_POOL) {
        const count = safeCount(source.confusions[answer]);
        if (!count || answer === letter) continue;
        const at = metrics.lastSeenAt || now - 24 * 60 * 60 * 1000;
        legacyConfusions[confusionKey(letter, answer)] = Array.from(
          { length: Math.min(PAIR_LIST_CAP, count) },
          () => at,
        );
      }
    }

    profile.letters[letter] = metrics;
  }

  profile.confusions = { ...legacyConfusions, ...readPairList(stored.confusions) };
  profile.pairWins = readPairList(stored.pairWins);
  profile.context = readContext(stored.context);
  profile.confCause = readCauseMap(stored.confCause);
  profile.rtLog = {
    char: safeTimes(stored.rtLog?.char, RT_LOG_CAP),
    word: safeTimes(stored.rtLog?.word, RT_LOG_CAP),
  };
  profile.sendLog = Array.isArray(stored.sendLog)
    ? stored.sendLog
      .filter((entry) => entry && typeof entry === "object" && safeCount(entry.unit))
      .map((entry) => ({
        ts: safeCount(entry.ts),
        ratio: Number.isFinite(Number(entry.ratio)) ? Number(entry.ratio) : null,
        gapUnits: Number.isFinite(Number(entry.gapUnits)) ? Number(entry.gapUnits) : null,
        cv: Number.isFinite(Number(entry.cv)) ? Number(entry.cv) : null,
        unit: safeCount(entry.unit),
      }))
      .slice(-SEND_LOG_CAP)
    : [];
  return profile;
}

/* ------------------------------------------------------------------ pace -- */

/**
 * The learner's own pace: the median of the last forty clean first-listen
 * responses, pooled. "Slow" is always relative to this, never to a fixed clock
 * — a beginner at three seconds a character is early, not failing.
 */
export function poolBaseline(profile) {
  const log = profile.rtLog?.char ?? [];
  if (log.length < 5) return DEFAULT_BASELINE_MS;
  return median(log) ?? DEFAULT_BASELINE_MS;
}

/**
 * Copying a character inside a word is slower than naming one on its own, so
 * "slow" in a word round is measured against the learner's own word pace.
 */
export function wordBaseline(profile) {
  const log = profile.rtLog?.word ?? [];
  if (log.length < 5) return DEFAULT_BASELINE_MS;
  return median(log) ?? DEFAULT_BASELINE_MS;
}

/** A character's own pace once it has enough of its own samples to have one. */
export function letterBaseline(profile, letter) {
  const own = profile.letters[letter]?.rts ?? [];
  if (own.length >= 4) return median(own) ?? poolBaseline(profile);
  return poolBaseline(profile);
}

/* ------------------------------------------------------------ confusions -- */

/** What is left of a confusion once its cures are subtracted and both decay. */
export function confStrength(profile, key, now = Date.now()) {
  const conf = decayed(profile.confusions?.[key], CONF_HALFLIFE, now);
  const wins = decayed(profile.pairWins?.[key], CONF_HALFLIFE, now);
  return Math.max(0, conf - 0.6 * wins);
}

/** The strongest live confusion, restricted to characters actually in play. */
export function topPair(profile, now = Date.now(), allowed = null) {
  let best = null;
  let bestStrength = CONF_LIVE;
  for (const key of Object.keys(profile.confusions ?? {})) {
    const [target, answer] = key.split(">");
    if (allowed && (!allowed.includes(target) || !allowed.includes(answer))) continue;
    const strength = confStrength(profile, key, now);
    if (strength > bestStrength) {
      bestStrength = strength;
      best = [target, answer];
    }
  }
  return best;
}

export function confForLetter(profile, letter, now = Date.now()) {
  return Object.keys(profile.confusions ?? {})
    .filter((key) => key.split(">").includes(letter))
    .reduce((total, key) => total + confStrength(profile, key, now), 0);
}

/**
 * What went wrong, decided from the same evidence the scheduler used. A replay
 * or a hint means the learner never retrieved it at all; an unaided answer that
 * arrived well past their own pace is a reach, not a mix-up; anything else is
 * two characters genuinely sounding alike.
 */
export function missCause({ assisted = false, rt = 0, baseline = DEFAULT_BASELINE_MS } = {}) {
  if (assisted) return "uncertain";
  if (Number.isFinite(rt) && baseline > 0 && rt > SLOW_FACTOR * baseline) return "hesitation";
  return "discrimination";
}

/** The cause a pair is mostly missed for. Ties fall to discrimination. */
export function topCause(profile, key) {
  const record = profile.confCause?.[key];
  if (!record) return null;
  const highest = Math.max(record.discrimination, record.hesitation, record.uncertain);
  if (!highest) return null;
  if (record.discrimination === highest) return "discrimination";
  return record.hesitation === highest ? "hesitation" : "uncertain";
}

export function noteConfusion(profile, target, answered, now = Date.now(), cause = null) {
  if (!target || !answered || target === answered) return;
  const key = confusionKey(target, answered);
  profile.confusions[key] = [...(profile.confusions[key] ?? []), now].slice(-PAIR_LIST_CAP);
  if (!cause) return;
  if (!profile.confCause) profile.confCause = {};
  const record = profile.confCause[key] ?? emptyCauseRecord();
  if (record[cause] === undefined) return;
  record[cause] += 1;
  profile.confCause[key] = record;
}

/**
 * A pair win is only recorded for the pair the session is actually repairing,
 * and only for its target — telling the two apart is the skill, so a clean
 * answer on the character that gets mistaken for something else is the cure.
 */
export function notePairWin(profile, letter, now = Date.now(), allowed = null) {
  const pair = topPair(profile, now, allowed);
  if (!pair || pair[0] !== letter) return;
  const key = confusionKey(pair[0], pair[1]);
  profile.pairWins[key] = [...(profile.pairWins[key] ?? []), now].slice(-PAIR_LIST_CAP);
}

/* -------------------------------------------------------- word context -- */

/**
 * One character position inside a word or burst. It writes nowhere near the
 * schedule: a word says something about reading in context, not about whether
 * the character itself has been retained, and one wrong position must never be
 * able to push a whole message into relearning.
 */
export function recordContext(profile, letter, options = {}) {
  const {
    hit = false, clean = false, interrupted = false, answered = "", at = Date.now(), cause = null,
  } = options;
  if (!profile.context) profile.context = {};
  const record = profile.context[letter] ?? emptyContextRecord();
  record.att += 1;
  if (!interrupted) {
    record.elig += 1;
    if (hit) record.ok += 1;
    if (hit && clean) record.indep += 1;
    // The confusion model takes the same evidence test as the scheduler.
    if (!hit) noteConfusion(profile, letter, answered, at, cause);
  }
  profile.context[letter] = record;
  return record;
}

/**
 * The whole word's elapsed time, kept only when the copy was clean. It is what
 * "slow in a word" is later measured against; a wrong word contributes nothing.
 */
export function recordWordTime(profile, responseMs) {
  const value = Math.max(0, Math.min(60000, Number(responseMs) || 0));
  if (!value) return;
  profile.rtLog = {
    char: profile.rtLog?.char ?? [],
    word: [...(profile.rtLog?.word ?? []), value].slice(-RT_LOG_CAP),
  };
}

/* -------------------------------------------------------------- grading -- */

/**
 * One answer, graded against the schedule. Pure in the sense that matters: no
 * DOM, no storage, no clock of its own — it mutates the metrics object it is
 * handed and returns what happened, so the trainer can splice a retry and the
 * drawer can re-render from the same data.
 *
 * Nothing advances without `qualifies`: correct, unreplayed, unhinted,
 * uninterrupted, and not slow against the baseline measured *before* this
 * attempt is added to it.
 */
export function gradeLetter(metrics, options = {}) {
  const {
    hit = false,
    rt = 0,
    replayed = false,
    hint = false,
    now = Date.now(),
    baseline = DEFAULT_BASELINE_MS,
  } = options;

  const interrupted = Boolean(options.interrupted) || rt > RT_CAP;

  // An interrupted trial is not evidence in either direction. Somebody who
  // takes a phone call mid-signal has not forgotten the character and has not
  // remembered it either: record the exposure, bring it back later in the
  // session, and change nothing that a schedule or an accuracy reads.
  if (interrupted) {
    metrics.exposures += 1;
    metrics.lastSeenAt = now;
    return {
      hit,
      clean: false,
      slow: false,
      qualifies: false,
      interrupted: true,
      eligible: false,
      heldBack: false,
      scored: false,
      retry: { min: 3, max: 6 },
    };
  }

  const assisted = replayed || hint;
  const clean = hit && !assisted;
  const slow = clean && rt > SLOW_FACTOR * baseline;
  const qualifies = clean && !slow;
  // Eligibility is decided before anything mutates: a review only counts as
  // due against the due time it carried into this answer.
  const eligible = metrics.phase === "rev" && now >= metrics.dueAt;
  let heldBack = false;
  let retry = null;
  let scored = true;

  metrics.exposures += 1;
  metrics.lastSeenAt = now;

  if (!hit) {
    // A lapse that repeats inside three days costs two levels, not one: the
    // second miss says the interval was wrong, not that the day was bad. A
    // miss the learner had already replayed does not compound, because the
    // replay, not the interval, is what the evidence is about.
    const recentLapse = !assisted && decayed(metrics.lapses, 3 * 24 * 60 * 60 * 1000, now) > 0.5;
    metrics.attempts += 1;
    metrics.stab = Math.max(0, metrics.stab - (recentLapse ? 2 : 1));
    metrics.lapses = [...metrics.lapses, now].slice(-LAPSE_CAP);
    metrics.phase = "rel";
    metrics.step = 0;
    metrics.acqStart = now;
    metrics.dueAt = now + SHORT_FOLLOWUP;
    retry = { min: 3, max: 6 };
  } else if (!clean) {
    // Replay-assisted: practice, not retrieval. No scored credit, and `lastOk`
    // is left alone so the forgetting curve is not falsely flattened by a
    // character the learner could only name on the second listen.
    scored = false;
    retry = { min: 4, max: 7 };
  } else {
    metrics.attempts += 1;
    metrics.correct += 1;
    metrics.lastOk = now;
    metrics.rts = [...metrics.rts, rt].slice(-RT_WINDOW);

    if (metrics.phase === "acq" || metrics.phase === "rel") {
      if (!metrics.acqStart) metrics.acqStart = now;
      if (qualifies) metrics.step += 1;
      if (qualifies && metrics.step >= 2 && now - metrics.acqStart >= ACQ_MIN_GAP) {
        metrics.phase = "rev";
        metrics.stab = Math.max(metrics.stab, 1);
        metrics.dueAt = now + STAB_INTERVALS[metrics.stab];
      } else {
        metrics.dueAt = now;
        retry = { min: 4, max: 7 };
      }
    } else if (eligible) {
      if (qualifies) {
        metrics.stab = Math.min(metrics.stab + 1, MAX_STAB);
        metrics.dueAt = now + STAB_INTERVALS[metrics.stab];
      } else {
        // Correct, but slow: the interval is not earned, and the character
        // comes back inside the same sitting instead.
        heldBack = true;
        metrics.dueAt = now + SHORT_FOLLOWUP;
      }
    }
    // Correct but not yet due is practice. It changes nothing on purpose.
  }

  return { hit, clean, slow, qualifies, interrupted: false, eligible, heldBack, scored, retry };
}

/* ------------------------------------------------------------- retention -- */

/**
 * How likely the character is to have gone, on a half-life model against the
 * interval it was last scheduled for. `1 − recallRisk` is what the drawer
 * renders as brightness.
 */
export function recallRisk(metrics, now = Date.now()) {
  if (!metrics.lastOk) return 1;
  const half = metrics.stab >= 1 ? STAB_INTERVALS[metrics.stab] : SHORT_FOLLOWUP;
  if (!half) return 1;
  return 1 - 2 ** (-(now - metrics.lastOk) / half);
}

export function retentionOf(metrics, now = Date.now()) {
  return Math.max(0, Math.min(1, 1 - recallRisk(metrics, now)));
}

/**
 * The three retention words the rest of the product speaks: a character still
 * being acquired or relearned is `fresh`, one in review is `stable`, and one
 * in review whose due time has passed is `fading`.
 */
export function retentionState(metrics, now = Date.now()) {
  if (metrics.phase !== "rev") return "fresh";
  return metrics.dueAt && now >= metrics.dueAt ? "fading" : "stable";
}

export function isOverdue(metrics, now = Date.now()) {
  return metrics.phase === "rev" && Boolean(metrics.dueAt) && now >= metrics.dueAt;
}

/* ---------------------------------------------------------------- labels -- */

/**
 * One word for where a character stands. `Locked` belongs to the view; this
 * module only describes characters the learner is actually practising.
 */
export function label(metrics, baseline = DEFAULT_BASELINE_MS) {
  // An interrupted or replay-assisted round is not scored, but it was still
  // heard: `exposures` is what keeps the row from claiming otherwise.
  if (!metrics.attempts && !metrics.exposures) return "Unheard";
  if (metrics.phase === "acq" && metrics.step < 1) return "New";
  if (metrics.phase === "acq" || metrics.phase === "rel") return "Settling";
  if (metrics.stab <= 1) return "Steady";
  const own = median(metrics.rts);
  return own !== null && own <= baseline ? "Instant" : "Stable";
}

export function isInstant(metrics, baseline = DEFAULT_BASELINE_MS) {
  return label(metrics, baseline) === "Instant";
}

export function recognitionScore(metrics, now = Date.now()) {
  if (!metrics.attempts) return 0;
  const evidence = Math.min(1, (metrics.stab + (metrics.phase === "rev" ? 1 : metrics.step)) / 3);
  return Math.max(0, Math.min(1, evidence * retentionOf(metrics, now)));
}

/**
 * The internal north star: the share of the characters in play that come back
 * instantly. It is never shown as a number — it only picks a sentence.
 */
export function instantRate(profile, letters) {
  const pool = letters.filter((letter) => profile.letters[letter]);
  if (!pool.length) return 0;
  const instant = pool.filter((letter) => isInstant(profile.letters[letter], letterBaseline(profile, letter)));
  return instant.length / pool.length;
}

/* ------------------------------------------------------------------ send -- */

/**
 * Symbols are decided after the fact, from the learner's own tempo. A clear
 * long/short split in the durations classifies itself; only a transmission
 * that never varied falls back to the preset's threshold.
 */
export function classify(durations, unitMs = 0) {
  const list = durations.filter((value) => Number.isFinite(value) && value > 0);
  if (!list.length) return "";
  const min = Math.min(...list);
  const max = Math.max(...list);
  if (list.length > 1 && max / min >= 1.8) {
    const threshold = (min + max) / 2;
    return list.map((value) => (value < threshold ? "." : "-")).join("");
  }
  const unit = unitMs > 0 ? unitMs : min;
  return list.map((value) => (value < unit * 2 ? "." : "-")).join("");
}

/**
 * The unit the learner was actually sending at, by least squares against the
 * ideal 1 / 3 weights. Tempo and rhythm are different faults, and fitting the
 * unit first is what separates them.
 */
export function fitUnit(durations, want) {
  if (!Array.isArray(durations) || typeof want !== "string") return null;
  if (durations.length !== want.length || !durations.length) return null;
  let numerator = 0;
  let denominator = 0;
  durations.forEach((duration, index) => {
    const ideal = want[index] === "." ? 1 : 3;
    numerator += duration * ideal;
    denominator += ideal * ideal;
  });
  return denominator ? numerator / denominator : null;
}

const within = (value, low, high) => value !== null && value !== undefined && value >= low && value <= high;

/** One word for a fist, from the proportions rather than from a percentage. */
export function sendBand(ratio, gapUnits, cv) {
  if (within(ratio, 2.7, 3.3) && within(gapUnits, 0.85, 1.2) && (cv === null || cv === undefined || cv < 0.15)) return "clean";
  if (within(ratio, 2.4, 3.8) && within(gapUnits, 0.7, 1.5) && (cv === null || cv === undefined || cv < 0.25)) return "developing";
  if (within(ratio, 2.0, 4.5) && within(gapUnits, 0.5, 2.0) && (cv === null || cv === undefined || cv < 0.4)) return "readable";
  return "rough";
}

/**
 * A fist is an average, not a single transmission: the band is read off the
 * last few clean sends, and until there are enough of them it says so.
 */
export function sendAggregate(profile) {
  const log = (profile.sendLog ?? []).slice(-SEND_BAND_WINDOW);
  if (log.length < SEND_BAND_MIN) {
    return { band: null, clean: (profile.sendLog ?? []).length, needed: SEND_BAND_MIN };
  }
  const mean = (key) => {
    const values = log.map((entry) => entry[key]).filter((value) => Number.isFinite(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const ratio = mean("ratio");
  // A window of single-symbol characters (M is two dashes) has no dash/dot
  // ratio at all. That is missing evidence, not a rough fist.
  if (ratio === null) return { band: null, clean: (profile.sendLog ?? []).length, needed: SEND_BAND_MIN };
  return { band: sendBand(ratio, mean("gapUnits"), mean("cv")), clean: log.length, needed: SEND_BAND_MIN };
}

export function recordSend(profile, letter, { hit, ratio, gapUnits, cv, unit, at = Date.now() }) {
  const metrics = profile.letters[letter];
  if (!metrics) return;
  metrics.sendAttempts += 1;
  if (!hit) return;
  metrics.sendClean += 1;
  profile.sendLog = [
    ...(profile.sendLog ?? []),
    { ts: at, ratio: ratio ?? null, gapUnits: gapUnits ?? null, cv: cv ?? null, unit: unit || 0 },
  ].slice(-SEND_LOG_CAP);
}

/* --------------------------------------------------------- bookkeeping --- */

export function recordReplay(profile, letter) {
  const metrics = profile.letters[letter];
  if (metrics) metrics.replays += 1;
}

export function recordHint(profile, letter) {
  const metrics = profile.letters[letter];
  if (metrics) metrics.hints += 1;
}

/**
 * The counters behind the drawer and the HUD. `responseMs` is measured from the
 * END of the signal — stamping it at playback start would make every long
 * character look slow, which has nothing to do with recognition.
 */
export function recordPerformance(profile, target, answered, hit, responseMs, options = {}) {
  const metrics = profile.letters[target];
  if (!metrics) return;

  const {
    firstListen = false,
    at = Date.now(),
    timing = true,
    clean = false,
    scored = true,
    graded = false,
    interrupted = false,
    cause = null,
  } = options;
  const safeResponseMs = Math.max(0, Math.min(60000, Number(responseMs) || 0));

  // `gradeLetter` already moved `attempts`, `correct`, `exposures` and
  // `lastSeenAt` for a single-character round; a group round has no grader, so
  // it books its own — under the same scored/unscored rule.
  if (!graded) {
    metrics.exposures += 1;
    metrics.lastSeenAt = at;
    if (scored) {
      metrics.attempts += 1;
      metrics.correct += hit ? 1 : 0;
    }
  }
  if (scored) {
    metrics.totalResponseMs += safeResponseMs;
    metrics.fastestMs = metrics.fastestMs
      ? Math.min(metrics.fastestMs, safeResponseMs)
      : safeResponseMs;
  }
  // A round the learner walked away from invented no confusion: they did not
  // mistake one character for another, they simply were not there.
  if (!hit && !interrupted) noteConfusion(profile, target, answered, at, cause);

  if (!firstListen) return;
  metrics.firstListenAttempts += 1;
  metrics.firstListenCorrect += hit ? 1 : 0;
  if (hit) metrics.lastHitAt = at;
  metrics.recent = [...metrics.recent, hit ? "hit" : "miss"].slice(-RECENT_WINDOW);
  if (timing) metrics.responseMs = [...metrics.responseMs, safeResponseMs].slice(-RECENT_WINDOW);
  // The pooled baseline only ever sees answers that were actually earned.
  if (clean && timing) {
    profile.rtLog = { char: [...(profile.rtLog?.char ?? []), safeResponseMs].slice(-RT_LOG_CAP) };
  }
}
