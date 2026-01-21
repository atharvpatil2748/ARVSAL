/**
 * Confirmation Manager
 *
 * Handles short-lived, single-use confirmations
 * (e.g., shutdown, restart, destructive actions)
 *
 * IMPORTANT:
 * - Confirmations are NOT memory
 * - Confirmations automatically expire
 */

let pending = null;

// ⏱️ Confirmation validity window (human-like)
const CONFIRMATION_TTL_MS = 30 * 1000; // 30 seconds

/* ================= SET ================= */

function setConfirmation(payload) {
  if (!payload || typeof payload !== "object") return;

  pending = {
    ...payload,
    createdAt: Date.now()
  };
}

/* ================= GET ================= */

function getConfirmation() {
  if (!pending) return null;

  const now = Date.now();

  // 🔒 Auto-expire stale confirmations
  if (now - pending.createdAt > CONFIRMATION_TTL_MS) {
    pending = null;
    return null;
  }

  return pending;
}

/* ================= CLEAR ================= */

function clearConfirmation() {
  pending = null;
}

module.exports = {
  setConfirmation,
  getConfirmation,
  clearConfirmation
};






// let pending = null;

// function setConfirmation(payload) {
//   pending = {
//     ...payload,
//     createdAt: Date.now()
//   };
// }

// function getConfirmation() {
//   return pending;
// }

// function clearConfirmation() {
//   pending = null;
// }

// module.exports = {
//   setConfirmation,
//   getConfirmation,
//   clearConfirmation
// };

