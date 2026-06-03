const robot = require("robotjs");

function computeScale(imageMeta){

  try{
    const screen = robot.getScreenSize();

    const imgW = imageMeta?.width;
    const imgH = imageMeta?.height;

    if(!imgW || !imgH){
      return { sx:1, sy:1 };
    }

    return {
      sx: screen.width / imgW,
      sy: screen.height / imgH
    };

  }catch{
    return { sx:1, sy:1 };
  }
}

function scalePoint(x,y,scale){
  return {
    x: Math.round(x * scale.sx),
    y: Math.round(y * scale.sy)
  };
}

module.exports = { computeScale, scalePoint };