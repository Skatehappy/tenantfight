// api/_citelint.js — citation lock for generated letters.
//
// Two jobs:
//   1. lockBlock(state): the server-side "cite ONLY these verified authorities" block
//      appended to the system prompt (list comes from api/_verified-citations.json,
//      built from VERIFICATION_LOG*.md by scripts/build-verified-citations.mjs).
//   2. lintLetter(text, state) / stripViolations(text, violations): after generation, pull
//      every statute / rule / case citation out of the output and flag any that is not in the
//      verified set for the user's state; the caller regenerates once, then strips sentences.
//
// Files prefixed with "_" are not routed by Vercel, so this is not an endpoint.
import VERIFIED from './_verified-citations.json' with { type: 'json' };

import { STATE_ABBR, stateAbbr, extractCitations } from './_citekeys.js';
export { STATE_ABBR, stateAbbr, extractCitations };

const SETS = {};
function setFor(abbr) {
  if (!SETS[abbr]) {
    const st = VERIFIED.states[abbr];
    const keys = new Set([...(st ? st.keys : []), ...VERIFIED.federal.keys]);
    SETS[abbr] = keys;
  }
  return SETS[abbr];
}

export function citeAllowed(key, abbr) {
  const set = setFor(abbr);
  if (set.has(key)) return true;
  // act-level ILCS cite ("765 ILCS 721") is fine when a section of that act is verified
  if (key.startsWith('I:') && key.split('/').length <= 2) for (const k of set) if (k.startsWith(key + '/')) return true;
  return false;
}

export function lockBlock(state) {
  const abbr = stateAbbr(state);
  const cites = [...(abbr && VERIFIED.states[abbr] ? VERIFIED.states[abbr].cites : []), ...VERIFIED.federal.cites];
  const list = cites.length ? cites.map(c => `- ${c}`).join('\n') : '- (none on file)';
  return `\n\nCITATION LOCK (server-enforced):\nYou may cite ONLY the following verified authorities${abbr ? ' for ' + state : ''}:\n${list}\n\nCite nothing else: no other statute, regulation, ordinance, court rule, or case, even if you are confident it is correct. Any citation not on this list will be removed from the letter. Where no listed authority fits a point, state the duty or remedy in plain words without a citation. Examples elsewhere in these instructions are illustrative only and do not authorize any citation that is not on this list.`;
}

// Violations = citations in `text` that are not in the verified set for `state`.
export function lintLetter(text, state) {
  const abbr = stateAbbr(state);
  const found = extractCitations(text);
  const violations = found.filter(c => !citeAllowed(c.key, abbr));
  return { found, violations };
}

function sentenceSpans(s) {
  const spans = []; let start = 0;
  const re = /[.!?]["')\]]?\s+(?=[A-Z"(§])/g; let m;
  while ((m = re.exec(s))) {
    const word = s.slice(start, m.index + 1).split(/[\s—–/(]+/).pop();
    if (/\..*\.$/.test(word) || /^\(?([A-Z][a-z]{0,4}|[a-z]{1,3}|[A-Z](\.[A-Z])*|§+|\d+[A-Za-z]?)\.$/.test(word)) continue;
    spans.push([start, m.index + m[0].length]); start = m.index + m[0].length;
  }
  spans.push([start, s.length]);
  return spans;
}

// Remove every sentence that contains a violating citation. Line structure is kept; a line that
// ends up empty is dropped.
export function stripViolations(text, violations) {
  if (!violations.length) return text;
  const out = [];
  for (const line of String(text).split('\n')) {
    const bad = violations.some(v => line.includes(v.raw)) ? extractCitations(line).filter(c => violations.some(v => v.key === c.key)) : [];
    if (!bad.length) { out.push(line); continue; }
    const kept = sentenceSpans(line).filter(([a, b]) => !bad.some(c => c.index >= a && c.index < b)).map(([a, b]) => line.slice(a, b)).join('').trim();
    if (kept) out.push(kept);
  }
  return out.join('\n');
}

// What gets logged: counts and statutory citation strings only. No letter text, no case names
// (a case-name regex hit could in principle be a party name), nothing from the tenant's inputs.
export function logRecord(abbr, kind, found, violations, extra = {}) {
  return JSON.stringify({
    evt: 'citelint', state: abbr || 'unknown', kind, found: found.length, violations: violations.length,
    cites: violations.filter(v => /^(S|I|CH):/.test(v.key)).map(v => v.raw.slice(0, 40)),
    caseHits: violations.filter(v => /^[CR]:/.test(v.key)).length, ...extra,
  });
}
