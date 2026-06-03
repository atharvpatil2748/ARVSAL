/**
 * Agent Loop — Stable (Phase 7 fixed + Phase 8 ready)
 */

const { captureScreen } = require('@modules/vision/screenCapture');
const { runOCR } = require('@modules/vision/ocrRunner');
const { classifyScreen } = require('@modules/vision/screenClassifier');

const uiState = require('@agents/uiStateStore');
const { buildWorldContext } = require('@agents/worldModel');
const { generatePlan } = require('@core/reasoning/plannerEngine');
const { validateStep } = require('@agents/actionValidator');
const { handleScreenAction } = require('@modules/vision/screenActionOrchestrator');
const { evaluateActionFeedback } = require('@agents/actionFeedback');
const memoryAgent = require('@agents/memoryAgent');

const { executeSkill, isSkill } = require('@agents/skills/skillRegistry');

function log(...a){
  console.log("[AgentLoop]", ...a);
}

const MAX_STEPS = 5;

async function agentLoop(userInput){

  if(!userInput || typeof userInput !== "string"){
    return { success:false, response:"No action provided." };
  }

  log("START:", userInput);

  /* ========= PERCEIVE ========= */

  let imagePath=null;
  let ocrText="";
  let screenType="unknown";
  let cap=null; // ⭐ IMPORTANT

  try{
    cap = await captureScreen();
    if(cap){
      imagePath = cap.imagePath;
    }
  }catch{}

  if(imagePath){
    try{ ocrText = await runOCR(imagePath); }catch{}
  }

  screenType = classifyScreen(ocrText);

  try{
    uiState.updateScreen({ screenType, ocrText, screenshotMeta:{imagePath}});
    uiState.updateStability(ocrText);
  }catch{}

  /* ========= WORLD ========= */

  const memoryContext = await memoryAgent.getAgentContext(userInput);

  const worldContext = buildWorldContext({
    userInput,
    screenType,
    memoryContext
  });

  /* ========= PLAN ========= */

  const plan = await generatePlan({ userInput, worldContext });

  if(!plan || !plan.steps?.length){
    return { success:false, response:"I couldn't determine the next action." };
  }

  log("PLAN:", plan.goal);

  /* ========= VALIDATE ========= */

  for(const step of plan.steps){
    const validation = validateStep({ step });

    if(!validation.allowed){
      return {
        success:false,
        needsClarification: validation.needsConfirmation,
        response: validation.message || "Action blocked by validator."
      };
    }
  }

  /* ========= EXECUTE ========= */

  let previousOCR = ocrText;
  let finalResult=null;
  let stepsExecuted=0;
  let uiChanged=false;

  for(const step of plan.steps){

    if(stepsExecuted>=MAX_STEPS){
      log("Max steps reached — stopping");
      break;
    }

    log("STEP:", step.action);

    /* ===== SKILL ===== */

    if(isSkill(step)){
      log("SKILL:", step.action);
      finalResult = await executeSkill(step);
      uiChanged = true;
      stepsExecuted++;
      continue;
    }

    /* ===== ⭐ NORMAL STEP — PASS CONTEXT ⭐ ===== */

    const result = await handleScreenAction({
      plan:{ goal:plan.goal, steps:[step] },

      imagePath,
      ocrText,
      screenType,

      screenshotMeta:{      // ⭐ THIS FIXES DRIFT
        width: cap?.width,
        height: cap?.height
      }
    });
    finalResult = result;

    try{
      uiState.setLastAction(step);
    }catch{}

    /* ===== INPUT ACTIONS (skip feedback) ===== */

    const isInputAction =
      step.tool==="desktop" &&
      (step.action==="type" || step.action==="keypress");

    if(isInputAction){
      uiChanged = true;
      stepsExecuted++;
      continue;
    }

    /* ===== FEEDBACK ===== */

    const feedback = await evaluateActionFeedback({
      previousOCR,
      action:step
    }) || { success:false };

    if(!feedback.success){

      log("⚠️ No UI change → retry once");

      const retry = await handleScreenAction({
        plan:{ goal:plan.goal, steps:[step] },

        imagePath,
        ocrText,
        screenType,

        screenshotMeta:{
          width: cap?.width,
          height: cap?.height
        }
      });

      finalResult = retry;

      const retryFeedback = await evaluateActionFeedback({
        previousOCR,
        action:step
      }) || { success:false };

      if(!retryFeedback.success){
        log("❌ Retry failed → stopping plan");
        break;
      }

      previousOCR = retryFeedback.newOCR;
      uiChanged = true;

    }else{
      previousOCR = feedback.newOCR;
      uiChanged = true;
    }

    stepsExecuted++;
  }

  /* ========= HONEST RESULT ⭐ ========= */

  if(!uiChanged){
    return {
      success:false,
      response:"I tried but nothing changed on screen."
    };
  }

  return finalResult || {
    success:false,
    response:"Execution finished with no result."
  };
}

module.exports = { agentLoop };