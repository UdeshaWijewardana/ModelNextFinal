const { normalizeOCRText } = require("./ocrTextNormalizer");

const DATE_PATTERN = /(?<![A-Za-z0-9])(?:(\d{2})([/.\-])(\d{2})\2(\d{4})|(\d{4})([/.\-])(\d{2})\6(\d{2}))(?![A-Za-z0-9])/g;
const DOB_LABEL = /(?:date\s+of\s+birth|birth\s+date|dob|උපන්\s+දිනය|பிறந்த\s+(?:தேதி|திகதி))/iu;
const DOB_FIELD_PREFIX = /^\s*(?:date\s+of\s+birth|birth\s+date|dob|උපන්\s+දිනය|பிறந்த\s+(?:தேதி|திகதி))(?:\s*[/|]\s*(?:උපන්\s+දිනය|பிறந்த\s+(?:தேதி|திகதி)))*\s*[:#-]?\s*$/iu;
const UNRELATED_FIELD_PREFIX = /^\s*(?:nic|phone|telephone|mobile|document|passport|id|reference|registration)(?:\s+(?:number|no\.?))?\s*[:#-]\s*$/i;
const OTHER_DATE_LABEL = /\b(?:issue|issuance|expiry|expiration|registration)\s+date\b/i;

function isValidDate(year, month, day) {
  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    return false;
  }

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day >= 1 && day <= daysInMonth[month - 1];
}

function extractDateOfBirth(text) {
  const normalizedText = normalizeOCRText(text);
  DATE_PATTERN.lastIndex = 0;
  const lines = normalizedText.split("\n");
  const dates = [];
  const labeledDates = [];
  let match;

  while ((match = DATE_PATTERN.exec(normalizedText)) !== null) {
    const day = Number(match[1] || match[8]);
    const month = Number(match[3] || match[7]);
    const year = Number(match[4] || match[5]);

    if (!isValidDate(year, month, day)) {
      continue;
    }

    const lineIndex = normalizedText.slice(0, match.index).split("\n").length - 1;
    const line = lines[lineIndex] || "";
    const fieldPrefix = line.slice(0, match.index - (normalizedText.lastIndexOf("\n", match.index - 1) + 1));

    // Avoid treating values labeled as identifiers or contact/document numbers as dates.
    if (UNRELATED_FIELD_PREFIX.test(fieldPrefix)) {
      continue;
    }
    const relatedLabels = lines
      .map((labelLine, index) => ({
        index,
        isDob: DOB_LABEL.test(labelLine),
        isOther: OTHER_DATE_LABEL.test(labelLine),
      }))
      .filter(label => label.isDob || label.isOther)
      .map(label => ({ ...label, distance: Math.abs(label.index - lineIndex) }));
    const closestDistance = relatedLabels.length ? Math.min(...relatedLabels.map(label => label.distance)) : Infinity;
    const closestLabels = relatedLabels.filter(label => label.distance === closestDistance);
    if (closestLabels.length && !closestLabels.every(label => label.isDob)) continue;
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    dates.push(date);
    if (DOB_FIELD_PREFIX.test(line) || closestLabels.length > 0) labeledDates.push(date);
  }

  // Prefer an explicitly labeled DOB; otherwise only accept one unambiguous date.
  const candidates = labeledDates.length > 0 ? labeledDates : dates;
  const uniqueDates = [...new Set(candidates)];

  return uniqueDates.length === 1 ? uniqueDates[0] : null;
}

module.exports = {
  extractDateOfBirth,
};
