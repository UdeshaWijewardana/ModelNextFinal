function normalizeOCRText(text) {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .trim();
}

module.exports = {
  normalizeOCRText,
};