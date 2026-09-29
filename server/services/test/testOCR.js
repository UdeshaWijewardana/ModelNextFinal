const path = require("path");
const { extractTextFromImage } = require("../ocrService");

async function testOCR() {
  try {
    const imagePath = path.join(__dirname, "../../test/test-image.png");

    console.log("Starting OCR...");
    console.log("Image:", imagePath);

    const result = await extractTextFromImage(imagePath);

    console.log("\n===== OCR RESULT =====");
    console.log(result.text);

    console.log("\n===== CONFIDENCE =====");
    console.log(result.confidence);

    console.log("\nOCR test completed successfully.");
  } catch (error) {
    console.error("\nOCR TEST FAILED:");
    console.error(error);
  }
}

testOCR();