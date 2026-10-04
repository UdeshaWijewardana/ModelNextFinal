const { normalizeOCRText } = require("../utils/ocrTextNormalizer");
const { extractFullName } = require("../utils/nameExtractor");
const { extractDateOfBirth } = require("../utils/dateExtractor");

function processOCRText(text) {
  const normalizedText = normalizeOCRText(text);

  return {
    rawText: text,
    normalizedText,
    extracted: {
      fullName: extractFullName(normalizedText),
      dateOfBirth: extractDateOfBirth(normalizedText),
    },
  };
}

module.exports = {
  processOCRText,
};