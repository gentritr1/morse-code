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

  playPattern(pattern, wordsPerMinute) {
    try {
      const context = this.#ensureContext();
      if (!context) return false;

      const unit = 1.2 / wordsPerMinute;
      let time = context.currentTime + 0.06;
      for (const symbol of pattern) {
        const duration = symbol === "." ? unit : unit * 3;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 600;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.008);
        gain.gain.setValueAtTime(0.2, Math.max(time + 0.008, time + duration - 0.008));
        gain.gain.linearRampToValueAtTime(0, time + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);
        time += duration + unit;
      }
      return true;
    } catch {
      return false;
    }
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
      oscillator.frequency.value = 600;
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
