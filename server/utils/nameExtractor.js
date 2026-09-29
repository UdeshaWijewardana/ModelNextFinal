const { normalizeOCRText } = require("./ocrTextNormalizer");

const NAME_LABEL = /^\s*(?:full\s+name|name)\s*[:#-]\s*(.*?)\s*$/i;
const FOLLOWING_FIELD = /\s+(?:date\s+of\s+birth|birth\s+date|dob|nic|national\s+id|phone|telephone|mobile|document(?:\s+number)?|passport(?:\s+number)?|id(?:\s+number)?|gender|nationality|address)\s*[:#-].*$/i;

function extractFullName(text) {
  const normalizedText = normalizeOCRText(text);

  for (const line of normalizedText.split("\n")) {
    const match = line.match(NAME_LABEL);

    if (!match) {
      continue;
    }

    const fullName = normalizeOCRText(match[1].replace(FOLLOWING_FIELD, ""));

    if (fullName && /\p{L}/u.test(fullName)) {
      return fullName;
    }
  }

  return null;
}

module.exports = {
  extractFullName,
};