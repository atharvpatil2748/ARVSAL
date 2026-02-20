/**
 * Executor Engine
 *
 * - Executes structured plans
 * - Passes through Risk Engine
 * - Uses Tool Registry
 * - Deterministic execution only
 */

const toolRegistry = require("./tools/toolRegistry");
const riskEngine = require("./safety/riskEngine");
const {
  setConfirmation
} = require("./confirmManager");

async function executePlan(plan) {
  if (!plan || !Array.isArray(plan.steps)) {
    return { success: false, message: "Invalid plan" };
  }

  // 🔥 Step 1: Risk evaluation
  const riskEvaluation = riskEngine.evaluate(plan);

  if (riskEvaluation.requiresConfirmation) {

    setConfirmation({
      execute: async () => {
        return await runSteps(plan.steps);
      }
    });

    return {
      success: false,
      confirmationRequired: true,
      risk: riskEvaluation.level
    };
  }

  // 🔥 Step 2: Execute directly
  return await runSteps(plan.steps);
}

async function runSteps(steps) {
  const results = [];

  for (const step of steps) {
    try {
      const result = await toolRegistry.execute(step);
      results.push(result);
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  return {
    success: true,
    results
  };
}

module.exports = {
  executePlan
};