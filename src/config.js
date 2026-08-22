export const SPRINT_SECONDS = 30;

export const STORAGE_KEYS = Object.freeze({
  theme: "morse-trainer-theme",
  mode: "morse-trainer-mode",
  difficulty: "morse-trainer-difficulty",
  onboarding: "morse-trainer-onboarding-complete",
  sprintBest: "morse-trainer-sprint-best",
  performance: "morse-trainer-performance-v1",
});

export const THEMES = Object.freeze({
  terminal: {
    title: "MORSE TRAINER v1.4",
    subtitle: "AMBER TERMINAL · SET 04",
    roster: "Starter alphabet",
  },
  teletext: {
    title: "MORSE 404",
    subtitle: "BROADCAST TELETEXT · PAGE 404",
    roster: "Page index",
  },
  pocket: {
    title: "CW-83",
    subtitle: "POCKET TRAINER · DESK UNIT",
    roster: "Alphabet bank",
  },
});

export const DIFFICULTIES = Object.freeze({
  gentle: 8,
  steady: 13,
  brisk: 20,
});

export const DIFFICULTY_DETAILS = Object.freeze({
  gentle: { label: "Gentle", meta: "8 WPM · clear spacing" },
  steady: { label: "Steady", meta: "13 WPM · recommended" },
  brisk: { label: "Brisk", meta: "20 WPM · fast recall" },
});

export const MODE_GUIDANCE = Object.freeze({
  learn: {
    label: "Learn path",
    title: "Build one clean sound-to-letter connection.",
    steps: ["Hear it", "See the shape", "Move on"],
  },
  drill: {
    label: "Drill path",
    title: "Turn recognition into fast, reliable recall.",
    steps: ["Listen", "Choose a letter", "Read feedback"],
  },
  sprint: {
    label: "Sprint path",
    title: "Measure how many signals you recognize under time.",
    steps: ["Start 30 sec", "Decode quickly", "Beat your best"],
  },
});

export const VALID_MODES = Object.freeze(["learn", "drill", "sprint"]);
