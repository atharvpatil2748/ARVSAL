const { handleScreenAction } = require('@modules/vision/screenActionOrchestrator');

async function suggestionSkill({ text }) {

  if (!text) return { success: false };

  return handleScreenAction({
    plan: {
      goal: "type suggestion",
      steps: [{
        tool: "desktop",
        action: "type",
        params: { text }
      }]
    }
  });
}

module.exports = suggestionSkill;