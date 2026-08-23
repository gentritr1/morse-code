import { KOCH_ORDER } from "../config.js";

/**
 * The world the letters unlock. Every transmission is a real message from a
 * station that is not us, and each one can only arrive once every character
 * inside it has genuinely been taught — the catalog is ordered by the longest
 * teaching prefix it needs, so they come through in the order the ear earns
 * them rather than in an order the product picked.
 *
 * `needs` is that prefix of `KOCH_ORDER`, spelled out: it is the whole gate.
 * Pure data and pure lookups; nothing here reads storage or touches the DOM.
 */
export const TRANSMISSIONS = Object.freeze([
  Object.freeze({
    id: "t01",
    text: "ARMS",
    needs: "KMRSA",
    origin: "Harbour Light",
    note: "The night watch, counting what came ashore.",
  }),
  Object.freeze({
    id: "t02",
    text: "MARS",
    needs: "KMRSA",
    origin: "Summit Hut",
    note: "Sent at the exact minute it rose.",
  }),
  Object.freeze({
    id: "t03",
    text: "MAST",
    needs: "KMRSAT",
    origin: "North Buoy",
    note: "One word from a boat with no flag.",
  }),
  Object.freeze({
    id: "t04",
    text: "STORM",
    needs: "KMRSATO",
    origin: "North Buoy",
    note: "Weather passed between ships, older than any forecast.",
  }),
  Object.freeze({
    id: "t05",
    text: "ROAST",
    needs: "KMRSATO",
    origin: "Mill Station",
    note: "Supper, announced to the whole valley.",
  }),
  Object.freeze({
    id: "t06",
    text: "MOST",
    needs: "KMRSATO",
    origin: "Ridge Relay",
    note: "The answer to a question nobody heard asked.",
  }),
  Object.freeze({
    id: "t07",
    text: "SOS",
    needs: "KMRSATO",
    origin: "unknown, very weak",
    note: "The oldest distress call. It stopped after the third repeat.",
  }),
  Object.freeze({
    id: "t08",
    text: "NO RAIN",
    needs: "KMRSATOIN",
    origin: "Mill Station",
    note: "A warning to leave the pumps uncovered.",
  }),
  Object.freeze({
    id: "t09",
    text: "ONE TON",
    needs: "KMRSATOINE",
    origin: "Mill Station",
    note: "Cargo confirmed for the valley line.",
  }),
  Object.freeze({
    id: "t10",
    text: "AT TEN",
    needs: "KMRSATOINE",
    origin: "Ridge Relay",
    note: "A meeting time, sent twice. Someone is expected.",
  }),
  Object.freeze({
    id: "t11",
    text: "STONE",
    needs: "KMRSATOINE",
    origin: "Summit Hut",
    note: "A trail marker name, sent once at dusk.",
  }),
  Object.freeze({
    id: "t12",
    text: "RAIN AT SEA",
    needs: "KMRSATOINE",
    origin: "North Buoy",
    note: "Winter's first report from the outer water.",
  }),
]);

/** The characters a transmission is spelled from, spaces removed. */
export function lettersOf(text) {
  return [...String(text ?? "").toUpperCase()].filter((character) => character !== " ");
}

/** Its place in the catalog, which is the number the learner is told. */
export function transmissionNumber(id) {
  const index = TRANSMISSIONS.findIndex((entry) => entry.id === id);
  return index < 0 ? 0 : index + 1;
}

export function transmissionById(id) {
  return TRANSMISSIONS.find((entry) => entry.id === id) ?? null;
}

/**
 * What could come through right now: every character taught, and not already
 * in the archive. Catalog order, so the earliest-arriving is always first.
 */
export function availableTransmissions(unlocked = [], archive = {}) {
  const pool = new Set(unlocked);
  const held = archive && typeof archive === "object" ? archive : {};
  return TRANSMISSIONS.filter((entry) => {
    if (held[entry.id]) return false;
    return lettersOf(entry.text).every((letter) => pool.has(letter));
  });
}

/** Every archived transmission, in catalog order, for the drawer. */
export function archivedTransmissions(archive = {}) {
  const held = archive && typeof archive === "object" ? archive : {};
  return TRANSMISSIONS.filter((entry) => Boolean(held[entry.id]));
}

/** `Archive · 3 of 12` — a count of things decoded, never a score. */
export function archiveHeading(archive = {}) {
  return `Archive · ${archivedTransmissions(archive).length} of ${TRANSMISSIONS.length}`;
}

/** What is still out there. The drawer's last word, and the only tally in it. */
export function archiveRemaining(archive = {}) {
  const left = TRANSMISSIONS.length - archivedTransmissions(archive).length;
  if (left <= 0) return "Every known transmission is archived.";
  return `${left} ${left === 1 ? "signal" : "signals"} still out there.`;
}

/** True only for a catalog id, so a malformed record cannot invent one. */
export function isTransmissionId(id) {
  return TRANSMISSIONS.some((entry) => entry.id === id);
}

/** Every character every transmission needs is one the trainer actually teaches. */
export function spellable(entry) {
  const prefix = KOCH_ORDER.slice(0, entry.needs.length).join("");
  if (prefix !== entry.needs) return false;
  const pool = new Set([...entry.needs]);
  return lettersOf(entry.text).every((letter) => pool.has(letter));
}
