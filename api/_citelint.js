// api/_citelint.js — citation + numeric-claims lock for everything the model writes (letters and checklists).
//
// Three jobs:
//   1. lockBlock(state): the server-side "cite ONLY these verified authorities, use ONLY these figures"
//      block appended to the system prompt (list comes from api/_verified-citations.js, built from
//      VERIFICATION_LOG*.md and state-data.json by scripts/build-verified-citations.mjs).
//   2. lintLetter(text, state): pull every statute / rule / case citation out of the output and flag any
//      that is not in the verified set for the user's state. A section number alone is not enough: a
//      subsection the verified log never mentions ("§ 92.056(z)") is a violation too.
//   3. lintNumbers(text, state, userText): flag dollar / percent / day-count claims about the law that
//      are not in the verified state data and not supplied by the user (and the deposit-return deadline
//      when it contradicts the state's verified deadline).
// The caller regenerates once, then strips the offending sentences (stripUnverified / stripSentences).
//
// Files prefixed with "_" are not routed by Vercel, so this is not an endpoint.
import VERIFIED from './_verified-citations.js';
import { STATE_ABBR, stateAbbr, extractCitations } from './_citekeys.js';
import { figures } from './_numfacts.js';
export { STATE_ABBR, stateAbbr, extractCitations };

const SETS = {};
function setFor(abbr) {
  if (!SETS[abbr]) {
    const st = VERIFIED.states[abbr];
    const keys = new Set([...(st ? st.keys : []), ...VERIFIED.federal.keys]);
    const subs = {};
    for (const src of [st ? st.subs : {}, VERIFIED.federal.subs]) for (const [k, v] of Object.entries(src || {})) subs[k] = new Set([...(subs[k] || []), ...v]);
    SETS[abbr] = { keys, subs };
  }
  return SETS[abbr];
}

// A citation is allowed when its key is verified AND every subsection it names is on file for that key.
export function citeAllowed(c, abbr) {
  const key = typeof c === 'string' ? c : c.key;
  const { keys, subs } = setFor(abbr);
  if (!keys.has(key)) {
    // act-level ILCS cite ("765 ILCS 721") is fine when a section of that act is verified
    if (key.startsWith('I:') && key.split('/').length <= 2) for (const k of keys) if (k.startsWith(key + '/')) return true;
    return false;
  }
  const sub = typeof c === 'string' ? [] : (c.sub || []);
  if (!sub.length) return true;
  const on = subs[key];
  return !!on && sub.every(x => on.has(x));
}

function fmtCite(display, abbr) {
  const { keys, subs } = setFor(abbr);
  const ks = extractCitations(display, { inheritIlcs: true }).map(c => c.key).filter(k => keys.has(k));
  const on = new Set(); for (const k of ks) for (const s of subs[k] || []) on.add(s);
  return on.size ? `${display} (subsections on file: ${[...on].map(s => '(' + s + ')').join(' ')})` : `${display} (cite the section only, no subsection)`;
}

export function lockBlock(state) {
  const abbr = stateAbbr(state);
  const st = abbr && VERIFIED.states[abbr] ? VERIFIED.states[abbr] : null;
  const cites = [...(st ? st.cites : []), ...VERIFIED.federal.cites];
  const list = cites.length ? cites.map(c => `- ${fmtCite(c, abbr)}`).join('\n') : '- (none on file)';
  const n = st ? st.nums : null;
  const fmt = (a, f) => (a && a.length ? a.map(f).join(', ') : 'none on file');
  const figs = n ? `\n\nVERIFIED FIGURES${abbr ? ' for ' + state : ''} (dollar amounts, percentages and day counts you may state as the law's requirement):\n- days: ${fmt(n.days, x => x)}\n- dollars: ${fmt(n.dollars, x => '$' + x)}\n- percents: ${fmt(n.percents, x => x + '%')}\n- security deposit return deadline (days): ${fmt(n.depositDays, x => x)}` : '';
  return `\n\nCITATION LOCK (server-enforced):\nYou may cite ONLY the following verified authorities${abbr ? ' for ' + state : ''}:\n${list}\n\nCite nothing else: no other statute, regulation, ordinance, court rule, or case, even if you are confident it is correct, and name a subsection only where one is listed as on file. Any citation not on this list will be removed from the letter. Where no listed authority fits a point, state the duty or remedy in plain words without a citation. Examples elsewhere in these instructions are illustrative only and do not authorize any citation that is not on this list.${figs}\n\nDo not state any dollar amount, percentage, deadline or day count as what the law provides unless it is in the verified figures above or the user supplied it; amounts the user supplied, and totals computed from them, are fine. A sentence that states a legal figure not on the list will be removed.`;
}

// Citation violations: not in the verified set for `state`, or a subsection that is not on file.
export function lintLetter(text, state) {
  const abbr = stateAbbr(state);
  const found = extractCitations(text);
  const violations = found.filter(c => !citeAllowed(c, abbr)).map(c => ({ ...c, reason: setFor(abbr).keys.has(c.key) ? 'subsection' : 'unverified' }));
  return { found, violations };
}

