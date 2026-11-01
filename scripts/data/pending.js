// Pages restored as KEEP because they earn search traffic (GSC, 2026-11-01) whose
// citations are not yet in VERIFICATION_LOG. page-pending.json maps "state/topic" to
// citation strings; every sentence containing one is held back from that page (content
// JSON and state data alike) until the citation is verified and its entry removed.
import fs from 'fs';
import path from 'path';

const PAGE_PENDING = JSON.parse(fs.readFileSync(path.join('scripts', 'data', 'page-pending.json'), 'utf8'));

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

function strip(value, list) {
  if (typeof value === 'string') {
    if (!list.some(c => value.includes(c))) return value;
    return sentences(value).filter(x => !list.some(c => x.includes(c))).join('').trim();
  }
  if (Array.isArray(value)) return value.map(x => strip(x, list)).filter(x => x !== '' && !(x && typeof x === 'object' && 'a' in x && !x.a));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, strip(x, list)]));
  return value;
}

export function holdBack(key, value) {
  const list = PAGE_PENDING[key];
  return list && list.length && value ? strip(value, list) : value;
}
