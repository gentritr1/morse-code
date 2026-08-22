import { STORAGE_KEYS } from "../../config.js";
import { MORSE, STARTER_POOL } from "../../data/morse.js";

function emptyLetterMetrics() {
  return {
    attempts: 0,
    correct: 0,
    totalResponseMs: 0,
    fastestMs: 0,
    confusions: {},
    mirrorAttempts: 0,
    mirrorScoreTotal: 0,
  };
}

function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function createEmptyPerformanceProfile() {
  return {
    letters: Object.fromEntries(STARTER_POOL.map((letter) => [letter, emptyLetterMetrics()])),
  };
}

export function readPerformanceProfile(storage) {
  const profile = createEmptyPerformanceProfile();
  const stored = storage.getJson(STORAGE_KEYS.performance, null);
  if (!stored || typeof stored !== "object" || !stored.letters) return profile;

  for (const letter of STARTER_POOL) {
    const source = stored.letters[letter];
    if (!source || typeof source !== "object") continue;

    const confusions = {};
    if (source.confusions && typeof source.confusions === "object") {
      for (const answer of STARTER_POOL) {
        const count = safeCount(source.confusions[answer]);
        if (count) confusions[answer] = count;
      }
    }

    profile.letters[letter] = {
      attempts: safeCount(source.attempts),
      correct: safeCount(source.correct),
      totalResponseMs: safeCount(source.totalResponseMs),
      fastestMs: safeCount(source.fastestMs),
      confusions,
      mirrorAttempts: safeCount(source.mirrorAttempts),
      mirrorScoreTotal: safeCount(source.mirrorScoreTotal),
    };
  }
  return profile;
}

export function performanceTotals(profile) {
  return STARTER_POOL.reduce(
    (totals, letter) => {
      const metrics = profile.letters[letter];
      totals.attempts += metrics.attempts;
      totals.correct += metrics.correct;
      totals.mirrorAttempts += metrics.mirrorAttempts;
      return totals;
    },
    { attempts: 0, correct: 0, mirrorAttempts: 0 },
  );
}

export function totalMistakes(profile) {
  return STARTER_POOL.reduce((total, letter) => {
    const metrics = profile.letters[letter];
    return total + Math.max(0, metrics.attempts - metrics.correct);
  }, 0);
}

export function averageResponseMs(metrics) {
  return metrics.attempts ? metrics.totalResponseMs / metrics.attempts : 0;
}

export function recognitionScore(metrics) {
  if (!metrics.attempts) return 0;
  const accuracy = metrics.correct / metrics.attempts;
  const evidence = Math.min(1, metrics.attempts / 5);
  const responseSeconds = averageResponseMs(metrics) / 1000;
  const speed = Math.max(0, Math.min(1, 1 - (responseSeconds - 1) / 7));
  return evidence * accuracy * (0.78 + speed * 0.22);
}

export function recognitionLabel(metrics) {
  if (!metrics.attempts) return "Unheard";
  if (metrics.attempts < 3) return "Sampling";

  const accuracy = metrics.correct / metrics.attempts;
  const averageMs = averageResponseMs(metrics);
  if (accuracy >= 0.9 && averageMs <= 2500) return "Reliable";
  if (accuracy >= 0.7) return "Building";
  return "Needs contrast";
}

export function topConfusion(profile) {
  if (totalMistakes(profile) < 2) return null;

  let result = null;
  for (const target of STARTER_POOL) {
    const confusions = profile.letters[target].confusions;
    for (const answer of STARTER_POOL) {
      const count = safeCount(confusions[answer]);
      if (!count || target === answer) continue;
      if (!result || count > result.count) result = { target, answer, count };
    }
  }
  return result;
}

export function confusionInsight(target, answer) {
  const targetPattern = MORSE[target];
  const answerPattern = MORSE[answer];
  if (targetPattern.split("").reverse().join("") === answerPattern) {
    return "These signals reverse the same marks. Listen for which sound arrives first; the clinic will alternate their order.";
  }
  if (targetPattern[0] === answerPattern[0]) {
    return "These signals share the same opening. Keep listening past the first mark and let the ending make the decision.";
  }
  if (targetPattern.length !== answerPattern.length) {
    return "These signals use a different number of marks. Hear the whole phrase before choosing the letter.";
  }
  return "These signals have a similar silhouette but a different rhythm. Contrast practice will make the change easier to hear.";
}

export function recordPerformance(profile, target, answered, hit, responseMs) {
  const metrics = profile.letters[target];
  if (!metrics) return;

  const safeResponseMs = Math.max(0, Math.min(60000, responseMs));
  metrics.attempts += 1;
  metrics.correct += hit ? 1 : 0;
  metrics.totalResponseMs += safeResponseMs;
  metrics.fastestMs = metrics.fastestMs
    ? Math.min(metrics.fastestMs, safeResponseMs)
    : safeResponseMs;
  if (!hit) metrics.confusions[answered] = safeCount(metrics.confusions[answered]) + 1;
}
