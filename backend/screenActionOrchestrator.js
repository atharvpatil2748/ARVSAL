/**
 * Screen Action Orchestrator — Phase 10 (FINAL — Python Vision + Drift Fix)
 */

const { executeTool } = require("./tools/toolRegistry");
const { resolveElement } = require("./agent/elementResolver");
const { validateStep } = require("./agent/actionValidator");
const uiState = require("./agent/uiStateStore");
const { mapToDesktop } = require("./agent/coordinateMapper");
const { captureScreen } = require("./screenCapture");
const { runOCR } = require("./ocrRunner");

function log(...a){
  console.log("[ScreenOrchestrator]", ...a);
}

/* ================= CONTEXT REFRESH ================= */

async function buildFreshContext(ctx){

  // AgentLoop already passed context → reuse
  if(ctx?.imagePath) return ctx;

  try{
    const cap = await captureScreen();
    const imagePath = cap?.imagePath;

    let ocrText="";
    try{ ocrText = await runOCR(imagePath); }catch{}

    return {
      imagePath,
      ocrText,
      screenshotMeta:{
        width: cap?.width,
        height: cap?.height
      }
    };

  }catch{
    return ctx || {};
  }
}

/* ================= STEP EXECUTOR ================= */

async function executeStep(step, ctx){

  ctx = await buildFreshContext(ctx);

  const { imagePath, ocrText, screenshotMeta } = ctx;

  const { tool, action } = step;
  let params = step.params || {};

  log(`Step → ${tool}.${action}`, params);

  /* ================= CLICK ================= */

  if(tool === "desktop" && action === "click"){

    // Direct coordinates → execute
    if(typeof params.x === "number" && typeof params.y === "number"){
      return executeTool({ tool, action, params });
    }

    const target =
      params.target ||
      params.element ||
      params.label;

    if(!target){
      return { success:false, skipped:true, message:"Click missing target" };
    }

    log("Resolving target:", target);

    const resolution = await resolveElement({
      target,
      imagePath,
      ocrText,
      screenshotMeta   // ⭐ DRIFT FIX — CRITICAL
    });

    console.log("[RESOLUTION]", resolution);

    const validation = validateStep({ step, resolution });

    if(!validation.allowed){
      return {
        success:false,
        skipped:true,
        message: validation.message || "Blocked by validator"
      };
    }

    if(resolution?.found && resolution.x != null && resolution.y != null){

      // Store memory
      try{
        uiState.rememberElement(target,{
          label: target,
          x: resolution.x,
          y: resolution.y,
          method: resolution.method || "resolver"
        });
      }catch{}

      /* ⭐ FIX SCALING DRIFT */
        const mapped = mapToDesktop({
          x: resolution.x,
          y: resolution.y,
          screenshotMeta
        });

        console.log("✅ EXECUTE CLICK NOW", mapped);

        return executeTool({
          tool: "desktop",
          action: "click",
          params:{
            x: mapped.x,
            y: mapped.y,
            button: params.button || "left"
          }
        });
    }

    return {
      success:false,
      skipped:true,
      message:`Element not found: ${target}`
    };
  }

  /* ================= TYPE ================= */

  if(tool === "desktop" && action === "type"){

    if(!params.text && params.target){
      params.text = params.target;
    }

    if(!params.text){
      return { success:false, skipped:true, message:"Type missing text" };
    }

    return executeTool({ tool, action, params });
  }

  /* ================= KEYPRESS ================= */

  if(tool === "desktop" && action === "keypress"){
    return executeTool({ tool, action, params });
  }

  /* ================= DEFAULT ================= */

  return executeTool({ tool, action, params });
}

/* ================= MAIN ================= */

