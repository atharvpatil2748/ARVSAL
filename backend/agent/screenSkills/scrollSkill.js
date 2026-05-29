const desktop = require("../../tools/desktopTool");

module.exports = async function scrollSkill(params={}){

  const direction = params.direction || "down";
  const amount = Number(params.amount) || 400;

  try{

    let x=0, y=0;

    if(direction==="down") y = -amount;
    if(direction==="up") y = amount;
    if(direction==="right") x = -amount;
    if(direction==="left") x = amount;

    const res = await desktop.execute({
      action:"scroll",
      params:{ x, y }
    });

    return {
      success:true,
      response:`Scrolled ${direction}`
    };

  }catch(err){
    return { success:false, response:"scroll failed" };
  }
};