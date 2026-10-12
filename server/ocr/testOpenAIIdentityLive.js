const path = require("node:path");
const { createOpenAIIdentityExtractor } = require("./openaiIdentityService");

async function main() {
  const [documentType, ...relativePaths] = process.argv.slice(2);
  const expectedImages = documentType === "passport" ? 1 : 2;
  if (!["nic", "license", "passport"].includes(documentType) || relativePaths.length !== expectedImages) {
    throw new Error("Usage: node ocr/testOpenAIIdentityLive.js <nic|license|passport> <SAMPLE-image-path> [<SAMPLE-back-image-path>]");
  }

  const filePaths = relativePaths.map(filePath => path.resolve(process.cwd(), filePath));
  const result = await createOpenAIIdentityExtractor()({ filePaths, idType: documentType });
  console.log(JSON.stringify({
    engine: "OpenAI Responses API",
    documentType: result.documentType,
    fields: {
      fullName: result.fullName,
      dateOfBirth: result.dateOfBirth,
      documentNumber: result.documentNumber,
    },
    fieldStatus: result.fieldStatus,
  }, null, 2));
}

main().catch(error => {
  console.error(`OpenAI local extraction test failed: ${error.code || "UNKNOWN_ERROR"}`);
  process.exitCode = 1;
});
