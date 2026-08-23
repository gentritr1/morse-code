export const SPRINT_SECONDS = 30;

export const STORAGE_KEYS = Object.freeze({
  theme: "morse-trainer-theme",
  mode: "morse-trainer-mode",
  difficulty: "morse-trainer-difficulty",
  onboarding: "morse-trainer-onboarding-complete",
  sprintBest: "morse-trainer-sprint-best",
  performance: "morse-trainer-performance-v1",
  progress: "morse-trainer-progress-v1",
  events: "morse-trainer-events-v1",
});

/**
 * Koch-derived teaching order inside the starter pool: two characters to begin,
 * one more each time recognition holds. A and N stay far apart, and the two
 * single-element characters come last so beginners cannot lean on them.
 */
export const KOCH_ORDER = Object.freeze(["K", "M", "R", "S", "A", "T", "O", "I", "N", "E"]);

/**
 * Each machine keeps its own subtitle prefix; the suffix is the learner's own
 * station callsign, so the plate reads as *their* set rather than as a serial
 * number the product invented.
 */
export const THEMES = Object.freeze({
  terminal: {
    label: "Terminal",
    title: "MORSE TRAINER v1.4",
    prefix: "AMBER TERMINAL",
  },
  teletext: {
    label: "Teletext",
    title: "MORSE 404",
    prefix: "BROADCAST TELETEXT",
  },
  pocket: {
    label: "Pocket Trainer",
    title: "CW-83",
    prefix: "POCKET TRAINER",
  },
});

/** Callsign letters, minus the ones that read as digits in machine faces. */
export const CALLSIGN_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

/**
 * Farnsworth speeds: characters are always sent fast enough that they arrive as
 * one sound, and the gaps between them carry the difficulty. Counting a 450 ms
 * dash is a visual habit, so the slowest preset still sends characters at 18 wpm
 * — the bottom of the range the ARRL slow-speed material and CW Academy span —
 * and only the spacing changes across the three presets.
 */
export const SPEEDS = Object.freeze({
  gentle: { label: "Gentle", charWpm: 18, effectiveWpm: 8, hint: "18 wpm · wide gaps" },
  steady: { label: "Steady", charWpm: 22, effectiveWpm: 10, hint: "22 wpm" },
  brisk: { label: "Brisk", charWpm: 25, effectiveWpm: 14, hint: "25 wpm · tight gaps" },
});

export const VALID_MODES = Object.freeze(["learn", "sprint", "send"]);

/** A letter counts as known only after this many clean first listens. */
export const FIRST_LISTEN_MIN = 5;
/** Outcomes and response times kept per letter. */
export const RECENT_WINDOW = 5;
/** Recent hits needed inside that window before a letter reads as Steady. */
export const STEADY_HITS = 4;
/** Median first-listen response at or under this reads as Instant. */
export const INSTANT_MS = 2000;
/** One guided session. Roughly five minutes. */
export const SESSION_ROUNDS = 20;
/** Sprint is a checkpoint, not a starting point. */
export const SPRINT_UNLOCK_AT = 5;
/** A mastered letter goes stale after this many rounds or this much time. */
export const REVIEW_ROUNDS = 20;
export const REVIEW_MS = 24 * 60 * 60 * 1000;
/** Group rounds (bursts and words) start once the pool is worth combining. */
export const GROUP_UNLOCK_AT = 3;

/**
 * Retention needs a real gap. Answering a character cleanly twice in one sitting
 * proves it is in short-term memory; the same character coming back clean after
 * a night is the only evidence that it stuck, so stability is confirmed across
 * a gap of at least this long, and decays after two days out of the ear.
 */
export const STABLE_GAP_MS = 20 * 60 * 60 * 1000;
export const FADING_MS = 48 * 60 * 60 * 1000;

/**
 * The shape of one guided session. The rail shows it: arrive on what is already
 * known, repair the weak spots, take delivery of a new character, mix, then use
 * the alphabet on groups and words.
 */
export const SESSION_PHASES = Object.freeze([
  Object.freeze({ id: "arrive", label: "ARRIVE", through: 4 }),
  Object.freeze({ id: "repair", label: "REPAIR", through: 8 }),
  Object.freeze({ id: "new", label: "NEW", through: 9 }),
  Object.freeze({ id: "mix", label: "MIX", through: 16 }),
  Object.freeze({ id: "use", label: "USE", through: SESSION_ROUNDS }),
]);

