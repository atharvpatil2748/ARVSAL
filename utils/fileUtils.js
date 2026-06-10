const fs = require('fs');
const path = require('path');

/**
 * Safely writes a JSON file using a temporary file and an atomic rename operation.
 * Prevents file corruption if the process crashes mid-write.
 * 
 * @param {string} filePath - The target file path.
 * @param {any} data - The data to serialize to JSON.
 */
function atomicWriteJsonSync(filePath, data) {
  const tmpPath = filePath + '.tmp';
  try {
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, jsonString, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch (cleanupError) {
      console.error(`[atomicWriteJsonSync] Failed to cleanup temp file ${tmpPath}:`, cleanupError.message);
    }
    throw error;
  }
}

module.exports = {
  atomicWriteJsonSync
};
