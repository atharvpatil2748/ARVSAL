const { handleScreenAction } = require('@modules/vision/screenActionOrchestrator');

async function fillFormSkill({ fields = [] }) {

  for (const f of fields) {
    if (!f.label || !f.value) continue;

    await handleScreenAction({
      plan: {
        goal: "fill field",
        steps: [
          { tool: "desktop", action: "click", params: { target: f.label } },
          { tool: "desktop", action: "type", params: { text: f.value } }
        ]
      }
    });
  }

  return { success: true };
}

module.exports = fillFormSkill;