/**
 * The very first session. Its opening run — the incoming transmission, two
 * intro cards, the four guided K/M discriminations and the same transmission
 * handed back — *is* the Arrive phase, and Repair only needs two rounds to
 * contrast the pair it just taught, so the first sitting is the same twenty
 * rounds as any other rather than a longer initiation.
 */
export const SEED_SESSION_PHASES = Object.freeze([
  Object.freeze({ id: "arrive", label: "ARRIVE", through: 5 }),
  Object.freeze({ id: "repair", label: "REPAIR", through: 7 }),
  Object.freeze({ id: "new", label: "NEW", through: 8 }),
  Object.freeze({ id: "mix", label: "MIX", through: 16 }),
  Object.freeze({ id: "use", label: "USE", through: SESSION_ROUNDS }),
]);

/** A first-listen answer this much slower than the learner's own baseline reads as slow. */
export const SLOW_FACTOR = 1.6;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Retention scheduling. Same-session repetition cannot buy a long-term
 * interval: a character only moves up this ladder when a review that was
 * genuinely due comes back clean, so the unit of progress is a real elapsed
 * gap rather than a run of answers in one sitting.
 */
export const STAB_INTERVALS = Object.freeze([
  0,
  20 * HOUR,
  3 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  60 * DAY,
]);
export const MAX_STAB = 6;
/** Two successes have to straddle at least this long before a letter graduates. */
export const ACQ_MIN_GAP = 3 * 60 * 1000;
/** Where a lapse, or a review that was held back, is put back in the queue. */
export const SHORT_FOLLOWUP = 10 * 60 * 1000;
/** Above this a response is an interruption, not a slow answer. */
export const RT_CAP = 10000;
/** With fewer than five clean samples the learner has no measured pace yet. */
export const DEFAULT_BASELINE_MS = 2600;
/** Clean first-listen response times kept per letter and pooled. */
export const RT_WINDOW = 8;
export const RT_LOG_CAP = 40;
/** Confusions and their cures both decay; lapses decay more slowly. */
export const CONF_HALFLIFE = 7 * DAY;
export const LAPSE_HALFLIFE = 14 * DAY;
export const CONF_LIVE = 0.35;
export const PAIR_LIST_CAP = 24;
export const LAPSE_CAP = 12;
/** Append-only attempt log. Retention is counted from it, never from counters. */
export const EVENT_CAP = 4000;
/** Sends kept for the aggregate band, and how many are needed to call one. */
export const SEND_LOG_CAP = 40;
export const SEND_BAND_WINDOW = 8;
export const SEND_BAND_MIN = 5;

/**
 * Spacing adapts, characters never do. Missing group rounds widens the gaps
 * between characters; a run of clean ones walks the offset back toward the
 * preset the learner chose.
 */
export const SPACING_STEP = 2;
export const SPACING_MISS_STREAK = 2;
export const SPACING_CLEAN_STREAK = 5;
export const MIN_EFFECTIVE_WPM = 6;

/**
 * Motivation is stated from evidence or not at all. Every threshold below is
 * the point at which a claim becomes something the log can actually support:
 * fewer samples than this and the sentence is simply omitted.
 */
/** Response times needed in a window before a pace can be quoted. */
export const TREND_MIN_SAMPLES = 8;
export const TREND_WINDOW_MS = 7 * DAY;
/** Below this the two medians are the same pace with different noise. */
export const TREND_MIN_DELTA_MS = 200;
/** A character answered again this long after a previous clean answer held overnight. */
export const NIGHT_GAP_HOURS = 18;
/** How far ahead the come-back line is allowed to look. */
export const RETURNING_WINDOW_MS = 36 * HOUR;
/** A visit is "returning" once the last scored attempt is at least this old. */
export const ARRIVAL_IDLE_MS = 20 * 60 * 1000;
/** Stability that means a character has been held for a week. */
export const SEVEN_DAY_STAB = 3;
/** Milestones are earned once each, and only from recorded evidence. */
export const MILESTONE_NAMES = Object.freeze(["sevenDay", "unaidedWord", "firstInstant", "allTen"]);
