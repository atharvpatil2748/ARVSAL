const sendMessageSkill = require('./sendMessageSkill');
const scrollSkill = require('./scrollSkill');
const navigationSkill = require('./navigationSkill');
const fillFormSkill = require('./fillFormSkill');
const suggestionSkill = require('./suggestionSkill');

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