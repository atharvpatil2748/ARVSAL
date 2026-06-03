/**
 * Element Resolver — Production (Python Driven)
 *
 * Flow:
 * 1. Memory
 * 2. Python locator ⭐ PRIMARY
 * 3. LLM fallback
 */

const uiState = require('@agents/uiStateStore');
const { findElement } = require('./screenElementFinder');
const { locateElement } = require('@agents/pythonBridge');

/* ================= MEMORY ================= */

function memoryMatch(target){

  const lower = target.toLowerCase();

  // never cache send button
  if(lower.includes("send")) return null;

  const elements = uiState.getLastElements() || [];

  return elements.find(e =>
    e.label?.toLowerCase().includes(lower)
  ) || null;
}

/* ================= RESOLVE ================= */

async function resolveElement({ target, imagePath, ocrText }){

  if(!target){
    return { found:false, reason:"no_target" };
  }

  const lower = target.toLowerCase();

  /* ===== MEMORY ===== */

  const mem = memoryMatch(target);

  if(mem?.x != null && mem?.y != null){

    return {
      found:true,
      x:mem.x,
      y:mem.y,
      method:"memory"
    };

  }

  /* ===== PYTHON LOCATOR ⭐ PRIMARY ===== */

  if(imagePath){

    try{

      const result = await locateElement(imagePath, target);

      console.log("[PY LOCATE]", result);

      if(result?.success && result.element){

        const el = result.element;

        const point = el.clickable_point || el.center;

        if(point){

          if(!lower.includes("send")){
            try{
              uiState.rememberElement(target,{
                x: point.x,
                y: point.y,
                label: el.label || target,
                confidence: el.confidence || 0.8,
                source:"python"
              });
            }catch{}
          }

          return {
            found:true,
            x: point.x,
            y: point.y,
            bbox: el.bbox,
            label: el.label,
            method:"python",
            confidence: el.confidence || 0.8
          };

        }

      }

    }catch(err){
      console.log("[PY LOCATE ERROR]", err.message);
    }

  }

  /* ===== LLM FALLBACK ===== */

  const found = await findElement(imagePath, target, ocrText);

  if(found?.found && found.x != null && found.y != null){

    if(!lower.includes("send")){
      try{
        uiState.rememberElement(target,{
          x: found.x,
          y: found.y,
          label: target,
          confidence:0.6,
          source:"vision"
        });
      }catch{}
    }

    return found;

  }

  return {
    found:false,
    method:"not_found"
  };

}

module.exports = { resolveElement };