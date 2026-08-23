import { MORSE } from "../data/morse.js";

const TONE_HZ = 600;
/**
 * PARIS is 50 units long, of which 31 are elements and intra-character gaps.
 * Farnsworth stretches only the remaining 19 units, so characters keep arriving
 * at full speed while the learner gets more room between them (ARRL method).
 */
/** The fading-signal cycle: a Watch 2 line breathes about this slowly. */
const FADE_CYCLE_SECONDS = 7;
/** The band stays open a moment after the last mark, the way a receiver does. */
const NOISE_TAIL_SECONDS = 0.4;
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

/* ------------------------------------------------------------------ fists -- */

/** FNV-1a. A name for a string that is the same name in every session. */
export function stableHash(text) {
  let hash = 2166136261;
  const value = String(text ?? "");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A linear congruential generator, so "random" jitter is reproducible. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * One operator sending one line, as a schedule.
 *
 * A fist is learnable only because it repeats: the jitter comes from a
 * generator seeded on the station and the message, never from `Math.random`, so
 * the same person sending the same words is the same sound every time. The
 * multipliers are applied to the Cabin's own Farnsworth numbers rather than to a
 * second timing model — `expr` interpolates every deviation back toward
 * textbook 1:3:1, which is what makes a Clear Channel night a gentler version of
 * the same person rather than a different one.
 *
 * Pure, like `scheduleText`: the array it returns drives the oscillators, the
 * marks on screen and any test, so what is heard and what is measured cannot
 * drift apart.
 */
export function fistSchedule(text, speed, { fist, watch, seed = "", mask = [] } = {}) {
  const base = speedTiming(speed);
  const expression = Number.isFinite(watch?.expr) ? watch.expr : 1;
  const blend = (value) => 1 + (value - 1) * expression;

  const unit = base.unitMs * blend(fist.unit);
  const dash = unit * blend(fist.dash / 3) * 3;
  const intra = unit * blend(fist.intra);
  const letterGap = base.charGapMs * blend(fist.letter / 3);
  const wordGap = base.wordGapMs * blend(fist.word / 7);
  const jitterDot = (fist.jitDot ?? 0) * expression;
  const jitterDash = (fist.jitDash ?? 0) * expression;
  const hesitation = (fist.hesit ?? 0) * expression;
  const dropout = watch?.drop ?? 0;
  const amplitude = fist.amp ?? 1;

  const random = seededRandom(stableHash(`${seed}|${text}`));
  const words = String(text ?? "").toUpperCase().trim().split(/\s+/).filter(Boolean);
  const marks = [];
  let time = 0;
  let index = 0;

  words.forEach((word, wordIndex) => {
    const hidden = mask.includes(wordIndex);
    [...word].forEach((character, characterIndex) => {
      const pattern = MORSE[character] ?? "";
      [...pattern].forEach((symbol, symbolIndex) => {
        const isDash = symbol === "-";
        const spread = isDash ? jitterDash : jitterDot;
        const duration = (isDash ? dash : unit) * (1 + (random() * 2 - 1) * spread);
        // A dropped element is a real gain value on a real node, not a mark
        // removed from the list: the time it occupies still passes.
        const dropped = dropout > 0 && random() < dropout;
        if (!hidden) {
          marks.push({
            start: time,
            duration,
            symbol,
            character,
            index,
            gain: amplitude * (dropped ? 0.3 : 1),
          });
        }
        time += duration + (symbolIndex < pattern.length - 1 ? intra : 0);
      });
      index += 1;
      if (characterIndex < word.length - 1) {
        time += letterGap + (hesitation > 0 && random() < hesitation ? letterGap : 0);
      }
    });
    if (wordIndex < words.length - 1) {
      time += wordGap;
      // Iris pauses before a closing K. Operators know each other by this.
      if (fist.pauseBeforeK && words[wordIndex + 1] === "K") time += letterGap;
    }
  });

  return marks;
}

export class MorseAudio {
  #context = null;
  #liveTone = null;
  /** Every oscillator this instance has scheduled and not yet let expire. */
  #nodes = [];
  /**
   * When the last scheduled node stops, on the same clock the rest of the app
   * uses. A freshly created AudioContext starts its own clock only once the
   * audio thread spins up, so the two are permanently offset by that startup;
   * reading the guard off the context clock would keep it shut for that long
   * after the answer window had already opened.
   */
  #endsAtMs = 0;

  #ensureContext() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!this.#context) this.#context = new Context();
    if (this.#context.state === "suspended") this.#context.resume();
    return this.#context;
  }

  /**
   * Silence anything still scheduled. Two signals sounding at once is not a
   * cosmetic fault: the learner is being asked to name one character, so a
   * second transmission laid over the first makes the round unanswerable and
   * the response clock meaningless.
   */
  stop() {
    for (const node of this.#nodes) {
      try {
        node.stop(0);
      } catch {
        // A node that already ended cannot be stopped again, and need not be.
      }
    }
    this.#nodes = [];
    this.#endsAtMs = 0;
    this.stopTone();
  }

  /** True until the last scheduled node's end time has passed. */
  isPlaying() {
    if (!this.#nodes.length) return false;
    return performance.now() < this.#endsAtMs;
  }

  /**
   * The static bed. A transmission from somewhere else arrives over a carrier,
   * and the hiss under it is what makes it a signal rather than a tone the app
   * produced. It is atmosphere and carries no information — the marks are the
   * message — so it exists only under transmissions, at a level well below the
   * tone, and it is pushed onto the same node list so `stop()` takes it with
   * everything else.
   */
  #playStatic(context, startAt, durationSeconds) {
    const lead = 0.05;
    const tail = 0.25;
    const seconds = Math.min(durationSeconds + lead + tail, 20);
    const length = Math.max(1, Math.ceil(seconds * context.sampleRate));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 950;
    filter.Q.value = 0.5;
    const gain = context.createGain();
    gain.gain.value = 0.012;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(Math.max(context.currentTime, startAt - lead));
    source.stop(startAt + durationSeconds + tail);
    this.#nodes.push(source);
  }

  #playSchedule(marks, ambience = false) {
    try {
      this.stop();
      const context = this.#ensureContext();
      if (!context) return false;
      const base = context.currentTime + 0.06;
      const baseMs = performance.now() + 60;

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
        this.#nodes.push(oscillator);
        // The audible end, not the node's stop time: the extra 20 ms is a
        // safety margin on an oscillator whose gain is already at zero, and
        // counting it would keep the replay guard shut after the answer window
        // had already opened.
        this.#endsAtMs = Math.max(this.#endsAtMs, baseMs + mark.start + mark.duration);
      }
      // The bed spans the transmission, but never the answer window: the guard
      // is still the last tone, so the keys open exactly when the message ends.
      if (ambience) {
        const last = marks[marks.length - 1];
        this.#playStatic(context, base, (last.start + last.duration) / 1000);
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

  /**
   * One or more characters with Farnsworth spacing between them. `ambience`
   * lays the static bed underneath: it belongs to the transmission's identity,
   * not to a setting, so only the caller that is sending one asks for it.
   */
  playText(text, speed, { ambience = false } = {}) {
    const marks = scheduleText(text, speed);
    if (!marks.length) return false;
    return this.#playSchedule(marks, ambience);
  }

  /**
   * A Night Watch transmission: one operator's fist, over one Watch's
   * conditions. Everything the Watch table describes reaches the graph as a
   * real node parameter rather than as a number in a config object — the noise
   * bed is a filtered buffer at the Watch's own gain, the amplitude fade is an
   * LFO wired into a master gain the tones pass through, and a dropped element
   * is that element's own envelope. Returns the schedule it played, so the marks
   * on screen run on the same array.
   */
  playFist(text, speed, options = {}) {
    const marks = fistSchedule(text, speed, options);
    if (!marks.length) return null;
    try {
      this.stop();
      const context = this.#ensureContext();
      if (!context) return null;
      const watch = options.watch ?? {};
      const base = context.currentTime + 0.12;
      const baseMs = performance.now() + 120;
      const last = marks[marks.length - 1];
      const spanSeconds = (last.start + last.duration) / 1000;

      // The fade is one node the whole transmission passes through, so a line
      // that outlasts the cycle really does come and go under the learner.
      let output = context.destination;
      if (watch.fade > 0) {
        const fade = context.createGain();
        fade.gain.value = 1 - watch.fade / 2;
        const lfo = context.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 1 / FADE_CYCLE_SECONDS;
        const depth = context.createGain();
        depth.gain.value = watch.fade / 2;
        lfo.connect(depth).connect(fade.gain);
        fade.connect(context.destination);
        lfo.start(Math.max(context.currentTime, base - 0.1));
        lfo.stop(base + spanSeconds + 0.4);
        this.#nodes.push(lfo);
        output = fade;
      }

      if (watch.noise > 0) this.#playNoiseBed(context, base, spanSeconds, watch.noise);

      for (const mark of marks) {
        const time = base + mark.start / 1000;
        const duration = mark.duration / 1000;
        const peak = 0.2 * (mark.gain ?? 1);
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = TONE_HZ;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peak, time + 0.006);
        gain.gain.setValueAtTime(peak, Math.max(time + 0.006, time + duration - 0.006));
        gain.gain.linearRampToValueAtTime(0, time + duration);
        oscillator.connect(gain).connect(output);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);
        this.#nodes.push(oscillator);
        this.#endsAtMs = Math.max(this.#endsAtMs, baseMs + mark.start + mark.duration);
      }
      return marks;
    } catch {
      return null;
    }
  }

  /** The band, not the transmission: a wider, louder bed than a Cabin message. */
  #playNoiseBed(context, startAt, durationSeconds, level) {
    const seconds = Math.min(durationSeconds + 0.3 + NOISE_TAIL_SECONDS, 40);
    const length = Math.max(1, Math.ceil(seconds * context.sampleRate));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 950;
    filter.Q.value = 0.5;
    const gain = context.createGain();
    gain.gain.value = level;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(Math.max(context.currentTime, startAt - 0.3));
    source.stop(startAt + durationSeconds + NOISE_TAIL_SECONDS);
    this.#nodes.push(source);
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
