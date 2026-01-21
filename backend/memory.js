/**
 * Semantic Memory (Facts)
 *
 * Deterministic, audit-safe
 * NO episodic storage here
 */

const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(__dirname, "memory.json");

/* ================= LOAD ================= */

let memory = { facts: {} };

if (fs.existsSync(MEMORY_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    if (loaded && typeof loaded === "object") {
      memory.facts = loaded.facts || {};
    }
  } catch {
    memory = { facts: {} };
    save();
  }
}

function save() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

/* ================= CONSTANTS ================= */

const CONFIDENCE_FLOOR = 0.15;

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
      fact.confidence = Math.max(
        CONFIDENCE_FLOOR,
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
    confidence,
    source,
    category,
    protected: category === "identity" || category === "relationship",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastAccessedAt: now,
    lastDecayAt: now
  };

  save();
}

/* ================= RECALL ================= */

function recall(subject, key) {
  if (!subject || !key) return null;

  subject = subject.toLowerCase();
  key = normalizeKey(key);

  const fact = memory.facts?.[subject]?.[key];
  if (!fact) return null;

  fact.lastAccessedAt = Date.now();
  save();

  return { ...fact };
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

  if (fact.protected && !force) {
    return false;
  }

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













// const fs = require("fs");
// const path = require("path");

// const MEMORY_FILE = path.join(__dirname, "memory.json");

// /* ================= DEFAULT STRUCTURE ================= */

// let memory = {
//   facts: {},      // { subject: { key: factObject } }
//   episodes: []
// };

// /* ================= LOAD MEMORY ================= */

// if (fs.existsSync(MEMORY_FILE)) {
//   try {
//     const loaded = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
//     if (loaded && typeof loaded === "object") {
//       memory.facts = loaded.facts || {};
//       memory.episodes = Array.isArray(loaded.episodes) ? loaded.episodes : [];
//     }
//   } catch {
//     memory = { facts: {}, episodes: [] };
//     save();
//   }
// }

// function save() {
//   fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
// }

// /* ================= CONSTANTS ================= */

// const CONFIDENCE_FLOOR = 0.15;

// const FORBIDDEN_KEYS = new Set([
//   "time", "date", "current time", "current date", "query", "search"
// ]);

// function normalizeKeyForCheck(key) {
//   return key.toLowerCase().replace(/[_-]/g, " ").trim();
// }

// function isGarbageKey(key) {
//   const k = normalizeKeyForCheck(key);
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
//   key = key.toLowerCase().trim();
//   value = String(value).trim();

//   if (isGarbageKey(key)) return;

//   if (!memory.facts[subject]) {
//     memory.facts[subject] = {};
//   }

//   const now = Date.now();

//   memory.facts[subject][key] = {
//     value,
//     confidence,
//     source,
//     category,
//     protected: category === "identity",
//     createdAt: memory.facts[subject][key]?.createdAt || now,
//     updatedAt: now,
//     lastAccessedAt: now,
//     lastDecayAt: now
//   };

//   save();
// }

// /* ================= RECALL ================= */

// function recall(subject, key) {
//   if (!subject || !key) return null;

//   decayConfidence();

//   subject = subject.toLowerCase();
//   key = key.toLowerCase();

//   const fact = memory.facts?.[subject]?.[key];
//   if (!fact) return null;

//   fact.lastAccessedAt = Date.now();
//   save();

//   return { ...fact };
// }

// /* ================= SUMMARY ================= */

// function summarize(subject, options = {}) {
//   if (!subject) return [];

//   decayConfidence();
//   subject = subject.toLowerCase();

//   const facts = memory.facts?.[subject];
//   if (!facts) return [];

//   return Object.entries(facts)
//     .map(([key, data]) => ({ key, ...data }))
//     .filter(f => {
//       if (options.minConfidence) return f.confidence >= options.minConfidence;
//       return true;
//     })
//     .sort((a, b) => b.updatedAt - a.updatedAt);
// }

// /* ================= FORGET ================= */

// function forgetFact(subject, key) {
//   if (!subject || !key) return false;

//   subject = subject.toLowerCase();
//   key = key.toLowerCase();

//   const fact = memory.facts?.[subject]?.[key];
//   if (!fact) return false;

//   delete memory.facts[subject][key];

//   if (Object.keys(memory.facts[subject]).length === 0) {
//     delete memory.facts[subject];
//   }

//   save();
//   return true;
// }

// function forgetSubject(subject) {
//   if (!subject) return false;
//   subject = subject.toLowerCase();

//   if (!memory.facts[subject]) return false;

//   delete memory.facts[subject];
//   save();
//   return true;
// }

// function forgetAll() {
//   memory.facts = {};
//   memory.episodes = [];
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






















// const fs = require("fs");
// const path = require("path");

// const MEMORY_FILE = path.join(__dirname, "memory.json");

// /* ================= DEFAULT STRUCTURE ================= */

// let memory = {
//   facts: {},      // { subject: { key: factObject } }
//   episodes: []    // reserved for future compatibility
// };

// /* ================= LOAD MEMORY SAFELY ================= */

// if (fs.existsSync(MEMORY_FILE)) {
//   try {
//     const loaded = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
//     if (loaded && typeof loaded === "object") {
//       memory.facts = loaded.facts || {};
//       memory.episodes = Array.isArray(loaded.episodes) ? loaded.episodes : [];
//     }
//   } catch {
//     memory = { facts: {}, episodes: [] };
//     save();
//   }
// }

// function save() {
//   fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
// }

// /* ================= INTERNAL GUARDS ================= */

// const PERMANENT_CATEGORIES = new Set([
//   "identity",
//   "relationship",
//   "system"
// ]);

// const FORBIDDEN_KEYS = new Set([
//   "time",
//   "current time",
//   "currenttime",
//   "date",
//   "currentdate",
//   "query",
//   "search"
// ]);

// const CONFIDENCE_FLOOR = 0.15; // memory never fully vanishes

// function normalizeKeyForCheck(key) {
//   return key
//     .toLowerCase()
//     .replace(/[_-]/g, " ")
//     .trim();
// }

// function isGarbageKey(key) {
//   const k = normalizeKeyForCheck(key);
//   return (
//     !k ||
//     k.length < 3 ||
//     FORBIDDEN_KEYS.has(k) ||
//     /^(thing|something|stuff|info|detail)$/i.test(k)
//   );
// }

// /* ================= CORE FACT MEMORY ================= */

// function remember({
//   subject,
//   key,
//   value,
//   confidence = 1,
//   source = "explicit",
//   category = "general",
//   expiresAt = null,
//   importance = 0.5
// }) {
//   if (!subject || !key || value === undefined || value === null) return;

//   subject = subject.toLowerCase().trim();
//   key = key.toLowerCase().trim();
//   value = String(value).trim();

//   if (!subject || !key || !value) return;
//   if (isGarbageKey(key)) return;

//   // ❌ Never store questions or blobs
//   if (/\?$/.test(value)) return;
//   if (value.length > 200) return;
//   if (value.split(" ").length > 40) return;

//   if (!memory.facts[subject]) {
//     memory.facts[subject] = {};
//   }

//   const existing = memory.facts[subject][key];
//   const now = Date.now();

//   // 🔒 Protect strong explicit memory
//   if (
//     existing &&
//     existing.source === "explicit" &&
//     existing.confidence >= 0.9 &&
//     source !== "explicit"
//   ) {
//     return;
//   }

//   // 🔐 Permanent categories never expire
//   if (PERMANENT_CATEGORIES.has(category)) {
//     expiresAt = null;
//   }

//   // ⏳ Auto-expiry for weak inferred memory
//   if (!expiresAt && source !== "explicit" && !PERMANENT_CATEGORIES.has(category)) {
//     expiresAt = now + 7 * 24 * 60 * 60 * 1000;
//   }

//   memory.facts[subject][key] = {
//     value,
//     confidence,
//     source,
//     category,
//     importance,
//     createdAt: existing?.createdAt || now,
//     updatedAt: now,
//     lastAccessedAt: now,
//     lastDecayAt: now,
//     expiresAt
//   };

//   save();
// }

// /* ================= 🧠 CONFIDENCE DECAY ================= */

// function decayConfidence() {
//   const now = Date.now();

//   for (const subject in memory.facts) {
//     for (const key in memory.facts[subject]) {
//       const fact = memory.facts[subject][key];

//       const last = fact.lastDecayAt || fact.updatedAt;
//       const elapsed = now - last;
//       if (elapsed <= 0) continue;

//       // Base decay rate (per day)
//       let rate = 0.015;

//       // Source sensitivity
//       if (fact.source === "explicit") rate *= 0.3;
//       if (fact.source === "inferred") rate *= 2.5;

//       // Category protection
//       if (PERMANENT_CATEGORIES.has(fact.category)) rate *= 0.2;

//       // Importance slows decay
//       rate *= (1 - Math.min(fact.importance, 0.9));

//       const days = elapsed / (1000 * 60 * 60 * 24);
//       const decay = days * rate;

//       fact.confidence = Math.max(
//         CONFIDENCE_FLOOR,
//         fact.confidence - decay
//       );

//       fact.lastDecayAt = now;
//     }
//   }

//   save();
// }

// /* ================= READ ================= */

// function recall(subject, key) {
//   if (!subject || !key) return null;

//   subject = subject.toLowerCase();
//   key = key.toLowerCase();

//   const fact = memory.facts?.[subject]?.[key];
//   if (!fact) return null;

//   if (fact.expiresAt && Date.now() > fact.expiresAt) {
//     delete memory.facts[subject][key];
//     save();
//     return null;
//   }

//   // 🔁 Reinforce on recall
//   fact.confidence = Math.min(1, fact.confidence + 0.02);
//   fact.lastAccessedAt = Date.now();

//   save();
//   return fact;
// }

// function exists(subject, key) {
//   return Boolean(recall(subject, key));
// }

// /* ================= SUMMARY ================= */

// function summarize(subject, options = {}) {
//   if (!subject) return [];

//   subject = subject.toLowerCase();
//   const facts = memory.facts?.[subject];
//   if (!facts) return [];

//   return Object.entries(facts)
//     .map(([key, data]) => ({
//       key,
//       value: data.value,
//       confidence: data.confidence,
//       source: data.source,
//       category: data.category,
//       importance: data.importance,
//       createdAt: data.createdAt,
//       updatedAt: data.updatedAt
//     }))
//     .filter(f => {
//       if (options.category) return f.category === options.category;
//       if (options.minConfidence) return f.confidence >= options.minConfidence;
//       return true;
//     })
//     .sort((a, b) => b.updatedAt - a.updatedAt);
// }

// /* ================= FORGET ================= */

// function forgetFact(subject, key, { force = false } = {}) {
//   if (!subject || !key) return false;

//   subject = subject.toLowerCase();
//   key = key.toLowerCase();

//   const fact = memory.facts?.[subject]?.[key];
//   if (!fact) return false;

//   if (PERMANENT_CATEGORIES.has(fact.category) && !force) return false;

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
//   const facts = memory.facts[subject];
//   if (!facts) return false;

//   for (const key of Object.keys(facts)) {
//     const fact = facts[key];
//     if (PERMANENT_CATEGORIES.has(fact.category) && !force) continue;
//     delete facts[key];
//   }

//   if (Object.keys(facts).length === 0) {
//     delete memory.facts[subject];
//   }

//   save();
//   return true;
// }

// function forgetAll({ force = false } = {}) {
//   if (force) {
//     memory.facts = {};
//     memory.episodes = [];
//   } else {
//     for (const subject in memory.facts) {
//       forgetSubject(subject);
//     }
//   }

//   save();
//   return true;
// }

// /* ================= EXPORTS ================= */

// module.exports = {
//   remember,
//   recall,
//   exists,
//   summarize,
//   recent: (subject, limit = 5) => summarize(subject).slice(0, limit),

//   forgetFact,
//   forgetSubject,
//   forgetAll,

//   decayConfidence
// };





