const documentNames = {
  nic: "Sri Lankan National Identity Card",
  license: "Sri Lankan Driving Licence",
  passport: "passport information page",
};

function createIdentityPrompt(documentType, imageIndex, imageCount) {
  const documentName = documentNames[documentType];
  if (!documentName) {
    throw Object.assign(new Error("Unsupported identity document type."), { code: "OCR_INVALID_REQUEST" });
  }

  const sideDescription = documentType === "passport"
    ? "the identity information page"
    : imageCount === 2
      ? `image ${imageIndex + 1} of ${imageCount} (one card side)`
      : "the supplied document image";

  return [
    `Read the English text on this ${documentName}, ${sideDescription}.`,
    "Return only the requested identity fields from visible document text, regardless of image rotation or layout.",
    "Do not infer, complete, correct, or fabricate any value. If a value is missing, unreadable, or ambiguous, return null for it.",
    "Ignore surrounding non-English text.",
    "Return the full English name only when at least two name tokens are clearly legible.",
    "Return date of birth only when its label or context clearly identifies it; format it as YYYY-MM-DD.",
    "Return the document number only when clearly legible and appropriate for this document type.",
    "Do not return issue dates, expiry dates, addresses, or any other fields.",
  ].join(" ");
}

module.exports = { createIdentityPrompt };
