const { extractDateOfBirth } = require("./dateExtractor");
const { isValidDocumentNumber, normalizeDocumentNumber } = require("./documentNumberExtractor");
const { normalizeOCRText } = require("./ocrTextNormalizer");
const { matchIdentityData, normalizeNameForComparison } = require("./identityMatcher");
const { createOpenAIIdentityExtractor } = require("./openaiIdentityService");

function nameScript(value) {
  const normalized = normalizeNameForComparison(value) || "";
  return /\p{Script=Latin}/u.test(normalized) ? "latin" : null;
}

function nameTokens(value) {
  const normalized = normalizeNameForComparison(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function editDistanceAtMostOne(first, second) {
  if (first === second) return true;
  if (Math.abs(first.length - second.length) > 1 || Math.min(first.length, second.length) < 4) return false;
  if (first.length === second.length) {
    const differences = [];
    for (let index = 0; index < first.length; index += 1) {
      if (first[index] !== second[index]) differences.push(index);
    }
    if (
      differences.length === 2
      && differences[1] === differences[0] + 1
      && first[differences[0]] === second[differences[1]]
      && first[differences[1]] === second[differences[0]]
    ) return true;
  }
  let left = 0;
  let right = 0;
  let edits = 0;
  while (left < first.length && right < second.length) {
    if (first[left] === second[right]) {
      left += 1;
      right += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (first.length > second.length) left += 1;
    else if (second.length > first.length) right += 1;
    else {
      left += 1;
      right += 1;
    }
  }
  if (left < first.length || right < second.length) edits += 1;
  return edits <= 1;
}

function nameTokensMatch(first, second) {
  if (first === second) return true;
  if (first.length === 1 || second.length === 1) {
    return first[0] === second[0];
  }
  return editDistanceAtMostOne(first, second);
}

function compareNames(registeredName, extractedName) {
  const registered = nameTokens(registeredName);
  const extracted = nameTokens(extractedName);
  if (!registered.length || !extracted.length) return "unable_to_read";

  const unmatchedRegistered = new Set(registered.map((_, index) => index));
  const unmatchedExtracted = new Set(extracted.map((_, index) => index));
  const pairs = [];

  for (const exactPass of [true, false]) {
    for (const extractedIndex of [...unmatchedExtracted]) {
      const token = extracted[extractedIndex];
      const registeredIndex = [...unmatchedRegistered].find(index => (
        exactPass
          ? registered[index] === token
          : nameTokensMatch(registered[index], token)
      ));
      if (registeredIndex === undefined) continue;
      pairs.push([registeredIndex, extractedIndex]);
      unmatchedRegistered.delete(registeredIndex);
      unmatchedExtracted.delete(extractedIndex);
    }
  }

  if (!pairs.length) return "mismatch";
  if (unmatchedExtracted.size > 0) return "mismatch";
  const matchedFullTokens = pairs.filter(([registeredIndex, extractedIndex]) =>
    registered[registeredIndex].length > 1 && extracted[extractedIndex].length > 1
  ).length;
  const registeredCoverage = pairs.length / registered.length;
  const completeWithInitials = unmatchedRegistered.size === 0;
  const enoughIndependentTokens = (
    matchedFullTokens >= 2 && registeredCoverage >= 2 / 3
  ) || (
    completeWithInitials && matchedFullTokens >= 1
  );
  if (enoughIndependentTokens) return "match";
  return "partial_match";
}

function evaluateIdentityExtraction({ extraction, fullName, birthdate, idType, identityDocumentNumber }) {
  const nameComparable = nameScript(fullName) === "latin" && nameScript(extraction.fullName) === "latin";
  const nameStatus = nameComparable
    ? compareNames(fullName, extraction.fullName)
    : extraction.fieldStatus?.fullName === "extracted" ? "mismatch" : "unable_to_read";
  const identityMatch = matchIdentityData({
    registeredName: nameComparable ? fullName : null,
    registeredDateOfBirth: birthdate,
    registeredDocumentNumber: identityDocumentNumber,
    extractedName: nameComparable ? extraction.fullName : null,
    extractedDateOfBirth: extraction.dateOfBirth,
    extractedDocumentNumber: extraction.documentNumber,
    idType,
  });
  const status = (field, matched) => extraction.fieldStatus?.[field] === "extracted"
    ? (matched ? "match" : "mismatch")
    : "unable_to_read";
  const checks = {
    nameMatch: nameStatus === "match",
    dateOfBirthMatch: identityMatch.dateOfBirthMatch,
    documentNumberMatch: identityMatch.documentNumberMatch,
    name: { status: nameStatus },
    dateOfBirth: { status: status("dateOfBirth", identityMatch.dateOfBirthMatch) },
    documentNumber: { status: status("documentNumber", identityMatch.documentNumberMatch) },
  };
  const fieldChecks = [checks.name, checks.dateOfBirth, checks.documentNumber];
  const overallStatus = fieldChecks.some(check => check.status === "unable_to_read")
    ? "unable_to_verify"
    : fieldChecks.some(check => check.status === "mismatch")
      ? "mismatch"
      : fieldChecks.some(check => check.status === "partial_match")
        ? "partial_match"
        : "verified";
  const prototypePassed = (
    checks.dateOfBirth.status === "match"
    && checks.documentNumber.status === "match"
  );
  return {
    verified: overallStatus === "verified",
    prototypePassed,
    overallStatus,
    checks,
    extractedIdentity: {
      fullName: extraction.fullName || null,
      dateOfBirth: extraction.dateOfBirth || null,
      documentNumber: extraction.documentNumber || null,
    },
  };
}

const extractIdentityDocuments = createOpenAIIdentityExtractor();

async function verifyIdentityDocument({ filePaths, fullName, birthdate, idType, identityDocumentNumber, extractor = extractIdentityDocuments }) {
  const extraction = await extractor({ filePaths, idType });
  return evaluateIdentityExtraction({ extraction, fullName, birthdate, idType, identityDocumentNumber });
}

module.exports = {
  compareNames,
  evaluateIdentityExtraction,
  extractIdentityDocuments,
  verifyIdentityDocument,
};
