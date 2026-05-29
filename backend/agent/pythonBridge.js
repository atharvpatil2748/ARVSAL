/**
 * Python Bridge — Production
 *
 * Responsible for:
 * - communicating with Python worker
 * - parsing JSON safely
 * - returning normalized responses
 */

const { spawn } = require("child_process");
const path = require("path");

const PYTHON = "C:\\Users\\athar\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe";

const SCRIPT = path.join(__dirname, "../python_worker/main.py");

/* ================= RUN PYTHON ================= */

function runPython(args){

  return new Promise((resolve)=>{

    const py = spawn(PYTHON, [SCRIPT, ...args]);

    let stdout = "";
    let stderr = "";

    py.stdout.on("data", d => stdout += d.toString());
    py.stderr.on("data", d => stderr += d.toString());

    py.on("close", ()=>{

      if(!stdout){
        return resolve({
          success:false,
          error:"python_no_output",
          stderr
        });
      }

      try{

        const parsed = JSON.parse(stdout);

        resolve({
          success:true,
          ...parsed
        });

      }catch(err){

        resolve({
          success:false,
          error:"invalid_json",
          raw:stdout,
          stderr
        });

      }

    });

  });

}

/* ================= DETECT ELEMENTS ================= */

async function detectElements(imagePath){

  const res = await runPython(["detect", imagePath]);

  if(!res.success) return res;

  return {
    success:true,
    elements: res.elements || []
  };

}

/* ================= LOCATE TARGET ================= */

async function locateElement(imagePath, target){

  const res = await runPython(["locate", imagePath, target]);

  if(!res.success) return res;

  return {
    success:true,
    element: res.element
  };

}

/* ================= ACTION ================= */

async function pythonAct(payload){

  const res = await runPython(["act", JSON.stringify(payload)]);

  return res;

}

module.exports = {
  detectElements,
  locateElement,
  pythonAct
};