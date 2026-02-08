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
const { embedText } = require("./embeddingModel");
const { addVector } = require("./vectorStore");

/* ================= UTIL ================= */

function formatDateTime(ts) {
  if (!ts) return "an unknown time";
  const d = new Date(ts);
  return `${d.toDateString()} at ${d.toLocaleTimeString()}`;
}

/* ================= SUBJECT ================= */

function resolveSubject(text = "") {
  const lower = text.toLowerCase();

  if (/\bmy\b/.test(lower)) return { subject: "user" };
  if (/\byour\b/.test(lower)) return { subject: "arvsal" };

  const known = lower.match(
    /\b(sejal|sahil|omkar|vandana|krishnath|vardhan|parth|pratham)\b/
  );
  if (known) return { subject: known[1] };

  return { subject: "user" };
}

/* ================= KEY ================= */

function cleanKey(rawKey, subject) {
  if (!rawKey) return null;

  rawKey = rawKey.toLowerCase().trim();

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

      try {
        const embedding = await embedText(`${key}: ${value}`);
        if (Array.isArray(embedding)) {
          addVector({
            text: `${key}: ${value}`,
            subject,
            importance: 1,
            embedding
          });
        }
      } catch {}

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
      const fact = memory.recall(subject, key);

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
      if (fact) {
        setContext({ subject, key });
        return phraseFromConfidence(fact, subject, key);
      }

      /* ---------- ⛔ META QUERIES MUST NOT USE VECTOR ---------- */
      if (intentObj.meta === true) {
        return "I don’t have a reliable memory of when this was mentioned.";
      }

      /* ---------- VECTOR FALLBACK (MEANING-BASED) ---------- */
      const vectorQuery =
        key && subject
          ? `${subject} ${key}`
          : intentObj.rawText;

      const vectorResults = await recallByMeaning(
        vectorQuery,
        subject
      );

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
      const range = resolveDateRange(intentObj.rawText || "today");
      if (!range || !range.start || !range.end) {
        return "I couldn't determine the time range you're asking about.";
      }
      const entries = episodicMemory.getByDateRange(
        range.start.getTime(),
        range.end.getTime()
      );

      return entries.length
        ? entries.map(e => `• ${e.value}`).join("\n")
        : "I don’t have anything stored for that time.";
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


















// const memory = require("./memory");
// const episodicMemory = require("./episodicMemory");
// const normalizeKey = require("./keyNormalizer");
// const { exec } = require("child_process");
// const { setContext, getContext, clearContext } = require("./contextMemory");
// const { introduceSelf } = require("./identity");
// const { resolveDateRange } = require("./dateResolver");

// /* ================= UTIL ================= */

// function formatDateTime(ts) {
//   if (!ts) return "an unknown time";
//   const d = new Date(ts);
//   return `${d.toDateString()} at ${d.toLocaleTimeString()}`;
// }

// /* ================= SUBJECT ================= */

// function resolveSubject(text = "") {
//   text = text.toLowerCase();

//   if (/\bmy\b/.test(text)) return { subject: "user" };
//   if (/\byour\b/.test(text)) return { subject: "arvsal" };

//   const known = text.match(
//     /\b(sejal|sahil|omkar|vandana|krishnath|vardhan|parth|pratham)\b/
//   );
//   if (known) return { subject: known[1] };

//   const match = text.match(/^([a-z][a-z\s]{1,20})\s+is\s+/i);
//   if (match) {
//     const candidate = match[1].trim();
//     const forbidden = new Set([
//       "this", "that", "he", "she", "they",
//       "friend", "person", "someone", "anyone"
//     ]);
//     if (!forbidden.has(candidate)) {
//       return { subject: candidate };
//     }
//   }

//   return { subject: "user" };
// }

// /* ================= KEY ================= */

// function cleanKey(rawKey, subject) {
//   if (!rawKey) return null;

//   rawKey = rawKey.toLowerCase().trim();

//   if (rawKey === subject) return "relationship";
//   if (rawKey === "identity") return "identity";

//   let key = normalizeKey(rawKey);
//   if (!key) return null;

//   key = key
//     .replace(new RegExp(`^${subject}\\s+`, "i"), "")
//     .replace(new RegExp(`^${subject}'?s\\s+`, "i"), "")
//     .trim();

//   return key || null;
// }

// /* ================= RESPONSE ================= */

// function formatResponse(subject, key, value) {
//   if (key === "relationship") return `${subject} is ${value}.`;
//   if (subject === "user") return `Your ${key} is ${value}.`;
//   if (subject === "arvsal") return `My ${key} is ${value}.`;
//   return `${subject}'s ${key} is ${value}.`;
// }

// /* ================= CONFIDENCE ================= */

// function phraseFromConfidence(fact, subject, key) {
//   if (fact.confidence >= 0.9) {
//     return formatResponse(subject, key, fact.value);
//   }
//   if (fact.confidence >= 0.75) {
//     return `You once told me that ${
//       subject === "user" ? "your" : subject + "'s"
//     } ${key} is ${fact.value}.`;
//   }
//   return `As far as I remember, ${
//     subject === "user" ? "your" : subject + "'s"
//   } ${key} is ${fact.value}.`;
// }

// /* ================= MAIN ================= */

// async function handleIntent(intentObj) {
//   if (!intentObj?.intent) return "I didn't understand that.";

//   switch (intentObj.intent) {

//     case "INTRODUCE_SELF":
//       return introduceSelf();

//     /* ===== REMEMBER ===== */
//     case "REMEMBER": {
//       const { subject } = resolveSubject(intentObj.rawText);
//       const key = cleanKey(intentObj.key, subject);
//       if (!key || !intentObj.value) return "What should I remember?";

//       let value = intentObj.value.trim();
//       value = value.replace(/^(my|your)\s+/i, "").trim();

//       memory.remember({
//         subject,
//         key,
//         value,
//         source: "explicit",
//         confidence: 1,
//         category: key === "identity" || key === "relationship"
//           ? "identity"
//           : "general"
//       });

//       episodicMemory.store({
//         type: "explicit_memory",
//         subject,
//         key,
//         value,
//         source: "user"
//       });

//       setContext({ subject, key, intent: "REMEMBER" });
//       return formatResponse(subject, key, value);
//     }

//     /* ===== RECALL ===== */
//     case "RECALL": {
//       let subject, key;
//       const isMeta = intentObj.meta === true;

//       if (intentObj.key === "it") {
//         const ctx = getContext({ use: !isMeta });
//         if (ctx) {
//           subject = ctx.subject;
//           key = ctx.key;
//         }
//       }

//       if (!subject) {
//         ({ subject } = resolveSubject(intentObj.rawText));
//         key = cleanKey(intentObj.key, subject);
//       }

//       if (!key) return "I’m not sure what you’re asking.";

//       const fact = memory.recall(subject, key);
//       if (!fact) return "I don't have this stored as memory.";

//       setContext({ subject, key, intent: "RECALL" });

//       const episode = episodicMemory.findLastExplicit(subject, key);

//       if (/how do you (know|remember)/i.test(intentObj.rawText)) {
//         return "You told me this directly, and I stored it as explicit memory.";
//       }

//       if (/when did i (tell|say)/i.test(intentObj.rawText)) {
//         return episode
//           ? `You told me this on ${formatDateTime(episode.timestamp)}.`
//           : "I don’t recall exactly when you told me this.";
//       }

//       return phraseFromConfidence(fact, subject, key);
//     }

//     /* ===== FORGET ===== */
//     case "FORGET": {
//       let subject, key;

//       if (intentObj.key === "it") {
//         const ctx = getContext({ use: false });
//         if (!ctx) return "I’m not sure what to forget.";
//         subject = ctx.subject;
//         key = ctx.key;
//       } else {
//         ({ subject } = resolveSubject(intentObj.rawText));
//         key = cleanKey(intentObj.key, subject);
//       }

//       if (!key) return "I’m not sure what to forget.";

//       const removed = memory.forgetFact(subject, key);
//       clearContext();

//       if (!removed) {
//         return `I don’t have ${
//           subject === "user" ? "your" : subject + "'s"
//         } ${key} stored as memory.`;
//       }

//       episodicMemory.store({
//         type: "forget",
//         subject,
//         key,
//         source: "user"
//       });

//       return `Alright. I’ve forgotten ${
//         subject === "user" ? "your" : subject + "'s"
//       } ${key}.`;
//     }

//     /* ===== DAY RECALL ===== */
//     case "DAY_RECALL": {
//       const range = resolveDateRange("today");
//       let entries = episodicMemory.getByDateRange(
//         range.start.getTime(),
//         range.end.getTime()
//       );

//       if (!entries.length) {
//         return "I don’t have anything stored from today.";
//       }

//       if (intentObj.mode === "user_only") {
//         entries = entries.filter(
//           e => e.type === "conversation" && e.source === "user"
//         );
//         return entries.length
//           ? "Today, you said:\n" + entries.map(e => `• ${e.value}`).join("\n")
//           : "You didn’t say much today.";
//       }

//       if (intentObj.mode === "memory") {
//         entries = entries.filter(e => e.type === "explicit_memory");
//         return entries.length
//           ? "Today, I remembered:\n" + entries.map(e => `• ${e.value}`).join("\n")
//           : "I didn’t store any explicit memory today.";
//       }

//       if (intentObj.mode === "summary") {
//         return "Today included conversations and memory interactions.";
//       }

//       entries = entries.filter(
//         e => e.type === "conversation" && e.source === "user"
//       );
//       return entries.length
//         ? "Today, we talked about:\n" + entries.map(e => `• ${e.value}`).join("\n")
//         : "I don’t have conversation records from today.";
//     }

//     /* ===== DATE-SPECIFIC ===== */
//     case "EPISODIC_BY_DATE": {
//       const range = resolveDateRange(intentObj.rawText);
//       if (!range) return "I couldn’t understand the date clearly.";

//       const entries = episodicMemory
//         .getByDateRange(range.start.getTime(), range.end.getTime())
//         .filter(e => e.type === "conversation" && e.source === "user");

//       return entries.length
//         ? `On ${range.start.toDateString()}, we talked about:\n` +
//             entries.map(e => `• ${e.value}`).join("\n")
//         : "I don’t have any conversation records stored for that day.";
//     }

//     /* ===== SUMMARY ===== */
//     case "MEMORY_SUMMARY": {
//       const { subject } = resolveSubject(intentObj.rawText);
//       const facts = memory.summarize(subject, { minConfidence: 0.6 });

//       if (!facts.length) {
//         return subject === "user"
//           ? "I don't remember anything about you yet."
//           : `I don't remember anything about ${subject} yet.`;
//       }

//       return facts.map(f => phraseFromConfidence(f, subject, f.key)).join(" ");
//     }

//     /* ===== LOCAL ===== */
//     case "LOCAL_SKILL":
//       if (intentObj.skill === "TIME")
//         return `The current time is ${new Date().toLocaleTimeString()}.`;
//       if (intentObj.skill === "DATE")
//         return `Today's date is ${new Date().toDateString()}.`;
//   }

//   return "I am still learning this.";
// }

// /* ================= SYSTEM ================= */

// function openApp(name) {
//   if (name === "chrome") exec("start chrome");
//   if (name === "vs code") exec("code");
//   if (name === "notepad") exec("notepad");
// }

// function openFolder(path) {
//   exec(`start "" "${path}"`);
// }

// module.exports = {
//   handleIntent,
//   resolveSubject,
//   openApp,
//   openFolder
// };