// ---- sentence helpers
export function sentenceSpans(s) {
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

// Remove every sentence that contains a citation that fails citeAllowed(). Line structure is kept; a
// line that ends up empty is dropped.
export function stripUnverified(text, state) {
  const abbr = stateAbbr(state);
  const out = [];
  for (const line of String(text).split('\n')) {
    const bad = extractCitations(line).filter(c => !citeAllowed(c, abbr));
    if (!bad.length) { out.push(line); continue; }
    const kept = sentenceSpans(line).filter(([a, b]) => !bad.some(c => c.index >= a && c.index < b)).map(([a, b]) => line.slice(a, b)).join('').trim();
    if (kept) out.push(kept);
  }
  return out.join('\n');
}

// Remove sentences by exact text (used for numeric violations).
export function stripSentences(text, sentences) {
  if (!sentences.length) return text;
  const set = new Set(sentences.map(x => x.trim()));
  const out = [];
  for (const line of String(text).split('\n')) {
    if (![...set].some(x => line.includes(x))) { out.push(line); continue; }
    const kept = sentenceSpans(line).filter(([a, b]) => !set.has(line.slice(a, b).trim())).map(([a, b]) => line.slice(a, b)).join('').trim();
    if (kept) out.push(kept);
  }
  return out.join('\n');
}

// ---- numeric-claims check
const LEGAL_MARK = /\b(state law|statute|statutory|by law|the law|law requires|required by law|legally|ordinance|code section)\b/i;
const near = (a, b) => Math.abs(a - b) < 0.005;

// Figures the user supplied (so a demand deadline or a deposit amount they typed is never flagged), and
// totals computed from their dollar amounts (k x amount, or a verified/own figure plus k x amount).
function userAllowances(userText) {
  const fs = figures(userText);
  const dollars = fs.filter(f => f.kind === '$').map(f => f.value);
  const ints = new Set([...String(userText || '').matchAll(/\b(\d{1,3})\b/g)].map(m => Number(m[1])));
  const prods = new Set();
  for (const u of dollars) for (const k of [0.5, 1, 2, 3, 4]) prods.add(u * k);
  return { dollars, ints, prods, pcts: new Set(fs.filter(f => f.kind === '%').map(f => f.value)) };
}

export function lintNumbers(text, state, userText = '') {
  const abbr = stateAbbr(state);
  const st = abbr && VERIFIED.states[abbr] ? VERIFIED.states[abbr] : null;
  const fed = VERIFIED.federal.nums || { days: [], dollars: [], percents: [] };
  const own = st ? st.nums : { days: [], dollars: [], percents: [], depositDays: [] };
  const T = { d: new Set([...own.days, ...fed.days]), $: new Set([...own.dollars, ...fed.dollars]), '%': new Set([...own.percents, ...fed.percents]) };
  const U = userAllowances(userText);
  const sums = new Set(U.prods);
  for (const a of [...T.$, ...U.prods]) for (const b of U.prods) sums.add(a + b);
  const violations = [];
  for (const line of String(text).split('\n')) {
    for (const [a, b] of sentenceSpans(line)) {
      const sent = line.slice(a, b).trim();
      if (!sent) continue;
      const fs = figures(sent);
      if (!fs.length) continue;
      const legal = extractCitations(sent).length > 0 || LEGAL_MARK.test(sent);
      if (!legal) continue;
      const depositReturn = /deposit/i.test(sent) && /\b(return|refund|itemi[sz])/i.test(sent);
      for (const f of fs) {
        let bad = false, why = '';
        if (f.kind === 'd') {
          if (depositReturn && own.depositDays.length && !own.depositDays.includes(f.value) && !U.ints.has(f.value)) { bad = true; why = 'deposit-deadline'; }
          else if (!T.d.has(f.value) && !U.ints.has(f.value)) { bad = true; why = 'days'; }
        } else if (f.kind === '$') {
          if (!T.$.has(f.value) && !U.dollars.some(u => near(u, f.value)) && ![...sums].some(u => near(u, f.value))) { bad = true; why = 'dollars'; }
        } else if (!T['%'].has(f.value) && !U.pcts.has(f.value)) { bad = true; why = 'percent'; }
        if (bad) { violations.push({ kind: 'num', why, raw: f.raw, sentence: sent }); break; }
      }
    }
  }
  return { violations };
}

// What gets logged: counts and statutory citation strings only. No letter text, no case names
// (a case-name regex hit could in principle be a party name), nothing from the tenant's inputs.
export function logRecord(abbr, kind, found, violations, extra = {}) {
  return JSON.stringify({
    evt: 'citelint', state: abbr || 'unknown', kind, found: found.length, violations: violations.length,
    cites: violations.filter(v => /^(S|I|CH):/.test(v.key || '')).map(v => v.raw.slice(0, 40)),
    caseHits: violations.filter(v => /^[CR]:/.test(v.key || '')).length,
    numHits: violations.filter(v => v.kind === 'num').length, ...extra,
  });
}
