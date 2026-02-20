/**
 * Actions Handler (RESTORED + STABILIZED)
 *
 * - Deterministic first
 * - Memory-safe
 * - Context-aware recall
 * - NO system execution
 * - LLM used ONLY when explicitly routed
 */

const memory = require("./memory");
const episodicMemory = require("./episodicMemory");
const normalizeKey = require("./keyNormalizer");

const { setContext, getContext, clearContext } = require("./contextMemory");
const { introduceSelf } = require("./identity");
const { resolveDateRange } = require("./dateResolver");
const { recallByMeaning } = require("./recallRouter");
const llmRouter = require("./llmRouter");


/* ================= UTIL ================= */

function formatDateTime(ts) {
  if (!ts) return "an unknown time";
  const d = new Date(ts);
  return `${d.toDateString()} at ${d.toLocaleTimeString()}`;
}

/* ================= SUBJECT ================= */

function resolveSubject(text = "") {
  const lower = text.toLowerCase();

  // 🔥 Alias correction layer (speech-safe)
  const NAME_ALIASES = {
    sajal: "sejal",
    sajol: "sejal",
    segal: "sejal",
    sahal: "sahil",
    omkar: "omkar",
    vandna: "vandana"
  };

  // Self references
  if (/\bmy\b/.test(lower)) return { subject: "user" };
  if (/\byour\b/.test(lower)) return { subject: "arvsal" };

  // Extract possible name token
  const nameMatch = lower.match(/\b[a-z]{3,}\b/g);
  if (nameMatch) {
    for (let token of nameMatch) {
      if (NAME_ALIASES[token]) {
        return { subject: NAME_ALIASES[token] };
      }

      // Direct known names
      if (["sejal","sahil","omkar","vandana","krishnath","vardhan","parth","pratham"].includes(token)) {
        return { subject: token };
      }
    }
  }

  return { subject: "user" };
}
/* ================= KEY ================= */

function cleanKey(rawKey, subject) {
  if (!rawKey) return null;

  rawKey = rawKey.toLowerCase().trim();

  // 🔥 Remove accidental "remember" prefix
  rawKey = rawKey.replace(/^remember\s+/, "");

  if (rawKey === "identity") return "identity";
  if (rawKey === subject) return "relationship";

  let key = normalizeKey(rawKey);
  if (!key) return null;

  key = key
    .replace(new RegExp(`^${subject}\\s+`, "i"), "")
    .replace(new RegExp(`^${subject}'?s\\s+`, "i"), "")
    .trim();

  return key || null;
}

/* ================= RESPONSE ================= */

function formatResponse(subject, key, value) {
  if (key === "relationship") return `${subject} is ${value}.`;
  if (subject === "user") return `Your ${key} is ${value}.`;
  if (subject === "arvsal") return `My ${key} is ${value}.`;
  return `${subject}'s ${key} is ${value}.`;
}

/* ================= CONFIDENCE ================= */

function phraseFromConfidence(fact, subject, key) {
  // 🔒 HARD GUARD
  if (!fact || typeof fact !== "object") {
    return "I don't have this stored as memory.";
  }

  if (typeof fact.confidence !== "number") {
    return "I don't have reliable information about that.";
  }

  if (fact.confidence >= 0.9) {
    return formatResponse(subject, key, fact.value);
  }

  if (fact.confidence >= 0.75) {
    return `You once told me that ${
      subject === "user" ? "your" : subject + "'s"
    } ${key} is ${fact.value}.`;
  }

  return `As far as I remember, ${
    subject === "user" ? "your" : subject + "'s"
  } ${key} is ${fact.value}.`;
}

async function summarizeEpisodes(entries) {

  if (!entries || !entries.length) {
    return "I don’t have anything stored for that period.";
  }

  const content = entries
    .filter(e => e.source === "user")
    .map(e => e.value)
    .join("\n");

  if (!content.trim()) {
    return "I don’t have meaningful conversation stored for that period.";
  }

  const summary = await llmRouter({
  intent: "EPISODIC_SUMMARY",
  text: content,
  modelOverride: "qwen2:7b"
});

  return summary || "I don’t have anything meaningful stored for that period.";
}

/* ================= MAIN ================= */