async function handleScreenAction(input){

  const plan = input?.plan;

  if(!plan || !plan.steps?.length){
    return { success:false, response:"No plan provided." };
  }

  const ctx = {
    imagePath: input.imagePath,
    ocrText: input.ocrText,
    screenType: input.screenType,
    screenshotMeta: input.screenshotMeta   // ⭐ DRIFT FIX ENTRY POINT
  };

  const results = [];
  let successCount = 0;
  const stepDetails = [];

  for(let i=0;i<plan.steps.length;i++){

    const step = plan.steps[i];

    log(`Executing ${i+1}/${plan.steps.length}`);

    let result;

    try{
      result = await executeStep(step, ctx);
    }catch(err){
      result = { success:false, error:err?.message };
    }

    results.push(result);

    try{
      uiState.setLastAction(step);
      uiState.setActionResult(result);
    }catch{}

    if(result?.success){
      successCount++;
      stepDetails.push(`✅ ${step.action}`);
    }
    else if(result?.skipped){
      stepDetails.push(`⏭️ ${result.message}`);
    }
    else{
      stepDetails.push(`❌ ${result?.error || "failed"}`);
    }

    if(i < plan.steps.length-1){
      const delay = step.params?.delay_ms || 400;
      await new Promise(r=>setTimeout(r, Math.min(delay,2000)));
    }
  }

  let response;

  if(successCount === plan.steps.length){
    response = `Done — ${plan.goal}`;
  }
  else if(successCount > 0){
    response = `Partial — ${plan.goal}\n${stepDetails.join("\n")}`;
  }
  else{
    response = `Failed — ${plan.goal}\n${stepDetails.join("\n")}`;
  }

  return {
    success: successCount>0,
    actions_taken: successCount,
    response
  };
}

module.exports = { handleScreenAction };
























// /**
//  * Screen Action Orchestrator — Phase 10 (Python Vision wired)
//  */

// const { executeTool } = require("./tools/toolRegistry");
// const { resolveElement } = require("./agent/elementResolver");
// const { validateStep } = require("./agent/actionValidator");
// const uiState = require("./agent/uiStateStore");

// const { captureScreen } = require("./screenCapture");
// const { runOCR } = require("./ocrRunner");

// function log(...a){
//   console.log("[ScreenOrchestrator]", ...a);
// }

// /* ================= CONTEXT REFRESH ⭐ CRITICAL ================= */

// async function buildFreshContext(ctx){

//   // If agentLoop already passed context → reuse
//   if(ctx?.imagePath) return ctx;

//   try{
//     const cap = await captureScreen();
//     const imagePath = cap?.imagePath;

//     let ocrText="";
//     try{ ocrText = await runOCR(imagePath); }catch{}

//     return { imagePath, ocrText };
//   }catch{
//     return ctx || {};
//   }
// }

// /* ================= STEP EXECUTOR ================= */

// async function executeStep(step, ctx){

//   ctx = await buildFreshContext(ctx);

//   const { imagePath, ocrText } = ctx;
//   const { tool, action } = step;
//   let params = step.params || {};

//   log(`Step → ${tool}.${action}`, params);

//   /* ===== CLICK (PYTHON RESOLVE) ===== */

//   if(tool === "desktop" && action === "click"){

//     // direct coordinates
//     if(typeof params.x === "number" && typeof params.y === "number"){
//       return executeTool({ tool, action, params });
//     }

//     const target =
//       params.target ||
//       params.element ||
//       params.label;

//     if(!target){
//       return { success:false, skipped:true, message:"Click missing target" };
//     }

//     log("Resolving target:", target);

//     const resolution = await resolveElement({
//       target,
//       imagePath,
//       ocrText
//     });

//     console.log("[RESOLUTION]", resolution);

//     const validation = validateStep({ step, resolution });

//     if(!validation.allowed){
//       return {
//         success:false,
//         skipped:true,
//         message: validation.message || "Blocked by validator"
//       };
//     }

//     if(resolution?.found && resolution.x != null && resolution.y != null){

//       // ⭐ store for memory reuse
//       try{
//         uiState.storeElement({
//           label: target,
//           x: resolution.x,
//           y: resolution.y,
//           method: resolution.method || "resolver"
//         });
//       }catch{}

//       return executeTool({
//         tool:"desktop",
//         action:"click",
//         params:{
//           x: resolution.x,
//           y: resolution.y,
//           button: params.button || "left"
//         }
//       });
//     }

//     return {
//       success:false,
//       skipped:true,
//       message:`Element not found: ${target}`
//     };
//   }

//   /* ===== TYPE ===== */

//   if(tool === "desktop" && action === "type"){

//     if(!params.text && params.target){
//       params.text = params.target;
//     }

//     if(!params.text){
//       return { success:false, skipped:true, message:"Type missing text" };
//     }

//     return executeTool({ tool, action, params });
//   }

//   /* ===== KEYPRESS ===== */

//   if(tool === "desktop" && action === "keypress"){
//     return executeTool({ tool, action, params });
//   }

//   /* ===== DEFAULT ===== */

//   return executeTool({ tool, action, params });
// }

// /* ================= MAIN ================= */

// async function handleScreenAction(input){

//   const plan = input?.plan;

//   if(!plan || !plan.steps?.length){
//     return { success:false, response:"No plan provided." };
//   }

