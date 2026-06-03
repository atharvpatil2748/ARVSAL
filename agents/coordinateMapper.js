/**
 * Coordinate Mapper — DPI stable (LOCKED RATIO)
 */

const robot = require("robotjs");

let lockedRatio = null;

function getRatio(screenshotMeta){

  if(lockedRatio) return lockedRatio;

  const screen = robot.getScreenSize();

  if(!screenshotMeta?.width || !screenshotMeta?.height){
    lockedRatio = { x:1, y:1 };
    return lockedRatio;
  }

  lockedRatio = {
    x: screen.width / screenshotMeta.width,
    y: screen.height / screenshotMeta.height
  };

  console.log("🧠 DPI RATIO LOCKED", lockedRatio, {
    robot: screen,
    screenshot: screenshotMeta
  });

  return lockedRatio;
}

function mapToDesktop({ x, y, screenshotMeta }){

  const r = getRatio(screenshotMeta);

  const mapped = {
    x: Math.round(x * r.x),
    y: Math.round(y * r.y)
  };

  console.log("🧭 MAP", { input:{x,y}, mapped });

  return mapped;
}

module.exports = { mapToDesktop };