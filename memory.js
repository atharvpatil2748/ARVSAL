/**
 * Semantic Memory (Facts)
 *
 * Deterministic, audit-safe
 * NO episodic storage here
 */

const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(__dirname, "memory.json");

/* ================= INTERNAL STATE ================= */

let memory = { facts: {} };

/* ================= SAFE SAVE ================= */

function save() {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch {
    // absolute fail-safe
  }
}

/* ================= LOAD ================= */

(function load() {
  if (!fs.existsSync(MEMORY_FILE)) {
    save();
    return;
  }

  try {
    const loaded = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    if (loaded && typeof loaded === "object" && loaded.facts) {
      memory.facts = loaded.facts;
    }
  } catch {
    memory = { facts: {} };
    save();
  }
})();

/* ================= CONSTANTS ================= */

const CONFIDENCE_FLOOR = 0.15;
const CONFIDENCE_CEILING = 1.0;

const FORBIDDEN_KEYS = new Set([
  "time",
  "date",
  "current time",
  "current date",
  "query",
  "search",
  "it",
  "this",
  "that"
]);

/* ================= NORMALIZATION ================= */

function normalizeKey(key) {
  return key
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGarbageKey(key) {
  const k = normalizeKey(key);
  return !k || k.length < 2 || FORBIDDEN_KEYS.has(k);
}

function clampConfidence(v) {
  if (typeof v !== "number") return 1;
  if (v > CONFIDENCE_CEILING) return CONFIDENCE_CEILING;
  if (v < CONFIDENCE_FLOOR) return CONFIDENCE_FLOOR;
  return v;
}

/* ================= CONFIDENCE DECAY ================= */

function decayConfidence() {
  const now = Date.now();

  for (const subject in memory.facts) {
    for (const key in memory.facts[subject]) {
      const fact = memory.facts[subject][key];
      if (fact.protected) continue;

      const last = fact.lastDecayAt || fact.updatedAt;
      const elapsed = now - last;
      if (elapsed <= 0) continue;

      let rate = 0.015;
      if (fact.source === "explicit") rate *= 0.3;

      const days = elapsed / (1000 * 60 * 60 * 24);
      fact.confidence = clampConfidence(
        fact.confidence - days * rate
      );

      fact.lastDecayAt = now;
    }
  }

  save();
}

/* ================= REMEMBER ================= */

function remember({
  subject,
  key,
  value,
  confidence = 1,
  source = "explicit",
  category = "general"
}) {
  if (!subject || !key || value == null) return;

  subject = subject.toLowerCase().trim();
  key = normalizeKey(key);
  value = String(value).trim();

  if (isGarbageKey(key)) return;

  if (!memory.facts[subject]) {
    memory.facts[subject] = {};
  }

  const now = Date.now();
  const existing = memory.facts[subject][key];

  memory.facts[subject][key] = {
    value,
    confidence: clampConfidence(confidence),
    source,
    category,
    protected: category === "identity" || category === "relationship",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastAccessedAt: existing?.lastAccessedAt || now,
    lastDecayAt: existing?.lastDecayAt || now
  };


  /* ===== VECTOR RAG INDEX (SEMANTIC FACT) ===== */

const { embedText } = require("./embeddingModel");
const { addVector } = require("./vectorStore");

embedText(`${subject} ${key} is ${value}`).then(embedding => {
  if (embedding) {
    addVector({
      embedding,
      text: `${subject} ${key} is ${value}`,
      subject,
      importance: 1,
      timestamp: now
    });
  }
});

  save();
}

/* ================= RECALL (NON-DESTRUCTIVE) ================= */

function recall(subject, key) {
  if (!subject || !key) return null;

  subject = subject.toLowerCase();
  key = normalizeKey(key);

  const fact = memory.facts?.[subject]?.[key];
  if (!fact) return null;

  // 🧠 IMPORTANT FIX:
  // Recall must NOT alter semantic dominance
  // Only access metadata is updated
  fact.lastAccessedAt = Date.now();

  save();

  return {
    value: fact.value,
    confidence: fact.confidence,
    source: fact.source,
    category: fact.category,
    updatedAt: fact.updatedAt
  };
}

/* ================= SUMMARY ================= */

function summarize(subject, { minConfidence = 0 } = {}) {
  if (!subject) return [];

  subject = subject.toLowerCase();
  const facts = memory.facts?.[subject];
  if (!facts) return [];

  return Object.entries(facts)
    .map(([key, data]) => ({ key, ...data }))
    .filter(f => f.confidence >= minConfidence)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ================= FORGET ================= */

function forgetFact(subject, key, { force = false } = {}) {
  if (!subject || !key) return false;

  subject = subject.toLowerCase();
  key = normalizeKey(key);

  const fact = memory.facts?.[subject]?.[key];
  if (!fact) return false;

  if (fact.protected && !force) return false;

  delete memory.facts[subject][key];

  if (Object.keys(memory.facts[subject]).length === 0) {
    delete memory.facts[subject];
  }

  save();
  return true;
}

function forgetSubject(subject, { force = false } = {}) {
  if (!subject) return false;

  subject = subject.toLowerCase();
  if (!memory.facts[subject]) return false;

  if (!force) {
    for (const key in memory.facts[subject]) {
      if (memory.facts[subject][key].protected) {
        return false;
      }
    }
  }

  delete memory.facts[subject];
  save();
  return true;
}

function forgetAll() {
  memory.facts = {};
  save();
  return true;
}

/* ================= EXPORTS ================= */

module.exports = {
  remember,
  recall,
  summarize,
  forgetFact,
  forgetSubject,
  forgetAll,
  decayConfidence
};














// /**
//  * Semantic Memory (Facts)
//  *
//  * Deterministic, audit-safe
//  * NO episodic storage here
//  */

// const fs = require("fs");
// const path = require("path");

// const MEMORY_FILE = path.join(__dirname, "memory.json");

// /* ================= LOAD ================= */

// let memory = { facts: {} };

// if (fs.existsSync(MEMORY_FILE)) {
//   try {
//     const loaded = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
//     if (loaded && typeof loaded === "object") {
//       memory.facts = loaded.facts || {};
//     }
//   } catch {
//     memory = { facts: {} };
//     save();
//   }
// }

// function save() {
//   fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
// }

// /* ================= CONSTANTS ================= */

// const CONFIDENCE_FLOOR = 0.15;

// const FORBIDDEN_KEYS = new Set([
//   "time",
//   "date",
//   "current time",
//   "current date",
//   "query",
//   "search",
//   "it",
//   "this",
//   "that"
// ]);

// function normalizeKey(key) {
//   return key
//     .toLowerCase()
//     .replace(/[_-]/g, " ")
//     .replace(/\s+/g, " ")
//     .trim();
// }

// function isGarbageKey(key) {
//   const k = normalizeKey(key);
//   return !k || k.length < 2 || FORBIDDEN_KEYS.has(k);
// }

// /* ================= CONFIDENCE DECAY ================= */

// function decayConfidence() {
//   const now = Date.now();

//   for (const subject in memory.facts) {
//     for (const key in memory.facts[subject]) {
//       const fact = memory.facts[subject][key];
//       if (fact.protected) continue;

//       const last = fact.lastDecayAt || fact.updatedAt;
//       const elapsed = now - last;
//       if (elapsed <= 0) continue;

//       let rate = 0.015;
//       if (fact.source === "explicit") rate *= 0.3;

//       const days = elapsed / (1000 * 60 * 60 * 24);
//       fact.confidence = Math.max(
//         CONFIDENCE_FLOOR,
//         fact.confidence - days * rate
//       );

//       fact.lastDecayAt = now;
//     }
//   }

//   save();
// }

// /* ================= REMEMBER ================= */

// function remember({
//   subject,
//   key,
//   value,
//   confidence = 1,
//   source = "explicit",
//   category = "general"
// }) {
//   if (!subject || !key || value == null) return;

//   subject = subject.toLowerCase().trim();
//   key = normalizeKey(key);
//   value = String(value).trim();

//   if (isGarbageKey(key)) return;

//   if (!memory.facts[subject]) {
//     memory.facts[subject] = {};
//   }

//   const now = Date.now();
//   const existing = memory.facts[subject][key];

//   memory.facts[subject][key] = {
//     value,
//     confidence,
//     source,
//     category,
//     protected: category === "identity" || category === "relationship",
//     createdAt: existing?.createdAt || now,
//     updatedAt: now,
//     lastAccessedAt: now,
//     lastDecayAt: now
//   };

//   save();
// }

// /* ================= RECALL ================= */

// function recall(subject, key) {
//   if (!subject || !key) return null;

//   subject = subject.toLowerCase();
//   key = normalizeKey(key);

//   const fact = memory.facts?.[subject]?.[key];
//   if (!fact) return null;

//   fact.lastAccessedAt = Date.now();
//   save();

//   return { ...fact };
// }

// /* ================= SUMMARY ================= */

// function summarize(subject, { minConfidence = 0 } = {}) {
//   if (!subject) return [];

//   subject = subject.toLowerCase();
//   const facts = memory.facts?.[subject];
//   if (!facts) return [];

//   return Object.entries(facts)
//     .map(([key, data]) => ({ key, ...data }))
//     .filter(f => f.confidence >= minConfidence)
//     .sort((a, b) => b.updatedAt - a.updatedAt);
// }

// /* ================= FORGET ================= */

// function forgetFact(subject, key, { force = false } = {}) {
//   if (!subject || !key) return false;

//   subject = subject.toLowerCase();
//   key = normalizeKey(key);

//   const fact = memory.facts?.[subject]?.[key];
//   if (!fact) return false;

//   if (fact.protected && !force) {
//     return false;
//   }

//   delete memory.facts[subject][key];

//   if (Object.keys(memory.facts[subject]).length === 0) {
//     delete memory.facts[subject];
//   }

//   save();
//   return true;
// }

// function forgetSubject(subject, { force = false } = {}) {
//   if (!subject) return false;

//   subject = subject.toLowerCase();
//   if (!memory.facts[subject]) return false;

//   if (!force) {
//     for (const key in memory.facts[subject]) {
//       if (memory.facts[subject][key].protected) {
//         return false;
//       }
//     }
//   }

//   delete memory.facts[subject];
//   save();
//   return true;
// }

// function forgetAll() {
//   memory.facts = {};
//   save();
//   return true;
// }

// /* ================= EXPORTS ================= */

// module.exports = {
//   remember,
//   recall,
//   summarize,
//   forgetFact,
//   forgetSubject,
//   forgetAll,
//   decayConfidence
// };







