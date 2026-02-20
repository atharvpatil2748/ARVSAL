const { embedText } = require("./embeddingModel");

(async () => {
  const e = await embedText("good bye , nice to see you ");
  console.log("EMBEDDING:", Array.isArray(e), e?.length);
})();