//   const ctx = {
//     imagePath: input.imagePath,
//     ocrText: input.ocrText,
//     screenType: input.screenType
//   };

//   const results = [];
//   let successCount = 0;
//   const stepDetails = [];

//   for(let i=0;i<plan.steps.length;i++){

//     const step = plan.steps[i];

//     log(`Executing ${i+1}/${plan.steps.length}`);

//     let result;

//     try{
//       result = await executeStep(step, ctx);
//     }catch(err){
//       result = { success:false, error:err?.message };
//     }

//     results.push(result);

//     try{
//       uiState.setLastAction(step);
//       uiState.setActionResult(result);
//     }catch{}

//     if(result?.success){
//       successCount++;
//       stepDetails.push(`✅ ${step.action}`);
//     }
//     else if(result?.skipped){
//       stepDetails.push(`⏭️ ${result.message}`);
//     }
//     else{
//       stepDetails.push(`❌ ${result?.error || "failed"}`);
//     }

//     if(i < plan.steps.length-1){
//       const delay = step.params?.delay_ms || 400;
//       await new Promise(r=>setTimeout(r, Math.min(delay,2000)));
//     }
//   }

//   let response;

//   if(successCount === plan.steps.length){
//     response = `Done — ${plan.goal}`;
//   }
//   else if(successCount > 0){
//     response = `Partial — ${plan.goal}\n${stepDetails.join("\n")}`;
//   }
//   else{
//     response = `Failed — ${plan.goal}\n${stepDetails.join("\n")}`;
//   }

//   return {
//     success: successCount>0,
//     actions_taken: successCount,
//     response
//   };
// }

// module.exports = { handleScreenAction };






















// /**
//  * Screen Action Orchestrator — FIXED
//  *
//  * Root causes addressed:
//  * 1. processActionMemory is now non-blocking (wrapped in try/catch with timeout)
//  * 2. Smart click resolution: tries OCR text search first before slow LLaVA
//  * 3. Clear detailed logging so we can see exactly what succeeds/fails
//  * 4. type action gets params.text (not params.target)
//  * 5. Graceful failure — always returns a reply even if steps fail
//  */

// const { captureScreen } = require("./screenCapture");
// const { runOCR } = require("./ocrRunner");
// const { classifyScreen } = require("./screenClassifier");
// const { resolveElement } = require("./agent/elementResolver");
// const { processActionMemory } = require("./cognitiveEngine");
// const { generatePlan } = require("./plannerEngine");
// const { executeTool } = require("./tools/toolRegistry");
// const uiState = require("./agent/uiStateStore");
// const { validateStep } = require("./agent/actionValidator");
// const { buildWorldContext } = require("./agent/worldModel");

// /* ================= LOGGER ================= */

// function log(...args) {
//     console.log("[ScreenOrchestrator]", ...args);
// }

// /* ================= SCREEN CONTEXT ================= */

// function buildScreenContext(ocrText, screenType) {
//     return [
//         `Screen Type: ${screenType}`,
//         ocrText
//             ? `Visible Text (OCR):\n${ocrText.slice(0, 800)}`
//             : "No OCR text available"
//     ].join("\n");
// }

// /* ================= OCR-BASED CLICK RESOLVER ================= */

// /**
//  * Fast fallback: find approximate click coords using OCR bounding boxes.
//  * Uses tesseract's word-level output if available, otherwise skips.
//  *
//  * For now: searches the OCR text for the target word, reports it found
//  * so we can fall through to LLaVA for actual coords.
//  */
// function findInOCRText(target, ocrText) {
//     if (!target || !ocrText) return null;
//     const lower = ocrText.toLowerCase();
//     const targetLower = target.toLowerCase();
//     if (lower.includes(targetLower)) {
//         // Text found but no position — LLaVA will resolve coords
//         return { textFound: true };
//     }
//     return null;
// }

// /* ================= STEP EXECUTOR ================= */

// async function executeStep(step, imagePath, ocrText) {
//     const { tool, action } = step;
//     let { params = {} } = step;

//     log(`Step → tool:${tool} action:${action} params:${JSON.stringify(params)}`);

//     /* ===== CLICK: resolve element coords ===== */
//     if (tool === "desktop" && action === "click") {

//         // Already has coordinates — use them directly
//         if (typeof params.x === "number" && typeof params.y === "number") {
//             log(`Click at precise coords (${params.x}, ${params.y})`);
//             return await executeTool({ tool, action, params });
//         }

//         const target = params.target || params.element || params.label || "";
//         if (!target) {
//             return { success: false, skipped: true, message: "⚠️ Click step missing target element description." };
//         }

