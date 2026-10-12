const { extractDateOfBirth } = require("./dateExtractor");
const { isValidDocumentNumber, normalizeDocumentNumber } = require("./documentNumberExtractor");
const { normalizeNameForComparison } = require("./identityMatcher");
const { normalizeOCRText } = require("./ocrTextNormalizer");

const identityExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fullName", "dateOfBirth", "documentNumber"],
  properties: {
    fullName: { type: ["string", "null"] },
    dateOfBirth: { type: ["string", "null"] },
    documentNumber: { type: ["string", "null"] },
  },
};

const identityFields = ["fullName", "dateOfBirth", "documentNumber"];

function isISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validateIdentityPayload(payload, documentType) {
  if (
    !payload
    || typeof payload !== "object"
    || Array.isArray(payload)
    || Object.keys(payload).length !== identityFields.length
    || identityFields.some(field => !Object.hasOwn(payload, field))
    || identityFields.some(field => payload[field] !== null && typeof payload[field] !== "string")
  ) {
    throw Object.assign(new Error("OpenAI returned an invalid identity extraction response."), {
      code: "OPENAI_INVALID_RESPONSE",
    });
  }

  const rawName = typeof payload.fullName === "string" ? normalizeOCRText(payload.fullName).trim() : "";
  const fullName = rawName
    && /\p{Script=Latin}/u.test(rawName)
    && !/\d/u.test(rawName)
    && rawName.split(/\s+/).filter(Boolean).length >= 2
    ? rawName
    : null;
  const dateOfBirth = typeof payload.dateOfBirth === "string"
    && isISODate(payload.dateOfBirth)
    && extractDateOfBirth(payload.dateOfBirth) === payload.dateOfBirth
    ? payload.dateOfBirth
    : null;
  const normalizedNumber = normalizeDocumentNumber(payload.documentNumber);
  const documentNumber = isValidDocumentNumber(documentType, normalizedNumber) ? normalizedNumber : null;

  return {
    fullName,
    dateOfBirth,
    documentNumber,
    fieldStatus: {
      fullName: fullName ? "extracted" : "unable_to_read",
      dateOfBirth: dateOfBirth ? "extracted" : "unable_to_read",
      documentNumber: documentNumber ? "extracted" : "unable_to_read",
    },
  };
}

function mergeIdentityExtractions(extractions, documentType) {
  const merged = { fullName: null, dateOfBirth: null, documentNumber: null };
  const fieldStatus = {};

  for (const field of identityFields) {
    const candidates = extractions.map(result => result[field]).filter(Boolean);
    const canonical = candidates.map(value => field === "fullName"
      ? normalizeNameForComparison(value)
      : value);
    const unique = new Set(canonical);
    if (unique.size === 1 && candidates.length) merged[field] = candidates[0];
    fieldStatus[field] = merged[field] ? "extracted" : "unable_to_read";
  }

  if (!["nic", "license", "passport"].includes(documentType)) {
    throw Object.assign(new Error("Unsupported identity document type."), { code: "OCR_INVALID_REQUEST" });
  }
  return { documentType, ...merged, fieldStatus };
}

module.exports = {
  identityExtractionSchema,
  identityFields,
  mergeIdentityExtractions,
  validateIdentityPayload,
};
