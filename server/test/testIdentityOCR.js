const assert = require("node:assert/strict");
const { normalizeOCRText } = require("../utils/ocrTextNormalizer");
const { extractDateOfBirth } = require("../utils/dateExtractor");
const { extractFullName } = require("../utils/nameExtractor");
const { matchIdentityData } = require("../utils/identityMatcher");
const { processOCRText } = require("../services/identityOCRService");

const ocrText = [
  "MODELNEXT OCR TEST",
  "",
  "Name: John Perera",
  "Date of Birth: 12/05/2001",
  "NIC: 200112345678",
].join("\n");

const processed = processOCRText(ocrText);

assert.equal(normalizeOCRText("  JOHN   PERERA  "), "JOHN PERERA");
assert.deepEqual(processed.extracted, {
  fullName: "John Perera",
  dateOfBirth: "2001-05-12",
});
assert.equal(processed.rawText, ocrText);

for (const date of ["12/05/2001", "12-05-2001", "12.05.2001", "2001-05-12"]) {
  assert.equal(extractDateOfBirth(date), "2001-05-12");
}

assert.equal(extractDateOfBirth("NIC: 200112345678"), null);
assert.equal(extractDateOfBirth("Phone: 12-05-2001"), null);
assert.equal(extractDateOfBirth("31/02/2001"), null);
assert.equal(extractDateOfBirth("01/02/2001 and 03/04/2002"), null);
assert.equal(extractFullName("John Perera"), null);
assert.equal(extractFullName("Name: John Perera DOB: 12/05/2001"), "John Perera");

const matchingIdentity = matchIdentityData({
  registeredName: "John Perera",
  registeredDateOfBirth: "2001-05-12",
  extractedName: processed.extracted.fullName,
  extractedDateOfBirth: processed.extracted.dateOfBirth,
});
assert.deepEqual(matchingIdentity, {
  nameMatch: true,
  dateOfBirthMatch: true,
  dataMatch: true,
});

assert.deepEqual(
  matchIdentityData({
    registeredName: "John Perera",
    registeredDateOfBirth: "2001-05-12",
    extractedName: "Jane Silva",
    extractedDateOfBirth: "12/05/2001",
  }),
  { nameMatch: false, dateOfBirthMatch: true, dataMatch: false },
);

assert.deepEqual(
  matchIdentityData({
    registeredName: "John Perera",
    registeredDateOfBirth: "2001-05-12",
    extractedName: "John Perera",
    extractedDateOfBirth: "12/05/2002",
  }),
  { nameMatch: true, dateOfBirthMatch: false, dataMatch: false },
);

assert.deepEqual(
  matchIdentityData({
    registeredName: "John Perera",
    registeredDateOfBirth: "2001-05-12",
    extractedName: "John Perera",
    extractedDateOfBirth: null,
  }),
  { nameMatch: true, dateOfBirthMatch: false, dataMatch: false },
);

assert.deepEqual(
  matchIdentityData({
    registeredName: "John Perera",
    registeredDateOfBirth: "2001-05-12",
    extractedName: null,
    extractedDateOfBirth: "12/05/2001",
  }),
  { nameMatch: false, dateOfBirthMatch: true, dataMatch: false },
);

console.log("OCR text:", processed.normalizedText);
console.log("Extracted:", processed.extracted);
console.log("Matching identity:", matchingIdentity);
console.log("Negative and missing-value tests passed.");