async function handleIntent(intentObj) {
  if (!intentObj?.intent) return "I didn't understand that.";

  switch (intentObj.intent) {

    /* ===== IDENTITY ===== */

    case "INTRODUCE_SELF":
      return introduceSelf();

    /* ===== MEMORY WRITE ===== */

    case "REMEMBER": {
      const { subject } = resolveSubject(intentObj.rawText);
      const key = cleanKey(intentObj.key, subject);
      if (!key || !intentObj.value) return "What should I remember?";

      const value = intentObj.value.trim();

      memory.remember({
        subject,
        key,
        value,
        source: "explicit",
        confidence: 1
      });

      episodicMemory.store({
        type: "explicit_memory",
        subject,
        key,
        value,
        source: "user"
      });

      setContext({ subject, key });
      return formatResponse(subject, key, value);
    }

    /* ===== MEMORY READ ===== */

    case "RECALL": {
      let subject, key;

      /* ---------- Context resolution ("it") ---------- */
      if (intentObj.key === "it") {
        const ctx = getContext();
        if (ctx) {
          subject = ctx.subject;
          key = ctx.key;
        }
      }

      /* ---------- Explicit key resolution ---------- */
      if (!key) {
        ({ subject } = resolveSubject(intentObj.rawText));
        key = cleanKey(intentObj.key, subject);
      }

      if (!key) {
        return "I’m not sure what you’re asking about.";
      }

      /* ---------- SEMANTIC MEMORY ---------- */
      let fact = memory.recall(subject, key);

      /* ---------- FUZZY KEY MATCH ---------- */
      if (!fact) {
        const allFacts = memory.summarize(subject);

        const normalizedKey = key.toLowerCase();

        const candidate = allFacts.find(f =>
          f.key.includes(normalizedKey) ||
          normalizedKey.includes(f.key)
        );

        if (candidate) {
          fact = candidate;
          key = candidate.key;
        }
      }

      /* ---------- META MEMORY (HOW / WHEN) ---------- */
      if (fact && intentObj.meta === true) {
        const episodes = episodicMemory.getBySubject(subject, 30);

        const explicitEpisode = episodes.find(
          e => e.type === "explicit_memory" && e.key === key
        );

        if (!explicitEpisode) {
          return "I don’t recall exactly when you told me this.";
        }

        if (/how do you (know|remember)/i.test(intentObj.rawText)) {
          return "You told me this directly, and I stored it as explicit memory.";
        }

        return `You told me this on ${formatDateTime(explicitEpisode.timestamp)}.`;
      }

      /* ---------- NORMAL SEMANTIC RECALL ---------- */
      if (fact && typeof fact.value === "string") {
        setContext({ subject, key });
        return phraseFromConfidence(fact, subject, key);
      }

      /* ---------- ⛔ META QUERIES MUST NOT USE VECTOR ---------- */
      if (intentObj.meta === true) {
        return "I don’t have a reliable memory of when this was mentioned.";
      }

      /* ---------- VECTOR FALLBACK (MEANING-BASED) ---------- */
      let vectorQuery = intentObj.rawText;

      if (key && subject) {
        vectorQuery = `${subject} ${key}`;
      } else if (key) {
        vectorQuery = key;
      }

      // 🔒 Only allow vector fallback if this was NOT a direct factual query
      const directKeyQuery =
        intentObj.rawText.toLowerCase().startsWith("what is my") ||
        intentObj.rawText.toLowerCase().startsWith("who is") ||
        intentObj.rawText.toLowerCase().startsWith("what is");

      let vectorResults = null;

      if (!directKeyQuery) {
        vectorResults = await recallByMeaning(
          vectorQuery,
          subject
        );
      }

      if (Array.isArray(vectorResults) && vectorResults.length) {
        // Loose context for follow-ups like "tell me more"
        setContext({
          subject,
          key: key || "memory"
        });

        return vectorResults
          .map(t => `• ${t}`)
          .join("\n");
      }

      return "I don't have this stored as memory.";
    }
        /* ===== FORGET ===== */

    case "FORGET": {
      let subject, key;

      // 1️⃣ Try CONTEXT first if user said "it / that"
      if (!intentObj.key || intentObj.key === "it" || intentObj.key === "that") {
        const ctx = getContext();
        if (ctx) {
          subject = ctx.subject;
          key = ctx.key;
        }
      }

      // 2️⃣ Fallback to parsing raw text
      if (!key) {
        ({ subject } = resolveSubject(intentObj.rawText));
        key = cleanKey(intentObj.key, subject);
      }

      if (!key) {
        return "I’m not sure what you want me to forget.";
      }

      const removed = memory.forgetFact(subject, key);

      clearContext();

      if (removed) {
        episodicMemory.store({
          type: "forget",
          subject,
          key,
          source: "user",
          importance: 0.8
        });

        return `Okay, I’ve forgotten ${subject === "user" ? "your" : subject + "'s"} ${key}.`;
      }

      return "I don't have that stored.";
    }

    /* ===== MEMORY SUMMARY ===== */

    case "MEMORY_SUMMARY": {
      const { subject } = resolveSubject(intentObj.rawText);
      const facts = memory.summarize(subject, { minConfidence: 0.6 });

      if (!facts.length) {
        return subject === "user"
          ? "I don't remember anything about you yet."
          : `I don't remember anything about ${subject} yet.`;
      }

      return facts.map(f =>
        phraseFromConfidence(f, subject, f.key)
      ).join(" ");
    }

    /* ===== DAY / EPISODIC ===== */

    case "DAY_RECALL":
    case "EPISODIC_RECALL":
    case "EPISODIC_BY_DATE": {
      const range = resolveDateRange(intentObj.rawText);

      if (!range || !range.start || !range.end) {
        return "I couldn't determine the time range you're asking about.";
      }

      const entries = episodicMemory.getByDateRange(
        range.start.getTime(),
        range.end.getTime()
      );

      return summarizeEpisodes(entries);
    }

    case "EPISODIC_RECALL": {
      const entries = episodicMemory.getRecent(50);
      return summarizeEpisodes(entries);
    }

    case "SESSION_RECALL": {
      const todaySession = episodicMemory.getRecent(200)
        .filter(e => e.sessionId === episodicMemory.SESSION_ID);

      return summarizeEpisodes(todaySession);
    }

    /* ===== LOCAL SKILLS ===== */

    case "LOCAL_SKILL":
      if (intentObj.skill === "TIME")
        return `The current time is ${new Date().toLocaleTimeString()}.`;

      if (intentObj.skill === "DATE")
        return `Today's date is ${new Date().toDateString()}.`;

      if (intentObj.skill === "WEATHER") {
        const { getWeather } = require("./localSkills");
        return await getWeather(intentObj.city);
      }

      if (intentObj.skill === "NEWS") {
        const { getNews } = require("./localSkills");
        return await getNews();
      }
  }

  return "I am still learning this.";
}

/* ================= EXPORT ================= */

module.exports = {
  handleIntent,
  resolveSubject
};











