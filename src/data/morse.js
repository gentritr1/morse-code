export const MORSE = Object.freeze({
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
});

export const STARTER_POOL = Object.freeze(["E", "T", "A", "N", "K", "M", "S", "O", "I", "R"]);

export const NOTES = Object.freeze({
  E: "One dot. E is the most common letter in English, so Morse gives it the shortest possible signal.",
  T: "One dash. The second most common letter, and the only other single-element character.",
  A: "Dot then dash. Short, then long. It is E followed by T.",
  N: "Dash then dot. The mirror of A. Confusing these two is a common beginner mistake.",
  K: "Dash dot dash. Operators send K to mean ‘go ahead’—your turn to transmit.",
  M: "Two dashes. T twice. It pairs with N as a long-and-short contrast.",
  S: "Three dots. With O it makes the distress call SOS.",
  O: "Three dashes. The long half of SOS: three short, three long, three short.",
  I: "Two dots. E twice. Hear it as one even beat, not a hesitation.",
  R: "Dot dash dot. A with a dot added to the end.",
});

export function randomLetter(exclude = null, pool = STARTER_POOL) {
  const availablePool = Array.isArray(pool) && pool.length ? pool : STARTER_POOL;
  const choices = exclude && availablePool.length > 1
    ? availablePool.filter((letter) => letter !== exclude)
    : availablePool;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function visiblePattern(pattern) {
  return pattern
    .split("")
    .map((symbol) => (symbol === "." ? "·" : "—"))
    .join(" ");
}

export function spokenPattern(pattern) {
  return pattern
    .split("")
    .map((symbol, index) => {
      if (symbol === "-") return "dah";
      return index === pattern.length - 1 ? "dit" : "di";
    })
    .join(" ");
}
