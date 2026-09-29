const { normalizeOCRText } = require("./ocrTextNormalizer");

const DATE_PATTERN = /(?<![A-Za-z0-9])(?:(\d{2})([/.\-])(\d{2})\2(\d{4})|(\d{4})-(\d{2})-(\d{2}))(?![A-Za-z0-9])/g;
const DOB_FIELD_PREFIX = /^\s*(?:date\s+of\s+birth|birth\s+date|dob)\s*[:#-]\s*$/i;
const UNRELATED_FIELD_PREFIX = /^\s*(?:nic|phone|telephone|mobile|document|passport|id|reference|registration)(?:\s+(?:number|no\.?))?\s*[:#-]\s*$/i;

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
  const dates = [];
  const labeledDates = [];
  let match;

  while ((match = DATE_PATTERN.exec(normalizedText)) !== null) {
    const day = Number(match[1] || match[7]);
    const month = Number(match[3] || match[6]);
    const year = Number(match[4] || match[5]);

    if (!isValidDate(year, month, day)) {
      continue;
    }

    const lineStart = normalizedText.lastIndexOf("\n", match.index - 1) + 1;
    const fieldPrefix = normalizedText.slice(lineStart, match.index);

    // Avoid treating values labeled as identifiers or contact/document numbers as dates.
    if (UNRELATED_FIELD_PREFIX.test(fieldPrefix)) {
      continue;
    }

    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    dates.push(date);

    if (DOB_FIELD_PREFIX.test(fieldPrefix)) {
      labeledDates.push(date);
    }
  }

  // Prefer an explicitly labeled DOB; otherwise only accept one unambiguous date.
  const candidates = labeledDates.length > 0 ? labeledDates : dates;
  const uniqueDates = [...new Set(candidates)];

  return uniqueDates.length === 1 ? uniqueDates[0] : null;
}

module.exports = {
  extractDateOfBirth,
};