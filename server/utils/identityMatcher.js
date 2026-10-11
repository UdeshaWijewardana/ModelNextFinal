const { normalizeOCRText } = require("./ocrTextNormalizer");
const { extractDateOfBirth } = require("./dateExtractor");
const { normalizeDocumentNumber, isValidDocumentNumber } = require('./documentNumberExtractor');

function normalizeNameForComparison(name) {
  if (typeof name !== "string") {
    return null;
  }

  const normalizedName = normalizeOCRText(name).normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, " ").trim().toLocaleLowerCase('en');
  return normalizedName || null;
}

function matchIdentityData({
  registeredName,
  registeredDateOfBirth,
  extractedName,
  extractedDateOfBirth,
  registeredDocumentNumber,
  extractedDocumentNumber,
  idType,
} = {}) {
  const normalizedRegisteredName = normalizeNameForComparison(registeredName);
  const normalizedExtractedName = normalizeNameForComparison(extractedName);
  const normalizedRegisteredDate = extractDateOfBirth(registeredDateOfBirth);
  const normalizedExtractedDate = extractDateOfBirth(extractedDateOfBirth);

  const namesMatch = () => {
    if (!normalizedRegisteredName || !normalizedExtractedName) return false;
    if (normalizedRegisteredName === normalizedExtractedName) return true;
    const registered = normalizedRegisteredName.split(' '); const extracted = normalizedExtractedName.split(' ');
    if (registered.length !== extracted.length || registered.at(-1) !== extracted.at(-1)) return false;
    return registered.every((token, index) => token === extracted[index] || (token.length === 1 && token === extracted[index][0]) || (extracted[index].length === 1 && extracted[index] === token[0]));
  };
  const nameMatch = namesMatch();
  const dateOfBirthMatch = Boolean(
    normalizedRegisteredDate &&
      normalizedExtractedDate &&
      normalizedRegisteredDate === normalizedExtractedDate,
  );
  const normalizedRegisteredDocument = normalizeDocumentNumber(registeredDocumentNumber);
  const normalizedExtractedDocument = normalizeDocumentNumber(extractedDocumentNumber);
  const documentNumberMatch = Boolean(isValidDocumentNumber(idType, normalizedRegisteredDocument) && isValidDocumentNumber(idType, normalizedExtractedDocument) && normalizedRegisteredDocument === normalizedExtractedDocument);

  return {
    nameMatch,
    dateOfBirthMatch,
    documentNumberMatch,
    dataMatch: nameMatch && dateOfBirthMatch && documentNumberMatch,
  };
}

module.exports = {
  matchIdentityData,
  normalizeNameForComparison,
};
