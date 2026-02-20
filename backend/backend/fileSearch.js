const fs = require("fs");
const path = require("path");

const BASE_DIR = "C:/Users/athar";

// folders we NEVER scan
const SKIP_FOLDERS = [
  "node_modules",
  "AppData",
  "Application Data",
  "ProgramData",
  "$Recycle.Bin"
];

function searchFileByName(keyword) {

  function searchDir(dir) {
    let files;

    try {
      files = fs.readdirSync(dir);
    } catch (err) {
      // Permission denied → skip folder silently
      return null;
    }

    for (const file of files) {

      if (SKIP_FOLDERS.includes(file)) continue;

      const fullPath = path.join(dir, file);

      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (err) {
        continue; // skip unreadable items
      }

      if (stat.isDirectory()) {
        const result = searchDir(fullPath);
        if (result) return result;
      } else {
        if (file.toLowerCase().includes(keyword.toLowerCase())) {
          return fullPath;
        }
      }
    }

    return null;
  }

  return searchDir(BASE_DIR);
}

module.exports = { searchFileByName };