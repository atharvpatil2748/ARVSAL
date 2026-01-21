/**
 * Normalizer
 * - Preserves original user text (for LLM & math & punctuation)
 * - Provides normalized text ONLY for intent detection
 * - Deterministic, memory-safe, backward-compatible
 */

function normalize(input) {
  if (!input || typeof input !== "string") {
    const empty = {
      rawText: "",
      normalizedText: "",
      normalizedSafe: true
    };

    // backward compatibility
    empty.toString = () => "";
    return empty;
  }

  const rawText = input.trim();

  /* =====================================================
     🔒 NORMALIZED VERSION (INTENT ONLY)
     - NEVER used directly for memory storage
     - Possessive handled explicitly to avoid ambiguity
  ===================================================== */

  const normalizedText = rawText
    .toLowerCase()

    // 🔒 remove possessive FIRST (critical for memory safety)
    .replace(/'s\b/g, "")

    // keep letters, numbers, math symbols, comparison, equals
    .replace(/[^a-z0-9+\-*/=().%^,<>\s]/g, " ")

    .replace(/\s+/g, " ")
    .trim();

  const result = {
    rawText,
    normalizedText,

    // 🔑 explicit marker: safe ONLY for intent detection
    normalizedSafe: true
  };

  /**
   * 🔁 BACKWARD COMPATIBILITY
   * Any code doing normalize(text).toLowerCase()
   * or treating normalize() as string will still work
   */
  result.toString = () => normalizedText;

  return result;
}

module.exports = normalize;















// /**
//  * Normalizer
//  * - Preserves original user text (for LLM & math & punctuation)
//  * - Provides normalized text ONLY for intent detection
//  * - Backward-compatible with existing code
//  */

// function normalize(input) {
//   if (!input || typeof input !== "string") {
//     const empty = {
//       rawText: "",
//       normalizedText: ""
//     };

//     // backward compatibility
//     empty.toString = () => "";
//     return empty;
//   }

//   const rawText = input.trim();

//   // 🔒 NORMALIZED VERSION (INTENT ONLY)
//   const normalizedText = rawText
//     .toLowerCase()
//     // keep letters, numbers, math symbols, comparison, equals
//     .replace(/[^a-z0-9+\-*/=().%^,<>\s]/g, " ")
//     .replace(/\s+/g, " ")
//     .trim();

//   const result = {
//     rawText,
//     normalizedText
//   };

//   /**
//    * 🔁 BACKWARD COMPATIBILITY
//    * Any code doing normalize(text).toLowerCase()
//    * or treating normalize() as string will still work
//    */
//   result.toString = () => normalizedText;

//   return result;
// }

// module.exports = normalize;








// function normalize(text) {
//   if (!text || typeof text !== "string") return "";

//   return text
//     .toLowerCase()
//     // keep letters, numbers, math operators
//     .replace(/[^a-z0-9+\-*/().\s]/g, "")
//     .replace(/\s+/g, " ")
//     .trim();
// }

// module.exports = normalize;

