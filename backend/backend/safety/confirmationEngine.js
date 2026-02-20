/**
 * confirmationEngine.js
 *
 * Bridges riskEngine and confirmManager
 * Responsible for:
 * - Triggering confirmations
 * - Wrapping execution safely
 */

const { evaluate } = require("./riskEngine");
const confirmManager = require("../confirmManager");

async function handlePlan(plan, executorFn) {
  const risk = evaluate(plan);

  if (!risk.allowed) {
    return {
      status: "blocked",
      message: "Action blocked due to critical risk."
    };
  }

  if (risk.requiresConfirmation) {
    confirmManager.setConfirmation({
      execute: executorFn
    });

    return {
      status: "confirmation_required",
      message: "This action requires confirmation."
    };
  }

  // Safe to execute immediately
  const result = await executorFn();

  return {
    status: "executed",
    result
  };
}

module.exports = {
  handlePlan
};