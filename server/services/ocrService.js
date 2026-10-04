const { createWorker } = require("tesseract.js");

async function extractTextFromImage(imagePath) {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(imagePath);

    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } finally {
    await worker.terminate();
  }
}

module.exports = {
  extractTextFromImage,
};