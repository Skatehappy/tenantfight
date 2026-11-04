// api/_numfacts.js — dollar / percent / day-count extraction shared by the build script (which
// collects the figures that appear in verified state data) and the runtime numeric-claims check.
// Digits ("30 days", "$500", "10%") AND spelled-out forms are recognised: "thirty days", "thirty (30) days",
// "ten percent", "five hundred dollars", hyphenated compounds ("thirty-six days"), "one hundred twenty days".
// Months and years are NOT extracted: see the note at the bottom. No imports.
const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const WORD_ALT = [...Object.keys(ONES), ...Object.keys(TENS), 'hundred', 'thousand'].join('|');
// a run of number words: "thirty", "thirty-six", "one hundred and twenty", "five hundred"
const PH = `(?:${WORD_ALT})(?:[-\\s]+(?:and\\s+)?(?:${WORD_ALT}))*`;

// Spelled-out number -> value, or NaN when the run is not a well-formed number ("ten twenty", "five six").
export function wordsToNumber(phrase) {
  const toks = String(phrase).toLowerCase().split(/[-\s]+/).filter(Boolean);
  let total = 0, cur = 0, last = '';
  for (const t of toks) {
    if (t === 'and') { if (last !== 'hundred' && last !== 'thousand') return NaN; last = 'and'; continue; }
    if (t in ONES) { const v = ONES[t]; if (t === 'zero' && toks.length > 1) return NaN; if (last === 'ones' || last === 'teen' || last === 'tens' && v >= 10) return NaN; if (last === 'teen' || last === 'ones') return NaN; cur += v; last = v >= 10 ? 'teen' : 'ones'; continue; }
    if (t in TENS) { if (last === 'ones' || last === 'teen' || last === 'tens') return NaN; cur += TENS[t]; last = 'tens'; continue; }
    if (t === 'hundred') { if (!cur || cur >= 100 || last === 'tens' || last === 'teen') return NaN; cur *= 100; last = 'hundred'; continue; }
    if (t === 'thousand') { if (!cur && !total) return NaN; total += (cur || 1) * 1000; cur = 0; last = 'thousand'; continue; }
    return NaN;
  }
  return total + cur;
}
const num = w => { const k = String(w).toLowerCase(); return /^[\d.]+$/.test(k) ? parseFloat(k) : wordsToNumber(k); };

const DAYS = `\\b(${PH}|\\d+)(?:\\s*\\((\\d+)\\))?(?:-|\\s+)(?:(?:business|calendar|court|consecutive)\\s+)?days?\\b`;
const PCT_W = `\\b(${PH})(?:\\s*\\((\\d+(?:\\.\\d+)?)\\s*%?\\))?\\s*(?:%|percent\\b|per\\s?cent\\b)`;
const USD_W = `\\b(${PH})\\s+(?:(?:US|U\\.S\\.)\\s+)?dollars?\\b`;

// Returns [{ kind: '$' | 'd' | '%', value, raw, index }]
export function figures(text) {
  const s = String(text || ''), out = [];
  const push = (kind, m, w, paren) => {
    const v = num(w); const p = paren === undefined ? NaN : parseFloat(paren);
    if (Number.isFinite(v)) out.push({ kind, value: v, raw: m[0], index: m.index });
    // "thirty (31) days": the digits and the words disagree, so BOTH are claims and both must be verified
    if (Number.isFinite(p) && p !== v) out.push({ kind, value: p, raw: m[0], index: m.index });
  };
  for (const m of s.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)) out.push({ kind: '$', value: parseFloat(m[1].replace(/,/g, '')), raw: m[0], index: m.index });
  for (const m of s.matchAll(new RegExp(USD_W, 'gi'))) push('$', m, m[1]);
  for (const m of s.matchAll(new RegExp(DAYS, 'gi'))) push('d', m, m[1], m[2]);
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s?(?:%|percent\b|per\s?cent\b)/gi)) out.push({ kind: '%', value: parseFloat(m[1]), raw: m[0], index: m.index });
  for (const m of s.matchAll(new RegExp(PCT_W, 'gi'))) push('%', m, m[1], m[2]);
  return out;
}

export function figureSets(text) {
  const d = new Set(), dollars = new Set(), pct = new Set();
  for (const f of figures(text)) (f.kind === 'd' ? d : f.kind === '$' ? dollars : pct).add(f.value);
  return { days: [...d].sort((a, b) => a - b), dollars: [...dollars].sort((a, b) => a - b), percents: [...pct].sort((a, b) => a - b) };
}

// Months / years are deliberately not figures. "Six months" / "two years" windows appear all over the published
// pages and VERIFICATION_LOG*.md as limitation periods, lease terms and look-back windows, and the verified sets,
// the dated figDates map and gate A15's strict page mapping are keyed only by $ / % / day. Adding a month/year kind
// would either flag verified content as unverified (false drops) or demand hundreds of new log entries.