//         log(`Resolving coords for: "${target}"`);

//         // Try LLaVA / Gemini vision to find element on screen
//         if (imagePath) {
//             const found = await resolveElement({
//                 target,
//                 imagePath,
//                 ocrText
//             });

//             if (found && found.found && typeof found.x === "number" && typeof found.y === "number") {
//                 log(`Found "${target}" at (${found.x}, ${found.y}) via ${found.method}`);
//                 return await executeTool({
//                     tool: "desktop",
//                     action: "click",
//                     params: { x: found.x, y: found.y, button: params.button || "left" }
//                 });
//             }

//             if (found && found.found && (found.x === null || found.y === null)) {
//                 return {
//                     success: false, skipped: true,
//                     message: `⚠️ Found "${target}" on screen but couldn't get exact position. Try being more specific.`
//                 };
//             }
//         }

//         return {
//             success: false, skipped: true,
//             message: `⚠️ Could not find "${target}" on screen. Check if element is visible.`
//         };
//     }

//     /* ===== TYPE: ensure params.text is set ===== */
//     if (tool === "desktop" && action === "type") {
//         if (!params.text && params.target) {
//             // Planner sometimes puts text in target
//             params = { ...params, text: params.target };
//         }
//         if (!params.text) {
//             return { success: false, skipped: true, message: "⚠️ Type step missing text to type." };
//         }
//         return await executeTool({ tool, action, params });
//     }

//     /* ===== All other steps — pass through directly ===== */
//     return await executeTool({ tool, action, params });
// }

// /* ================= MAIN ================= */

// async function handleScreenAction(userInput) {
//     if (!userInput || !userInput.trim()) {
//         return { success: false, response: "No action specified." };
//     }

//     let imagePath = null;
//     let ocrText = "";
//     let screenType = "unknown";
//     let screenContext = "";

//     /* ===== STEP 1: Capture screen ===== */
//     log("Capturing screen...");
//     try {
//         const capture = await captureScreen();
//         if (capture) {
//             imagePath = capture.imagePath;
//             log("Screen captured:", imagePath);
//         } else {
//             log("Screen capture returned null — continuing without screenshot");
//         }
//     } catch (err) {
//         log("Screen capture failed:", err?.message);
//     }

//     /* ===== STEP 2: OCR + classify (non-blocking) ===== */
//     if (imagePath) {
//         log("Running OCR...");
//         try {
//             ocrText = await runOCR(imagePath);
//             log(`OCR complete — ${ocrText.length} chars`);
//         } catch (err) {
//             log("OCR failed:", err?.message, "— continuing without OCR");
//         }
//     }

//     screenType = classifyScreen(ocrText);
//     screenContext = buildScreenContext(ocrText, screenType);
//     log(`Screen type: ${screenType}`);

//     /* ===== UI WORLD MODEL UPDATE (Phase 2) ===== */

//     try {
//         uiState.updateScreen({
//             screenType,
//             ocrText,
//             screenshotMeta: { imagePath }
//         });

//         uiState.updateStability(ocrText);

//         log("UI state updated");
//     } catch (err) {
//         log("UI state update failed:", err?.message);
//     }

//     /* ===== STEP 3: Memory (non-blocking, 5s max) ===== */
//     log("Querying action memory...");
//     let relevantMemory = [];
//     let actionHints = [];
//     let missingInfo = [];

//     try {
//         const memResult = await Promise.race([
//             processActionMemory({ userInput, screenType }),
//             new Promise(r => setTimeout(() => r(null), 5000)) // 5s timeout
//         ]);

//         if (memResult) {
//             ({ relevantMemory =[], actionHints =[], missingInfo =[] } = memResult);
//             log(`Memory: ${relevantMemory.length} items, ${actionHints.length} hints, ${missingInfo.length} missing`);
//         } else {
//             log("Memory query timed out — proceeding without memory");
//         }
//     } catch (err) {
//         log("Memory query failed:", err?.message, "— proceeding without memory");
//     }

//     /* ===== STEP 4: Ask if critical info is missing ===== */
//     if (missingInfo && missingInfo.length > 0) {
//         log("Clarification needed:", missingInfo[0]);
//         return {
//             success: false,
//             needsClarification: true,
//             question: missingInfo[0],
//             response: missingInfo[0]
//         };
//     }

//     /* ===== STEP 5: Generate plan ===== */
//     log("Generating plan...");
//     let plan = null;
//     try {
//         const worldContext = buildWorldContext({
//         userInput,
//         screenType,
//         memoryResult: {
//             relevantMemory,
//             actionHints,
//             missingInfo
//         }
//         });

