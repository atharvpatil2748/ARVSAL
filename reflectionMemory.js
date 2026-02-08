/**
 * Reflection Memory
 *
 * Stores long-term abstracted insights about the user or subjects.
 *
 * NOT episodic memory
 * NOT chat history
 *
 * Deterministic & audit-safe.
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "reflection_memory.json");


/* ================= CONFIG ================= */

const MAX_REFLECTIONS = 200;
const MIN_CONFIDENCE = 0.1;
const MAX_CONFIDENCE = 1.0;


/* ================= LOAD / SAVE ================= */

let reflections = [];

function load() {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, JSON.stringify([]));
    }
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    reflections = Array.isArray(raw) ? raw : [];
  } catch {
    reflections = [];
  }
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(reflections, null, 2));
}

load();


/* ================= UTIL ================= */

function normalizeSubject(subject) {
  return String(subject || "user").toLowerCase().trim() || "user";
}

function normalizeInsight(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeys(keys = []) {
  if (!Array.isArray(keys)) return [];
  return [...new Set(
    keys
      .map(k => String(k).toLowerCase().trim())
      .filter(Boolean)
  )];
}

function clampConfidence(v) {
  if (typeof v !== "number" || isNaN(v)) return 0.7;
  return Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, v));
}

function now() {
  return Date.now();
}


/* ================= ADD REFLECTION ================= */

function addReflection({
  subject = "user",
  insight,
  confidence = 0.7,
  source = "system",
  relatedKeys = []
}) {
  if (!insight || typeof insight !== "string") return;

  subject = normalizeSubject(subject);
  const cleanInsight = insight.trim();
  const normInsight = normalizeInsight(cleanInsight);
  const cleanKeys = normalizeKeys(relatedKeys);
  const conf = clampConfidence(confidence);

  const existing = reflections.find(r =>
    r.subject === subject &&
    normalizeInsight(r.insight) === normInsight
  );

  if (existing) {
    // 🔒 Slow reinforcement (log-like)
    existing.confidence = clampConfidence(
      existing.confidence + (1 - existing.confidence) * 0.15
    );
    existing.lastUpdated = now();
    save();
    return;
  }

  const reflection = {
    id: `${now()}-${Math.random().toString(36).slice(2, 8)}`,
    subject,
    insight: cleanInsight,
    confidence: conf,
    relatedKeys: cleanKeys,
    source,
    createdAt: now(),
    lastUpdated: now()
  };


  /* ===== VECTOR RAG INDEX (REFLECTION) ===== */

const { embedText } = require("./embeddingModel");
const { addVector } = require("./vectorStore");

embedText(cleanInsight).then(embedding => {
  if (embedding) {
    addVector({
      embedding,
      text: cleanInsight,
      subject,
      importance: conf,
      timestamp: now()
    });
  }
});

  reflections.push(reflection);

  if (reflections.length > MAX_REFLECTIONS) {
    reflections = reflections.slice(-MAX_REFLECTIONS);
  }

  save();
}


/* ================= RETRIEVE ================= */

function getBySubject(subject, minConfidence = 0.6) {
  subject = normalizeSubject(subject);
  return reflections
    .filter(r => r.subject === subject && r.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

function getAll(minConfidence = 0.6) {
  return reflections
    .filter(r => r.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}


/* ================= FORGET ================= */

function forgetSubject(subject) {
  subject = normalizeSubject(subject);
  reflections = reflections.filter(r => r.subject !== subject);
  save();
}

function forgetAll() {
  reflections = [];
  save();
}


/* ================= EXPORT ================= */

module.exports = {
  addReflection,
  getBySubject,
  getAll,
  forgetSubject,
  forgetAll
};