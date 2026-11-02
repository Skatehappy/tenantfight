// api/_numfacts.js — dollar / percent / day-count extraction shared by the build script (which
// collects the figures that appear in verified state data) and the runtime numeric-claims check.
// No imports.
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60, ninety: 90 };
const num = w => { const k = String(w).toLowerCase(); return WORDS[k] ?? parseFloat(k); };

// Returns [{ kind: '$' | 'd' | '%', value, raw, index }]
export function figures(text) {
  const s = String(text || ''), out = [];
  for (const m of s.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)) out.push({ kind: '$', value: parseFloat(m[1].replace(/,/g, '')), raw: m[0], index: m.index });
  for (const m of s.matchAll(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|forty|sixty|ninety)(?:-|\s+)(?:(?:business|calendar|court|consecutive)\s+)?days?\b/gi)) {
    const v = num(m[1]); if (Number.isFinite(v)) out.push({ kind: 'd', value: v, raw: m[0], index: m.index });
  }
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s?(?:%|percent\b)/gi)) out.push({ kind: '%', value: parseFloat(m[1]), raw: m[0], index: m.index });
  return out;
}

export function figureSets(text) {
  const d = new Set(), dollars = new Set(), pct = new Set();
  for (const f of figures(text)) (f.kind === 'd' ? d : f.kind === '$' ? dollars : pct).add(f.value);
  return { days: [...d].sort((a, b) => a - b), dollars: [...dollars].sort((a, b) => a - b), percents: [...pct].sort((a, b) => a - b) };
}
