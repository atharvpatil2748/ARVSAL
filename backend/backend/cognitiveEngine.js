/**
 * Cognitive Engine – Production Stable
 *
 * - Always-on memory awareness
 * - Multi-subject detection
 * - Similarity-filtered episodic recall
 * - Deduplicated ranking
 * - Clean recallStrength
 */

const memory = require("./memory");
const episodicMemory = require("./episodicMemory");
const reflectionMemory = require("./reflectionMemory");

const { embedText } = require("./embeddingModel");
const { searchVectors } = require("./vectorStore");
const { resolveDateRange } = require("./dateResolver");

/* ================= CONFIG ================= */

const MAX_RESULTS = 6;
const VECTOR_THRESHOLD = 0.72;
const EPISODIC_SIM_THRESHOLD = 0.55;

/* ================= UTILS ================= */

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }

  if (!ma || !mb) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

function recencyScore(timestamp) {
  if (!timestamp) return 0.6;
  const age = Date.now() - timestamp;
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, 1 - age / maxAge);
}

function scoreItem(item) {
  const importance = item.importance ?? 0.6;
  const confidence = item.confidence ?? 0.6;
  const recency = recencyScore(item.timestamp);

  return importance * 0.4 + confidence * 0.4 + recency * 0.2;
}

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();
}

/* ================= SUBJECT DETECTION ================= */


function detectSubjects(text) {
  const lower = text.toLowerCase();
  const subjects = [
    "user",
    "arvsal",
    "assistant",
    "sejal",
    "sahil",
    "vandana",
    "omkar",
    "krishnat"
  ];

  const detected = subjects.filter(s => lower.includes(s));

  // 🔥 Fix pronoun logic
  if (lower.includes("your") || lower.includes("you")) {
    detected.push("arvsal");
  }

  if (lower.includes("my")) {
    detected.push("user");
  }

  if (!detected.length) detected.push("user");

  return [...new Set(detected)];
}

// function detectSubjects(text) {
//   const lower = text.toLowerCase();
//   const subjects = ["user", "sejal", "sahil", "vandana","omkar","krishnat","arvsal"];

//   const detected = subjects.filter(s => lower.includes(s));

//   if (!detected.length) detected.push("user");

//   return detected;
// }

/* ================= MAIN ================= */

async function processMemoryQuery({ text }) {

  if (!text || typeof text !== "string") {
    return { recallStrength: 0, relevantMemory: [] };
  }

  // Noise filter
  const cleanedText = normalize(text);
  if (cleanedText.length < 3) {
    return { recallStrength: 0, relevantMemory: [] };
  }

  const embedding = await embedText(text);
  if (!embedding) {
    return { recallStrength: 0, relevantMemory: [] };
  }

  const subjects = detectSubjects(text);

  let collected = [];

  /* ===== SEMANTIC ===== */

  for (const subject of subjects) {
  const facts = memory.summarize(subject) || [];

  for (const f of facts) {

    const semanticEmbedding = await embedText(`${f.key} ${f.value}`);
    const sim = cosine(embedding, semanticEmbedding);

    if (sim < 0.6) continue;  // 🔥 filter irrelevant semantic memory

    collected.push({
      type: "semantic",
      value: `${subject} → ${f.key}: ${f.value}`,
      importance: f.confidence ?? 0.7,
      confidence: sim,
      timestamp: null
    });
  }
}

  /* ===== EPISODIC ===== */

  let episodes = [];

  const dateRange = resolveDateRange(text);
  if (dateRange) {
    episodes = episodicMemory.getByDateRange(
      dateRange.start.getTime(),
      dateRange.end.getTime()
    );
    if (!episodes.length) {
      return { recallStrength: 0, relevantMemory: [] };
    }
  } else {
    episodes = episodicMemory.getBySubject("user", 18);
  }

  for (const e of episodes) {

    if (
      !e ||
      e.type !== "conversation" ||
      typeof e.value !== "string" ||
      e.value.length < 10
    ) continue;

    const episodeEmbedding = await embedText(e.value);
    if (!episodeEmbedding) continue;

    const sim = cosine(embedding, episodeEmbedding);
    if (sim < EPISODIC_SIM_THRESHOLD) continue;

    collected.push({
      type: "episodic",
      value: e.value,
      importance: e.importance ?? 0.6,
      confidence: sim,
      timestamp: e.timestamp
    });
  }

  /* ===== REFLECTION ===== */

  const reflections = reflectionMemory.getBySubject("user") || [];

  for (const r of reflections) {
    collected.push({
      type: "reflection",
      value: r.insight,
      importance: r.confidence ?? 0.7,
      confidence: r.confidence ?? 0.7,
      timestamp: r.createdAt
    });
  }

  /* ===== VECTOR ===== */

  const vectors = searchVectors(embedding, {
    subject: "user",
    limit: 8,
    minScore: VECTOR_THRESHOLD
  });

  for (const v of vectors) {
    collected.push({
      type: "vector",
      value: v.text,
      importance: v.importance ?? 0.6,
      confidence: v.score ?? 0.7,
      timestamp: v.timestamp
    });
  }

  /* ===== DEDUP ===== */

  const seen = new Set();
  const unique = [];

  for (const item of collected) {
    const key = normalize(item.value);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  /* ===== RANK ===== */

  const ranked = unique
    .map(item => ({
      ...item,
      _score: scoreItem(item)
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_RESULTS);

  const recallStrength = ranked.length
    ? Math.min(1, ranked[0]._score)
    : 0;

  return {
    recallStrength,
    relevantMemory: ranked
  };
}

module.exports = {
  processMemoryQuery
};