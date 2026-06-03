const sendMessageSkill = require('@agents/skills/sendMessageSkill');
const scrollSkill = require('@agents/skills/scrollSkill');
const navigationSkill = require('@agents/skills/navigationSkill');
const fillFormSkill = require('@agents/skills/fillFormSkill');
const suggestionSkill = require('@agents/skills/suggestionSkill');

const registry = {
  send_message: sendMessageSkill,
  scroll: scrollSkill,
  navigate: navigationSkill,
  fill_form: fillFormSkill,
  suggest: suggestionSkill
};

function isSkill(step) {
  return step?.tool === "skill" && registry[step.action];
}

async function executeSkill(step) {
  let fn = registry[step.action];

  if (fn && typeof fn === 'object' && Object.keys(fn).length === 1) {
    fn = Object.values(fn)[0];
  }

  if (!fn || typeof fn !== 'function') {
    return { success: false, response: `Unknown skill ${step.action}` };
  }
  return await fn(step.params || {});
}

module.exports = { isSkill, executeSkill };