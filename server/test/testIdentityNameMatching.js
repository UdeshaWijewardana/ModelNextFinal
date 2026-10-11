const assert = require("node:assert/strict");
const { compareNames, evaluateIdentityExtraction } = require("../services/identityVerificationService");

const extraction = fullName => ({
  fullName,
  dateOfBirth: "2001-05-12",
  documentNumber: "200112345678",
  fieldStatus: {
    fullName: fullName ? "extracted" : "unable_to_read",
    dateOfBirth: "extracted",
    documentNumber: "extracted",
  },
});

function evaluate(fullName, extractedName) {
  return evaluateIdentityExtraction({
    extraction: extraction(extractedName),
    fullName,
    birthdate: "2001-05-12",
    idType: "nic",
    identityDocumentNumber: "200112345678",
  });
}

assert.equal(compareNames("John Michael Perera", "PERERA, John Michael"), "match");
assert.equal(compareNames("John Michael Perera", "John Perera"), "match");
assert.equal(compareNames("John Perera", "J. PERERA"), "match");
assert.equal(compareNames("John Perera", "Jonh Pererra"), "match");
assert.equal(compareNames("John Michael Perera", "John"), "partial_match");
assert.equal(compareNames("John Perera", "John Silva"), "mismatch");
assert.equal(compareNames("John Perera", "Jane Silva"), "mismatch");

const partial = evaluate("John Michael Perera", "John");
assert.equal(partial.overallStatus, "partial_match");
assert.equal(partial.verified, false);
assert.equal(partial.prototypePassed, true);
assert.equal(partial.checks.name.status, "partial_match");
assert.equal(partial.checks.dateOfBirth.status, "match");
assert.equal(partial.checks.documentNumber.status, "match");

const nameMismatch = evaluate("John Michael Perera", "Jane Silva");
assert.equal(nameMismatch.verified, false);
assert.equal(nameMismatch.prototypePassed, true);
assert.equal(nameMismatch.checks.name.status, "mismatch");

const unreadableName = evaluate("John Michael Perera", null);
assert.equal(unreadableName.verified, false);
assert.equal(unreadableName.prototypePassed, true);
assert.equal(unreadableName.checks.name.status, "unable_to_read");

const verified = evaluate("John Michael Perera", "Perera John Michael");
assert.equal(verified.overallStatus, "verified");
assert.equal(verified.verified, true);
assert.equal(verified.prototypePassed, true);

const wrongDob = evaluateIdentityExtraction({
  extraction: extraction("John Michael Perera"),
  fullName: "John Michael Perera",
  birthdate: "2002-05-12",
  idType: "nic",
  identityDocumentNumber: "200112345678",
});
assert.equal(wrongDob.prototypePassed, false);

const wrongDocumentNumber = evaluateIdentityExtraction({
  extraction: extraction("John Michael Perera"),
  fullName: "John Michael Perera",
  birthdate: "2001-05-12",
  idType: "nic",
  identityDocumentNumber: "200112345679",
});
assert.equal(wrongDocumentNumber.prototypePassed, false);

console.log("Name token, order, initials, OCR typo, partial evidence, and unrelated-name tests passed.");
