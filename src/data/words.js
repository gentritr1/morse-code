/**
 * Common English words built only from the starter pool (K M R S A T O I N E),
 * two to five letters. Real words are the bridge between hearing a character and
 * copying a transmission, so the list stays ordinary on purpose: no jargon, no
 * abbreviations, nothing a learner would have to spell out letter by letter.
 */
export const WORDS = Object.freeze([
  "AM", "AN", "AS", "AT", "IN", "IS", "IT", "ME", "NO", "ON", "OR", "SO", "TO",
  "AIM", "AIR", "ANT", "ARE", "ARM", "ART", "ATE", "EAR", "EAT", "ERA", "KIN",
  "KIT", "MAN", "MAT", "MEN", "MET", "NET", "NOR", "NOT", "OAK", "OAR", "OAT",
  "ONE", "ORE", "RAM", "RAN", "RAT", "RIM", "SAT", "SEA", "SET", "SIR", "SIT",
  "SKI", "SON", "TAN", "TEA", "TEN", "TIE", "TIN", "TOE", "TON",
  "ATOM", "EARN", "EAST", "IRON", "ITEM", "KITE", "KNIT", "MAIN", "MAKE", "MARK",
  "MASK", "MAST", "MATE", "MEAN", "MEAT", "MINE", "MINT", "MIST", "MOST", "NAME",
  "NEAR", "NEAT", "NEST", "NOTE", "OMIT", "RAIN", "RANK", "RATE", "REST", "RISE",
  "RISK", "ROSE", "SAME", "SEAT", "SENT", "SKIN", "STAR", "STEM", "TAKE", "TANK",
  "TEAM", "TEAR", "TERM", "TIME", "TIRE", "TONE", "TORN", "TRIM",
  "MINOR", "MOIST", "NOISE", "ONSET", "ROAST", "SAINT", "SKATE", "SMART", "SNORT",
  "STAIR", "STAKE", "STARE", "STEAM", "STERN", "STONE", "STORE", "STORM", "TOAST",
  "TRAIN", "TREAT",
]);

/** Words the learner could actually decode: every letter is already unlocked. */
export function wordsFrom(letters) {
  const available = new Set(letters);
  return WORDS.filter((word) => [...word].every((letter) => available.has(letter)));
}
