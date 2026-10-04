const { normalizeOCRText } = require("./ocrTextNormalizer");
const { extractDateOfBirth } = require("./dateExtractor");

function normalizeNameForComparison(name) {
  if (typeof name !== "string") {
    return null;
  }

  const normalizedName = normalizeOCRText(name).replace(/\s+/g, " ").toLowerCase();
  return normalizedName || null;
}

function matchIdentityData({
  registeredName,
  registeredDateOfBirth,
  extractedName,
  extractedDateOfBirth,
} = {}) {
  const normalizedRegisteredName = normalizeNameForComparison(registeredName);
  const normalizedExtractedName = normalizeNameForComparison(extractedName);
  const normalizedRegisteredDate = extractDateOfBirth(registeredDateOfBirth);
  const normalizedExtractedDate = extractDateOfBirth(extractedDateOfBirth);

  const nameMatch = Boolean(
    normalizedRegisteredName &&
      normalizedExtractedName &&
      normalizedRegisteredName === normalizedExtractedName,
  );
  const dateOfBirthMatch = Boolean(
    normalizedRegisteredDate &&
      normalizedExtractedDate &&
      normalizedRegisteredDate === normalizedExtractedDate,
  );

  return {
    nameMatch,
    dateOfBirthMatch,
    dataMatch: nameMatch && dateOfBirthMatch,
  };
}

module.exports = {
  matchIdentityData,
};