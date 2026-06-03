/**
 * ACTION FEEDBACK — Reliability layer
 *
 * Detects whether an action changed the UI.
 * Prevents blind loops.
 */

const { captureScreen } = require('@modules/vision/screenCapture');
const { runOCR } = require('@modules/vision/ocrRunner');
const { classifyScreen } = require('@modules/vision/screenClassifier');

const uiState = require('@agents/uiStateStore');

function log(...a){
  console.log("[ActionFeedback]", ...a);
}

/* ================= TEXT CHANGE SCORE ================= */

function textDiffScore(oldText="", newText=""){
  if(!oldText || !newText) return 0;

  const oldWords = new Set(oldText.split(/\s+/));
  const newWords = newText.split(/\s+/);

  let changed = 0;
  for(const w of newWords){
    if(!oldWords.has(w)) changed++;
  }

  return changed / Math.max(1,newWords.length);
}

/* ================= MAIN ================= */

async function evaluateActionFeedback({
  previousOCR,
  action,
  maxWait = 1200
}){

  /* wait a bit for UI to react */
  await new Promise(r=>setTimeout(r, maxWait));

  let imagePath=null;
  let newOCR="";
  let newScreenType="unknown";

  try{
    const cap = await captureScreen();
    if(cap) imagePath = cap.imagePath;
  }catch{}

  if(imagePath){
    try{ newOCR = await runOCR(imagePath); }catch{}
  }

  newScreenType = classifyScreen(newOCR);

  const diff = textDiffScore(previousOCR, newOCR);

  const screenChanged = newScreenType !== uiState.snapshot().screenType;
  const textChanged = diff > 0.08; // small threshold

  const success = textChanged || screenChanged;

  /* update UI state */
  try{
    uiState.updateScreen({
      screenType:newScreenType,
      ocrText:newOCR,
      screenshotMeta:{ imagePath }
    });

    uiState.setActionResult({
      action,
      success,
      diff,
      screenChanged,
      ts:Date.now()
    });

  }catch{}

  log("Feedback:",{
    success,
    diff,
    screenChanged
  });

  return {
    success,
    diff,
    screenChanged,
    newOCR,
    newScreenType,
    imagePath
  };
}

module.exports = { evaluateActionFeedback };