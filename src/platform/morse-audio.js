import { MORSE } from "../data/morse.js";

const TONE_HZ = 600;
/**
 * PARIS is 50 units long, of which 31 are elements and intra-character gaps.
 * Farnsworth stretches only the remaining 19 units, so characters keep arriving
 * at full speed while the learner gets more room between them (ARRL method).
 */
const PARIS_UNITS = 50;
const PARIS_ELEMENT_UNITS = 31;
const PARIS_GAP_UNITS = PARIS_UNITS - PARIS_ELEMENT_UNITS;

/**
 * Element and gap lengths in milliseconds for one speed preset. Pure: the same
 * numbers drive the oscillator schedule and the on-screen mark animation, so
 * what is heard and what is seen can never drift apart.
 */
export function speedTiming(speed) {
  const charWpm = Number(speed?.charWpm) > 0 ? Number(speed.charWpm) : 20;
  const effectiveWpm = Number(speed?.effectiveWpm) > 0 ? Number(speed.effectiveWpm) : charWpm;
  const unit = 1.2 / charWpm;
  const totalSeconds = 60 / effectiveWpm;
  const gapSeconds = totalSeconds - PARIS_ELEMENT_UNITS * unit;
  const gapUnit = effectiveWpm >= charWpm || gapSeconds <= 0
    ? unit
    : gapSeconds / PARIS_GAP_UNITS;
  return {
    unitMs: unit * 1000,
    gapUnitMs: gapUnit * 1000,
    charGapMs: gapUnit * 3000,
    wordGapMs: gapUnit * 7000,
  };
}

/**
 * The playback schedule for a piece of text: one entry per audible mark, in
 * milliseconds from the start of the transmission. Letters are separated by
 * Farnsworth character gaps and spaces by word gaps.
 */
export function scheduleText(text, speed) {
  const { unitMs, charGapMs, wordGapMs } = speedTiming(speed);
  const marks = [];
  let time = 0;

  const characters = String(text ?? "").toUpperCase().split("");
  characters.forEach((character, index) => {
    if (character === " ") {
      time += wordGapMs;
      return;
    }
    const pattern = MORSE[character];
    if (!pattern) return;

    [...pattern].forEach((symbol, symbolIndex) => {
      const duration = symbol === "." ? unitMs : unitMs * 3;
      marks.push({ start: time, duration, symbol, character, index });
      time += duration;
      if (symbolIndex < pattern.length - 1) time += unitMs;
    });

    const next = characters[index + 1];
    if (next && next !== " ") time += charGapMs;
  });

  return marks;
}

/** How long the whole transmission lasts, including its final mark. */
export function scheduleDurationMs(text, speed) {
  const marks = scheduleText(text, speed);
  if (!marks.length) return 0;
  const last = marks[marks.length - 1];
  return last.start + last.duration;
}

export class MorseAudio {
  #context = null;
  #liveTone = null;

  #ensureContext() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!this.#context) this.#context = new Context();
    if (this.#context.state === "suspended") this.#context.resume();
    return this.#context;
  }

  #playSchedule(marks) {
    try {
      const context = this.#ensureContext();
      if (!context) return false;
      const base = context.currentTime + 0.06;

      for (const mark of marks) {
        const time = base + mark.start / 1000;
        const duration = mark.duration / 1000;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = TONE_HZ;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.008);
        gain.gain.setValueAtTime(0.2, Math.max(time + 0.008, time + duration - 0.008));
        gain.gain.linearRampToValueAtTime(0, time + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** One character, keyed from its pattern rather than from the alphabet. */
  playPattern(pattern, speed) {
    const { unitMs } = speedTiming(speed);
    let time = 0;
    const marks = [...String(pattern ?? "")].map((symbol) => {
      const duration = symbol === "." ? unitMs : unitMs * 3;
      const mark = { start: time, duration, symbol };
      time += duration + unitMs;
      return mark;
    });
    if (!marks.length) return false;
    return this.#playSchedule(marks);
  }

  /** One or more characters with Farnsworth spacing between them. */
  playText(text, speed) {
    const marks = scheduleText(text, speed);
    if (!marks.length) return false;
    return this.#playSchedule(marks);
  }

  startTone() {
    this.stopTone();
    try {
      const context = this.#ensureContext();
      if (!context) return;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.value = TONE_HZ;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.008);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      this.#liveTone = { oscillator, gain };
    } catch {
      this.#liveTone = null;
    }
  }

  stopTone() {
    if (!this.#liveTone || !this.#context) return;
    try {
      const now = this.#context.currentTime;
      this.#liveTone.gain.gain.cancelScheduledValues(now);
      this.#liveTone.gain.gain.setValueAtTime(this.#liveTone.gain.gain.value, now);
      this.#liveTone.gain.gain.linearRampToValueAtTime(0, now + 0.012);
      this.#liveTone.oscillator.stop(now + 0.018);
    } catch {
      // A stopped audio node does not affect the visible paddle interaction.
    }
    this.#liveTone = null;
  }
}
