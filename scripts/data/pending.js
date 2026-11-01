// Verified-citations-only rule (2026-11-01): at build time every sentence that cites a
// statute, regulation or case not found in VERIFICATION_LOG.md / VERIFICATION_LOG-SEO-CONTENT.md
// is withheld from the page (content JSON and state data alike). Logging a verified citation
// and rebuilding brings its sentences back.
import fs from 'fs';

const LOG = ['VERIFICATION_LOG.md', 'VERIFICATION_LOG-SEO-CONTENT.md']
  .filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');

const core = x => (x.match(/\d[\d.\-–/:]*[A-Za-z]?(?:[.\-]\d+)*/) || [''])[0].replace(/[–]/g, '-').replace(/[.\-/:]+$/, '');
const CASE_SKIP = new Set(['in', 'under', 'yes', 'see', 'the', 'inc', 'llc', 'co', 'corp', 'if', 'and', 'when', 'as', 'per', 'cf', 'also', 'after', 'because', 'following', 'landmark', 'court', 'case', 'courts', 'decision', 'ruling', 'holding']);
function citations(text) {
  const keys = new Map(); // key -> sample
  const canon = k => {
    if (!k || !k.startsWith('S:')) return k;
    let v = k.slice(2).replace(/^(PA|FED)\d+-(?=\d)/, '');            // "40 P.S. § 1171.5" / "29 U.S.C. § 1132" → section only
    if (/^\d+\.\d+[A-Za-z]?-\d+\.\d+/.test(v)) v = v.split('-')[0];       // ranges "991.2141-991.2193" → first section
    return 'S:' + v;
  };
  const add = (k, s) => { k = canon(k); if (k && !keys.has(k)) keys.set(k, s.trim().slice(0, 60)); };
  const pats = [
    [/§§?\s*(\d[\w.\-–:/]*)/g, m => 'S:' + core(m[1])],
    [/\b(\d+)\s*ILCS\s*([\d/.\-]+)/g, m => 'S:' + m[1] + 'ILCS' + core(m[2])],
    [/\b(\d+)\s*(?:Pa\.\s*C\.\s*S\.|P\.\s*S\.)\s*(?:§+\s*)?(\d[\d.\-]*)?/g, m => 'S:PA' + m[1] + (m[2] ? '-' + core(m[2]) : '')],
    [/\b(?:R\.\s*C\.|ORC)\s*(?:§\s*)?(\d{3,4}\.\d+)/g, m => 'S:' + m[1]],
    [/\b(?:Fla\.\s*Stat\.|Tex\.\s*[A-Z][a-z]+\.?\s*Code|Insurance Law|Ins\.\s*Law|Code)\s+(?:§+\s*)?(\d[\d.\-]*\d)/g, m => 'S:' + core(m[1])],
    [/\bSection\s+(\d[\d.\-]*\d[A-Za-z]?)/g, m => 'S:' + core(m[1])],
    [/\b(?:Chapter|Ch\.)\s+(\d+[A-Z]?)\b/g, m => 'CH:' + m[1]],
    [/\b(?:Article|Art\.)\s+(\d+[A-Z-]*)\b/g, m => 'ART:' + m[1]],
    [/\b(?:Title)\s+(\d+[A-Z]?)\b/g, m => 'TITLE:' + m[1]],
    [/\b(\d+)\s*(?:U\.\s*S\.\s*C\.|USC|C\.\s*F\.\s*R\.|CFR)\s*(?:§+\s*)?(\d[\d.\-]*)?/g, m => 'S:FED' + m[1] + '-' + core(m[2] || '')],
    [/\b((?:[A-Z][A-Za-z'&.\-]*\s+){0,3}[A-Z][A-Za-z'&\-]*)\.?\s+v\.\s+([A-Z][A-Za-z'&\-]+)/g, m => {
      const pl = m[1].split(/\s+/).map(w => w.replace(/[.,]/g, '')).filter(w => w && !CASE_SKIP.has(w.toLowerCase()));
      const name = (pl[0] || m[2]).toLowerCase(); return name.length > 2 ? 'C:' + name : null;
    }],
  ];
  for (const [re, fn] of pats) for (const m of text.matchAll(re)) { const k = fn(m); if (k && !/^S:$|^S:FED\d+-$/.test(k) && k.length > 3) add(k, m[0]); }
  return keys;
}
function inLog(key, logText) {
  const [t, v] = [key.split(':')[0], key.slice(key.indexOf(':') + 1)];
  if (t === 'C') return new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(logText);
  const needle = v.replace(/^PA/, '').replace(/^FED/, '').replace(/ILCS/, ' ILCS ').split('-').filter(Boolean)[0] && v;
  const coreNum = v.replace(/^(PA|FED)/, '').replace(/ILCS/, '|');
  const parts = coreNum.split('|').map(p => p.replace(/^-/, '')).filter(Boolean);
  const last = parts.at(-1);
  if (!last) return false;
  const esc = last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (t === 'CH') return new RegExp('\\b(Chapter|Ch\\.)\\s*' + esc + '\\b', 'i').test(logText);
  if (t === 'ART') return new RegExp('\\b(Article|Art\\.)\\s*' + esc + '\\b', 'i').test(logText);
  if (t === 'TITLE') return new RegExp('\\bTitle\\s*' + esc + '\\b', 'i').test(logText);
  // short bare numbers ("§ 65", "§ 202") count as logged only WITH a section sign; longer cores (627.7011, 33-7-11) may appear bare
  if (/^\d{1,4}$/.test(last)) return new RegExp('§+\\s*' + esc + '(?![\\d.])').test(logText);
  return new RegExp('(^|[^\\d.])' + esc + '([^\\d]|$)').test(logText) && !!needle;
}

const cache = new Map();
function logged(key) {
  if (!cache.has(key)) {
    // bare ILCS act cites ("215 ILCS 180") are logged in that literal form
    const m = key.match(/^S:(\d+)ILCS(\d+)$/);
    cache.set(key, m ? new RegExp('\\b' + m[1] + '\\s*ILCS\\s*' + m[2] + '\\b').test(LOG) : inLog(key, LOG));
  }
  return cache.get(key);
}
export const unlogged = text => [...citations(text)].filter(([k]) => !logged(k)).map(([, s]) => s);

// Split on sentence ends, but not after abbreviations ("Ariz. Rev. Stat.", "v.", "N.C.").
function sentences(s) {
  const out = []; let start = 0;
  const re = /[.!?]["')\]]?\s+(?=[A-Z"(§])/g; let m;
  while ((m = re.exec(s))) {
    const word = s.slice(start, m.index + 1).split(/[\s—–/(]+/).pop();
    if (/\..*\.$/.test(word) || /^\(?([A-Z][a-z]{0,4}|[a-z]{1,3}|[A-Z](\.[A-Z])*|§+|\d+[A-Za-z]?)\.$/.test(word)) continue;
    out.push(s.slice(start, m.index + m[0].length)); start = m.index + m[0].length;
  }
  out.push(s.slice(start));
  return out;
}

function strip(value) {
  if (typeof value === 'string') {
    if (!unlogged(value).length) return value;
    return sentences(value).filter(x => !unlogged(x).length).join('').trim();
  }
  if (Array.isArray(value)) return value.map(strip).filter(x => x !== '' && !(x && typeof x === 'object' && 'a' in x && !x.a));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, strip(x)]));
  return value;
}

// key kept for call-site readability; the rule is the same for every page
export function holdBack(key, value) { return value ? strip(value) : value; }
