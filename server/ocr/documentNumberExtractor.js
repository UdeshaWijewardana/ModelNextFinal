const { normalizeOCRText } = require("./ocrTextNormalizer");

const rules = {
  nic: {
    labels: ['NIC', 'NATIONAL ID', 'IDENTITY CARD', 'හැඳුනුම්පත් අංකය', 'அடையாள அட்டை எண்'],
    patterns: [/(?<![A-Z0-9])\d{9}[VX](?![A-Z0-9])/gi, /(?<![A-Z0-9])\d{12}(?![A-Z0-9])/g],
    validate: value => /^(?:\d{9}[VX]|\d{12})$/.test(value),
  },
  license: {
    labels: ['DRIVING LICENCE', 'DRIVING LICENSE', 'LICENCE NO', 'LICENSE NO', 'DL NO', 'රියදුරු බලපත්‍ර අංකය', 'ஓட்டுநர் உரிம எண்'],
    patterns: [/(?<![A-Z0-9])[A-Z]\d{7}(?![A-Z0-9])/gi],
    validate: value => /^[A-Z]\d{7}$/.test(value),
  },
  passport: {
    labels: ['PASSPORT NO', 'PASSPORT NUMBER', 'DOCUMENT NO', 'ගමන් බලපත්‍ර අංකය', 'கடவுச்சீட்டு எண்'],
    patterns: [/(?<![A-Z0-9])[A-Z][0-9]{7}(?![A-Z0-9])/gi],
    validate: value => /^[A-Z][0-9]{7}$/.test(value),
  },
};

const normalizeDocumentNumber = value => typeof value === 'string' ? value.toUpperCase().replace(/[\s.-]/g, '') : '';
const isValidDocumentNumber = (type, value) => Boolean(rules[type]?.validate(normalizeDocumentNumber(value)));

function extractDocumentNumber(text, type) {
  const rule = rules[type];
  if (!rule) return null;
  const normalized = normalizeOCRText(text).toUpperCase();
  const lines = normalized.split('\n');
  const label = line => rule.labels.some(value => line.includes(value.toUpperCase()))
    || NUMBER_LABEL_FOR_TYPE[type].test(line);
  const labelIndexes = lines.map((line, index) => label(line) ? index : -1).filter(index => index >= 0);
  const labeledIndexes = new Set();
  for (const index of labelIndexes) {
    for (const nearby of [index - 1, index, index + 1]) {
      if (nearby >= 0 && nearby < lines.length) labeledIndexes.add(nearby);
    }
  }
  const labeledLines = [...labeledIndexes].map(index => lines[index]);
  const collect = sourceLines => {
    const matches = [];
    for (const line of sourceLines) {
      const candidates = [line, line.replace(NUMBER_LABEL_FOR_TYPE[type], ' ')];
      for (const candidate of candidates) for (const pattern of rule.patterns) {
        pattern.lastIndex = 0;
        for (const match of normalizeDocumentNumber(candidate).matchAll(pattern)) matches.push(normalizeDocumentNumber(match[0]));
      }
    }
    return [...new Set(matches.filter(value => rule.validate(value)))];
  };
  const labeled = collect(labeledLines);
  if (labeled.length === 1) return labeled[0];
  if (labeled.length > 1) return null;
  const anywhere = collect(lines);
  return anywhere.length === 1 ? anywhere[0] : null;
}

const NUMBER_LABEL_FOR_TYPE = {
  nic: /\b(?:nic|national\s+identity(?:\s+card)?|identity\s+card|id)\s*(?:no\.?|number|#)?\b/i,
  license: /\b(?:driving\s+licen[cs]e|licen[cs]e|dl|document|id)\s*(?:no\.?|number|#)?\b/i,
  passport: /\b(?:passport|document|id)\s*(?:no\.?|number|#)?\b/i,
};

module.exports = { extractDocumentNumber, normalizeDocumentNumber, isValidDocumentNumber };
