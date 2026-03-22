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

// Subjects that are "self" (use pronoun-based detection, need sim gate)
const SELF_SUBJECTS = new Set(["user", "arvsal", "assistant"]);

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
  if (!timestamp) return 0.3; // 🔧 was 0.6 — null-ts items no longer outrank fresh episodic
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

  const semanticPromises = subjects.flatMap(subject => {
    const facts = memory.summarize(subject) || [];

    // 🔧 If the subject is explicitly named (not self/pronoun), skip the similarity
    // gate entirely — the user asking about X means ALL facts about X are relevant.
    const isNamedThird = !SELF_SUBJECTS.has(subject);

    return facts.map(async f => {
      if (isNamedThird) {
        // Named subject: return all facts unconditionally
        return {
          type: "semantic",
          value: `${subject} → ${f.key}: ${f.value}`,
          importance: f.confidence ?? 0.8,
          confidence: 0.9,   // treat named-subject facts as high confidence
          timestamp: null
        };
      }

      // Self subjects (user / arvsal): still apply similarity gate
      const semanticEmbedding = await embedText(`${f.key} ${f.value}`);
      if (!semanticEmbedding) return null;

      const sim = cosine(embedding, semanticEmbedding);
      if (sim < 0.6) return null;

      return {
        type: "semantic",
        value: `${subject} → ${f.key}: ${f.value}`,
        importance: f.confidence ?? 0.7,
        confidence: sim,
        timestamp: null
      };
    });
  });

  const semanticResults = await Promise.all(semanticPromises);
  semanticResults.forEach(res => {
    if (res) collected.push(res);
  });

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
    // Fetch episodes for 'user' always
    const userEps = episodicMemory.getBySubject("user", 12);
    episodes = [...userEps];

    // Also fetch episodes for any explicitly named third-party subject
    for (const s of subjects) {
      if (!SELF_SUBJECTS.has(s)) {
        const thirdEps = episodicMemory.getBySubject(s, 8);
        episodes.push(...thirdEps);
      }
    }
  }

  // Filter: only embed episodes with meaningful importance (avoids noise)
  const validEpisodes = episodes.filter(e =>
    e &&
    e.type === "conversation" &&
    typeof e.value === "string" &&
    e.value.length >= 10 &&
    (e.importance ?? 0) >= 0.45  // 🔧 importance floor — skip low-value noise
  );

  const episodicPromises = validEpisodes.map(async e => {
    const episodeEmbedding = await embedText(e.value);
    if (!episodeEmbedding) return null;

    const sim = cosine(embedding, episodeEmbedding);
    if (sim < EPISODIC_SIM_THRESHOLD) return null;

    return {
      type: "episodic",
      value: e.value,
      importance: e.importance ?? 0.6,
      confidence: sim,
      timestamp: e.timestamp
    };
  });

  const episodicResults = await Promise.all(episodicPromises);
  episodicResults.forEach(res => {
    if (res) collected.push(res);
  });

  /* ===== REFLECTION ===== */

  const reflections = reflectionMemory.getBySubject("user") || [];

  const reflectionPromises = reflections.map(async r => {
    // 🔧 Bug 2 fix: block 'general'-only reflections at engine level
    const keys = Array.isArray(r.relatedKeys) ? r.relatedKeys : [];
    const isGenericOnly =
      keys.length === 0 ||
      keys.every(k => !k || k.trim() === "general");
    if (isGenericOnly) return null;

    // 🔧 Bug 1 fix: similarity gate — only include relevant reflections
    const reflEmbedding = await embedText(r.insight);
    if (!reflEmbedding) return null;

    const sim = cosine(embedding, reflEmbedding);
    if (sim < EPISODIC_SIM_THRESHOLD) return null; // same 0.55 threshold

    return {
      type: "reflection",
      value: r.insight,
      importance: r.confidence ?? 0.7,
      confidence: sim,
      timestamp: r.createdAt
    };
  });

  const reflectionResults = await Promise.all(reflectionPromises);
  reflectionResults.forEach(res => {
    if (res) collected.push(res);
  });

  /* ===== VECTOR ===== */

  // Search vectors for all detected subjects (not just 'user')
  const vectorSubjects = subjects.length ? subjects : ["user"];
  for (const vs of vectorSubjects) {
    const vectors = searchVectors(embedding, {
      subject: vs,
      limit: 6,
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

/* ================= ACTION MEMORY ================= */

/**
 * Screen-action-tuned memory query.
 *
 * Differences from processMemoryQuery:
 * - Also extracts actionHints (concrete, usable facts for the action)
 * - Detects missingInfo (questions to ask user before acting)
 * - Scoped to action-relevant memory types
 *
 * @param {{ userInput: string, screenType: string }} opts
 * @returns {Promise<{
 *   relevantMemory: object[],
 *   actionHints: string[],
 *   missingInfo: string[]
 * }>}
 */
async function processActionMemory({ userInput, screenType = "unknown" }) {

  if (!userInput || typeof userInput !== "string") {
    return { relevantMemory: [], actionHints: [], missingInfo: [] };
  }

  let relevantMemory = [];
  let actionHints = [];
  let missingInfo = [];

  /* ===== Run standard cognitive query ===== */
  try {
    const cognitive = await processMemoryQuery({ text: userInput });
    relevantMemory = cognitive.relevantMemory || [];
  } catch {
    relevantMemory = [];
  }

  /* ===== Extract action hints from memory ===== */
  for (const item of relevantMemory) {
    const val = (item.value || "").toLowerCase();

    // Contact-related hints
    if (
      val.includes("contact") ||
      val.includes("phone") ||
      val.includes("number") ||
      val.includes("whatsapp") ||
      val.includes("email") ||
      val.includes("name")
    ) {
      actionHints.push(item.value);
    }

    // Preference hints
    if (val.includes("prefer") || val.includes("usually") || val.includes("always")) {
      actionHints.push(item.value);
    }
  }

  /* ===== Detect missing info based on userInput + screenType ===== */
  const lower = userInput.toLowerCase();

  // "send a message to him/her/them" — no named recipient
  if (
    screenType === "whatsapp" &&
    /send (a )?message to (him|her|them|it)\b/i.test(lower) &&
    !hasNamedTarget(lower, relevantMemory)
  ) {
    missingInfo.push("Who should I send the message to? Please tell me the contact name.");
  }

  // "type my password" — never pull passwords from memory for security
  if (/password|passcode|pin\b/i.test(lower)) {
    missingInfo.push("What's the password or PIN you'd like me to type? (I won't store this.)");
  }

  // "fill my details" — check if we have the needed info
  if (/fill (my )?(details|info|information|form)/i.test(lower)) {
    const hasName = relevantMemory.some(m => /\bname\b/i.test(m.value));
    if (!hasName) {
      missingInfo.push("What details should I fill? I don't have your name or info stored yet. You can say 'remember my name is...'");
    }
  }

  return {
    relevantMemory,
    actionHints: [...new Set(actionHints)].slice(0, 6),
    missingInfo
  };
}

/* ================= HELPERS ================= */

function hasNamedTarget(lower, memory) {
  // Check if the input contains a proper name or if memory has contact info
  const hasProperNoun = /\b[A-Z][a-z]+\b/.test(lower);
  if (hasProperNoun) return true;

  const hasContactMemory = memory.some(m =>
    /(contact|name|phone|whatsapp)/i.test(m.value)
  );
  return hasContactMemory;
}

/* ================= EXPORT ================= */

module.exports = {
  processMemoryQuery,
  processActionMemory
};