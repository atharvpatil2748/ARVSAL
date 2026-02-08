/**
 * Normalizer
 *
 * - Preserves original user text (for LLM, UI, math, code)
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

    // 🔒 legacy-safe
    empty.toString = () => "";
    return Object.freeze(empty);
  }

  const rawText = input.trim();

  /* =====================================================
     🔒 NORMALIZED VERSION (INTENT ONLY)
     - NEVER used for memory
     - NEVER shown to user
  ===================================================== */

  const normalizedText = rawText
    .toLowerCase()

    // 🔒 remove possessive FIRST
    .replace(/'s\b/g, "")

    // allow math, comparison, time, ratios, URLs
    .replace(/[^a-z0-9+\-*/=().%^,:<>\/\s]/g, " ")

    .replace(/\s+/g, " ")
    .trim();

  const result = {
    rawText,
    normalizedText,

    // explicit marker: intent-only safe
    normalizedSafe: true
  };

  /**
   * 🔁 BACKWARD COMPATIBILITY (CRITICAL)
   * Any legacy code treating normalize() as string
   * must receive RAW TEXT, not stripped text.
   */
  Object.defineProperty(result, "toString", {
    value: () => rawText,
    enumerable: false
  });

  return Object.freeze(result);
}

module.exports = normalize;













// /**
//  * Normalizer
//  * - Preserves original user text (for LLM & math & punctuation)
//  * - Provides normalized text ONLY for intent detection
//  * - Deterministic, memory-safe, backward-compatible
//  */

// function normalize(input) {
//   if (!input || typeof input !== "string") {
//     const empty = {
//       rawText: "",
//       normalizedText: "",
//       normalizedSafe: true
//     };

//     // backward compatibility
//     empty.toString = () => "";
//     return empty;
//   }

//   const rawText = input.trim();

//   /* =====================================================
//      🔒 NORMALIZED VERSION (INTENT ONLY)
//      - NEVER used directly for memory storage
//      - Possessive handled explicitly to avoid ambiguity
//   ===================================================== */

//   const normalizedText = rawText
//     .toLowerCase()

//     // 🔒 remove possessive FIRST (critical for memory safety)
//     .replace(/'s\b/g, "")

//     // keep letters, numbers, math symbols, comparison, equals
//     .replace(/[^a-z0-9+\-*/=().%^,<>\s]/g, " ")

//     .replace(/\s+/g, " ")
//     .trim();

//   const result = {
//     rawText,
//     normalizedText,

//     // 🔑 explicit marker: safe ONLY for intent detection
//     normalizedSafe: true
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












