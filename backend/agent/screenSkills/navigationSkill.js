const { handleScreenAction } = require("../../screenActionOrchestrator");

async function navigationSkill({ target }) {
  if (!target) return { success: false };

  return handleScreenAction({
    plan: {
      goal: "navigate",
      steps: [{
        tool: "desktop",
        action: "click",
        params: { target }
      }]
    }
  });
}

module.exports = navigationSkill;