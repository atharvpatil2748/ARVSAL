/**
 * Robust Deterministic Theme Extractor
 *
 * - No LLM
 * - Episodic compatible
 * - Returns single dominant key (string)
 * - Multi-theme scoring internally
 * - Noise resistant
 */

const THEMES = {
  romantic_emotion: [
    "love", "longing", "miss", "heart", "sejal",
    "radha", "krishna", "relationship", "feelings"
  ],

  self_improvement: [
    "discipline", "focus", "productive", "productivity",
    "consistency", "improve", "average", "better",
    "wakeup", "wake up", "routine", "change myself",
    "control my mind"
  ],

  academics: [
    "quiz", "exam", "lecture", "assignment",
    "study", "studying", "paper", "test"
  ],

  emotional_distress: [
    "sad", "broken", "hurt", "cry", "lonely",
    "tired of", "exhausted", "lost", "overthinking"
  ],

  positive_emotion: [
    "happy", "excited", "enjoy", "fun",
    "great time", "felt good"
  ],

  tech_debugging: [
    "backend", "code", "debug", "logic",
    "server", "memory", "bug", "fixing"
  ],

  health: [
    "stomach", "pain", "hurt", "sick",
    "sleep", "diet", "health"
  ]
};


/* ================= CLEANING ================= */

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/* ================= SCORING ================= */

function scoreThemes(text) {
  const scores = {};
  const cleaned = normalize(text);

  for (const [theme, keywords] of Object.entries(THEMES)) {
    let score = 0;

    for (const word of keywords) {
      if (cleaned.includes(word)) {
        score += 1;
      }
    }

    if (score > 0) {
      scores[theme] = score;
    }
  }

  return scores;
}


/* ================= DOMINANT SELECTION ================= */

function extractKey(text = "") {
  if (!text || typeof text !== "string") {
    return "general";
  }

  const scores = scoreThemes(text);

  if (!Object.keys(scores).length) {
    return "general";
  }

  // Pick highest scoring theme
  let dominant = "general";
  let maxScore = 0;

  for (const [theme, score] of Object.entries(scores)) {
    if (score > maxScore) {
      dominant = theme;
      maxScore = score;
    }
  }

  return dominant;
}


/* ================= OPTIONAL: MULTI KEY SUPPORT ================= */
/* Use this later if you upgrade episodic memory */

function extractAllThemes(text = "") {
  const scores = scoreThemes(text);
  return Object.keys(scores);
}


module.exports = {
  extractKey,
  extractAllThemes
};