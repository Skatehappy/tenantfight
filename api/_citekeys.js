// api/_citekeys.js — citation extraction + normalization shared by the build script and the
// runtime lint. No imports, so the build script can load it before _verified-citations.json exists.
export const STATE_ABBR = {
  'california': 'CA', 'texas': 'TX', 'florida': 'FL', 'new york': 'NY', 'illinois': 'IL',
  'pennsylvania': 'PA', 'ohio': 'OH', 'georgia': 'GA', 'north carolina': 'NC', 'arizona': 'AZ',
};
export const stateAbbr = s => STATE_ABBR[String(s || '').trim().toLowerCase()] || (/^[A-Z]{2}$/.test(String(s || '').trim()) ? String(s).trim() : '');

const CASE_SKIP = new Set(['in', 'under', 'yes', 'see', 'the', 'inc', 'llc', 'co', 'corp', 'if', 'and', 'when', 'as', 'per', 'cf', 'also', 'after', 'because', 'following', 'landmark', 'court', 'case', 'courts', 'decision', 'ruling', 'holding']);

// section number core: "92.331(b)" -> "92.331", "235-b" stays, "44-7-14.1" stays
const secCore = tok => {
  const t = String(tok).replace(/[–—]/g, '-').replace(/\(.*$/, '').replace(/[.,;:\-/]+$/, '');
  const m = t.match(/^\d+(?:[.\-/]\d+)*(?:-[A-Za-z](?![A-Za-z]))?/);
  return m ? m[0].replace(/[.\-/]+$/, '') : '';
};

const REPORTERS = String.raw`(?:Cal\.\s?(?:App\.\s?)?(?:2d|3d|4th|5th)|Cal\.\s?Rptr\.(?:\s?[23]d)?|N\.Y\.(?:\s?[23]d)?|A\.D\.\s?[23]d|N\.Y\.S\.(?:\s?[23]d)?|S\.W\.\s?[23]d|So\.\s?[23]d|N\.E\.(?:\s?[23]d)?|S\.E\.(?:\s?2d)?|P\.\s?[23]d|A\.\s?[23]d|U\.S\.|S\.\s?Ct\.|F\.\s?(?:[23]d|4th)|F\.\s?Supp\.(?:\s?[23]d)?|Ill\.\s?(?:App\.\s?)?(?:2d|3d)|Pa\.(?:\s?Super\.)?|Ohio\s?St\.\s?[23]d|Ohio\s?App\.\s?[23]d|Ga\.(?:\s?App\.)?|N\.C\.(?:\s?App\.)?|Ariz\.(?:\s?App\.)?|Fla\.(?:\s?[23]d)?)`;

// Returns [{ key, raw, index }]. inheritIlcs: when building from the log, bare "735/1.4" after an
// ILCS cite inherits that chapter.
export function extractCitations(text, { inheritIlcs = false } = {}) {
  const out = [];
  const add = (key, raw, index) => { if (key && key.length > 2) out.push({ key, raw: raw.trim(), index }); };
  const s = String(text || '');

  // plural: "§§ 92.331, 92.333", "§§ 1941-1941.1"
  for (const m of s.matchAll(/§§\s*(\d[^\s;),]*(?:\s*(?:,|and|&)\s*(?:§\s*)?\d[^\s;),]*)*)/g)) {
    for (const part of m[1].split(/\s*(?:,|and|&)\s*(?:§\s*)?/)) add('S:' + secCore(part), m[0], m.index);
  }
  // singular: "§ 1942", "§1954", "Section 1942.5" (word form needs a dot/hyphen or 3+ digits so "Section 8" is not a hit)
  for (const m of s.matchAll(/(?<!§)§\s*(\d[^\s;,)]*)/g)) add('S:' + secCore(m[1]), m[0], m.index);
  for (const m of s.matchAll(/\b[Ss]ection\s+(\d{3,}[\w.\-–]*|\d+[.\-–]\d[\w.\-–]*)/g)) add('S:' + secCore(m[1]), m[0], m.index);

  // Illinois Compiled Statutes: "765 ILCS 721/5", "735 ILCS 5/9-101"
  let lastChapter = null;
  for (const m of s.matchAll(/\b(\d+)\s*ILCS\s*(\d+)(?:\/([\d.\-]+))?(?:\/([\d.\-]+))?/g)) {
    lastChapter = m[1];
    add('I:' + [m[1], m[2], m[3], m[4]].filter(Boolean).join('/'), m[0], m.index);
  }
  if (inheritIlcs && lastChapter) {
    for (const m of s.matchAll(/(?<![\w/])(\d{3})\/([\d.]+)(?![\w/])/g)) add('I:' + lastChapter + '/' + m[1] + '/' + m[2], m[0], m.index);
  }

  // "Property Code Chapter 92", "Landlord and Tenant Act Article 2"
  for (const m of s.matchAll(/\b(?:[A-Z][\w.&]*\s+){1,4}(?:Chapter|Ch\.|Article|Art\.)\s+(\d+[A-Z]?)\b/g)) add('CH:' + m[1], m[0], m.index);

  // case names: "Green v. Superior Court"
  for (const m of s.matchAll(/\b((?:[A-Z][A-Za-z'&.\-]*\s+){0,3}[A-Z][A-Za-z'&\-]*)\.?\s+v\.\s+([A-Z][A-Za-z'&\-]+)/g)) {
    const pl = m[1].split(/\s+/).map(w => w.replace(/[.,]/g, '')).filter(w => w && !CASE_SKIP.has(w.toLowerCase()));
    const name = (pl[0] || m[2]).toLowerCase();
    if (name.length > 2) add('C:' + name, m[0], m.index);
  }
  // reporter cites: "10 Cal.3d 616", "47 N.Y.2d 316"
  for (const m of s.matchAll(new RegExp(String.raw`\b(\d{1,4})\s+(${REPORTERS})\s+(\d{1,4})\b`, 'g'))) {
    add('R:' + (m[1] + m[2] + m[3]).toLowerCase().replace(/[\s.]/g, ''), m[0], m.index);
  }
  return out;
}