//         plan = await generatePlan({
//         userInput,
//         worldContext
//         });
//     } catch (err) {
//         log("Plan generation failed:", err?.message);
//     }

//     if (!plan || !plan.steps || plan.steps.length === 0) {
//         if (plan && plan.goal === "unclear") {
//             return {
//                 success: false,
//                 response: "I'm not sure what to do. Try: 'click the send button', 'type hello in the search box', or 'scroll down'."
//             };
//         }
//         return {
//             success: false,
//             response: "Couldn't build an action plan for that. Try being more specific about what to click, type, or do."
//         };
//     }

//     log(`Plan: "${plan.goal}" — ${plan.steps.length} step(s)`);
//     log("Steps:", JSON.stringify(plan.steps, null, 2));

//     /* ===== STEP 6: Execute steps ===== */
//     const results = [];
//     let successCount = 0;
//     const warnings = [];
//     const stepDetails = [];

//     for (let i = 0; i < plan.steps.length; i++) {
//         const step = plan.steps[i];
//         log(`Executing step ${i + 1}/${plan.steps.length}: ${step.tool}.${step.action}`);

//         let result;
//         let resolution = null;

//         try {

//             /* ===== 1️⃣ Resolve element first (only for click) ===== */

//             if (step.tool === "desktop" && step.action === "click") {

//                 const target =
//                     step.params?.target ||
//                     step.params?.element ||
//                     step.params?.label;

//                 if (target) {
//                     resolution = await resolveElement({
//                         target,
//                         imagePath,
//                         ocrText
//                     });
//                 }
//             }

//             /* ===== 2️⃣ Validate step ===== */

//             const validation = validateStep({
//                 step,
//                 resolution
//             });

//             if (!validation.allowed) {

//                 const msg =
//                     validation.message ||
//                     "Action blocked by validator.";

//                 log("Validator blocked:", msg);

//                 stepDetails.push(`⛔ ${msg}`);

//                 if (validation.needsConfirmation) {
//                     return {
//                         success: false,
//                         needsClarification: true,
//                         question: msg,
//                         response: msg
//                     };
//                 }

//                 continue; // skip execution
//             }

//             /* ===== 3️⃣ Execute if allowed ===== */

//             result = await executeStep(step, imagePath, ocrText);

//         } catch (err) {
//             result = { success: false, error: err?.message };
//             log(`Step ${i + 1} threw:`, err?.message);
//         }

//         results.push(result);

//         if (result?.success) {
//             successCount++;
//             stepDetails.push(`✅ ${step.action}${step.params?.text ? ` "${step.params.text}"` : step.params?.target ? ` "${step.params.target}"` : ""}`);
//         } else if (result?.skipped) {
//             warnings.push(result.message);
//             stepDetails.push(`⏭️ skipped: ${result.message}`);
//         } else {
//             const errMsg = result?.error || "unknown error";
//             stepDetails.push(`❌ ${step.action}: ${errMsg}`);
//             log(`Step ${i + 1} failed:`, errMsg);
//         }

//         // Inter-step delay for UI to react
//         if (i < plan.steps.length - 1) {
//             const delay = step.params?.delay_ms || 400;
//             await new Promise(r => setTimeout(r, Math.min(delay, 2000)));
//         }
//     }

//     /* ===== STEP 7: Build response ===== */
//     let response;

//     if (successCount === plan.steps.length) {
//         response = `Done! Completed "${plan.goal}" (${successCount} step${successCount !== 1 ? "s" : ""}).`;
//     } else if (successCount > 0) {
//         response = `Partially done: ${successCount}/${plan.steps.length} steps for "${plan.goal}".\n`;
//         response += stepDetails.join("\n");
//     } else {
//         response = `Couldn't complete "${plan.goal}".\n`;
//         response += stepDetails.join("\n");
//         if (warnings.length > 0) {
//             response += `\n\nTips:\n${warnings.join("\n")}`;
//         }
//     }

//     return {
//         success: successCount > 0,
//         actions_taken: successCount,
//         response
//     };
// }

// /* ================= MEMORY FORMATTER ================= */

// function formatMemoryForPlanner(items = []) {
//     if (!items || !items.length) return "None";
//     return items
//         .slice(0, 6)
//         .map((m, i) => `[${i + 1}] (${m.type || "fact"}) ${m.value}`)
//         .join("\n");
// }

// /* ================= EXPORT ================= */

// module.exports = { handleScreenAction };
