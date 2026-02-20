const fs = require("fs");

async function safeDelete(file, retries = 6) {
  if (!file) return;

  const attempt = (n) => {
    setTimeout(() => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (e) {
        if (n > 0) {
          attempt(n - 1); // retry
        }
      }
    }, 1200); // delay between retries
  };

  attempt(retries);
}

module.exports = { safeDelete };