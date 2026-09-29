const fs = require("fs");
const { extractTextFromImage } = require("./ocrService");
const { processOCRText } = require("./identityOCRService");
const { matchIdentityData } = require("../utils/identityMatcher");

async function hasSupportedImageSignature(filePath) {
  const file = await fs.promises.open(filePath, "r");
  const header = Buffer.alloc(12);

  try {
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    if (bytesRead < 3) return false;

    const isPng = header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const isWebp = header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP";
    const isBmp = header.toString("ascii", 0, 2) === "BM";
    const isTiff = header.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00]))
      || header.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]));

    return isPng || isJpeg || isWebp || isBmp || isTiff;
  } finally {
    await file.close();
  }
}

async function verifyIdentityDocument({ filePath, fullName, birthdate }) {
  if (!await hasSupportedImageSignature(filePath)) {
    const error = new Error("The uploaded file is not a supported image.");
    error.code = "OCR_UNREADABLE_IMAGE";
    throw error;
  }

  let ocrResult;

  try {
    ocrResult = await extractTextFromImage(filePath);
  } catch (cause) {
    const error = new Error("OCR processing failed.");
    error.code = /image|pixread|format/i.test(cause.message || "")
      ? "OCR_UNREADABLE_IMAGE"
      : "OCR_PROCESSING_FAILED";
    error.cause = cause;
    throw error;
  }

  const processed = processOCRText(ocrResult.text);
  const identityMatch = matchIdentityData({
    registeredName: fullName,
    registeredDateOfBirth: birthdate,
    extractedName: processed.extracted.fullName,
    extractedDateOfBirth: processed.extracted.dateOfBirth,
  });

  const checks = {
    nameMatch: identityMatch.nameMatch,
    dateOfBirthMatch: identityMatch.dateOfBirthMatch,
  };

  return {
    verified: checks.nameMatch && checks.dateOfBirthMatch,
    checks,
    extracted: processed.extracted,
  };
}

module.exports = {
  verifyIdentityDocument,
};