// Builds api/_verified-citations.js — the only authorities (and figures) the letter generator and the
// checklist may use.
//
// Sources (VERIFIED / CORRECTED rows only; REMOVED, INCORRECT and unlogged items are never included):
//   VERIFICATION_LOG-SEO-CONTENT.md  "## Phase B" per-state tables  (| citation | status | ... |)
//   VERIFICATION_LOG.md              "### date — <title>" entries with "**Verdict:** VERIFIED|CORRECTED"
//   scripts/data/state-data.json     verified per-state figures (days / dollars / percents) for the numeric check
// The logs are keyed by state, not by letter type, so the lock is per state. Every verified
// authority for the user's state is offered for any letter type.
//
// Output is a plain JS module (not JSON) so it imports the same way in the Node and Edge runtimes.
//   keys   citation keys (section number cores, ILCS paths, case names, reporter cites)
//   subs   per key: subsection designators that appear in the verified log text for it (a letter that
//          cites "§ 92.056(e)" is allowed only if "e" is on file for 92.056)
//   nums   per state: days / dollars / percents found in the verified log text and state data, plus
//          depositDays (the deposit-return deadline figures)
//
// node scripts/build-verified-citations.mjs          write api/_verified-citations.js
// node scripts/build-verified-citations.mjs --check  exit 1 if the checked-in file is stale
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCitations } from '../api/_citekeys.js';
import { figureSets, figures } from '../api/_numfacts.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'api', '_verified-citations.js');
const read = f => fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n') : '';

const STATES = { California: 'CA', Texas: 'TX', Florida: 'FL', 'New York': 'NY', Illinois: 'IL', Pennsylvania: 'PA', Ohio: 'OH', Georgia: 'GA', 'North Carolina': 'NC', Arizona: 'AZ' };
const ok = v => /^(VERIFIED|CORRECTED)\b/.test(v.trim());

const acc = {};     // abbr -> Map(display -> Set(keys))
const subsAcc = {}; // abbr -> Map(key -> Set(designators))
const texts = {};   // abbr -> verified log text (for figures)
const dates = {};   // abbr -> { key: newest verified_on of the log entries that support it }
const sdDate = {};  // abbr -> verified_on of the state's July block (the state-data.json figures)
const fedDates = {};
const figD = {};     // abbr ('ALL' = product facts, 'FED' = federal) -> { 'd:30' | '$:500' | '%:5': newest verified_on of log text stating that figure }
const fkey = f => f.kind + ':' + f.value;
const noteFigs = (ab, text, d) => { if (!d) return; figD[ab] ??= {}; for (const f of figures(text)) { const k = fkey(f); if (!figD[ab][k] || d > figD[ab][k]) figD[ab][k] = d; } };
const federal = new Map();
const fedSubs = new Map();
let fedText = '';
const put = (map, display, keys) => { if (!keys.size) return; const k = display.trim(); map.set(k, new Set([...(map.get(k) || []), ...keys])); };
const keysOf = text => new Set(extractCitations(text, { inheritIlcs: true }).map(c => c.key));
const designators = text => new Set([...String(text).matchAll(/\(([A-Za-z0-9]{1,4})\)/g)].map(m => m[1].toLowerCase()));
const noteDate = (map, keys, d) => { if (!d) return; for (const k of keys) if (!map[k] || d > map[k]) map[k] = d; };
const putSubs = (map, keys, rowText) => { const d = designators(rowText); for (const k of keys) map.set(k, new Set([...(map.get(k) || []), ...d])); };

// ---- Phase B tables
const seo = read('VERIFICATION_LOG-SEO-CONTENT.md');
const pb = seo.indexOf('## Phase B');
// July blocks: "## State (XX)" + "- **verified_on:** YYYY-MM-DD" (covers the state-data.json figures)
{ let ab = null; const blk = {}; for (const line of (pb < 0 ? seo : seo.slice(0, pb)).split('\n')) {
  const h = line.match(/^## .*?\(([A-Z]{2})\)\s*$/); if (h) { ab = h[1]; blk[ab] = ''; continue; }
  const v = line.match(/^- \*\*verified_on:\*\*\s*(\d{4}-\d{2}-\d{2})/); if (ab && v) sdDate[ab] = v[1];
  if (ab) blk[ab] += ' ' + line;
}
  for (const [k, t] of Object.entries(blk)) noteFigs(k, t, sdDate[k]); }
let cur = null;
for (const line of (pb < 0 ? '' : seo.slice(pb)).split('\n')) {
  const h = line.match(/^### .*?\(([A-Z]{2,3})\)(?:\s*—.*)?\s*$/);
  if (h) { cur = h[1]; acc[cur] ??= new Map(); subsAcc[cur] ??= new Map(); texts[cur] ??= ''; continue; }
  if (!cur || !line.startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map(c => c.trim());
  if (cells.length < 3 || /^-+$/.test(cells[0].replace(/\s/g, '')) || /^Citation/i.test(cells[0])) continue;
  if (!ok(cells[1])) continue;
  const keys = keysOf(cells[0]);
  noteFigs(cur, cells[0] + ' ' + cells[2], /^\d{4}-\d{2}-\d{2}$/.test(cells[4] || '') ? cells[4] : '');
  if (cur === 'ALL') continue;
  dates[cur] ??= {}; noteDate(dates[cur], keys, /^\d{4}-\d{2}-\d{2}$/.test(cells[4] || '') ? cells[4] : '');
  put(acc[cur], cells[0], keys);
  putSubs(subsAcc[cur], keys, cells[0] + ' ' + cells[2]);
  texts[cur] += '\n' + cells[0] + ' ' + cells[2];
}

// ---- July sweep + later single-cite entries
const jul = read('VERIFICATION_LOG.md');
for (const block of jul.split(/\n(?=### )/)) {
  const t = block.match(/^### \d{4}-\d{2}-\d{2} — (.+)$/m);
  const v = block.match(/\*\*Verdict:\*\*\s*([A-Z]+)/);
  if (!t || !v || !ok(v[1])) continue;
  const title = t[1].replace(/\s*\((?:supersedes|deposit|eviction|security|just-cause|unlawful|interruption|quiet|HUD|private|FHA|Fair)[^)]*\)?\s*$/i, '').replace(/^[A-Za-z ]*case law:\s*/i, '').trim();
  const keys = keysOf(title);
  noteFigs(/U\.S\.C\./.test(t[1]) ? 'FED' : (STATES[Object.keys(STATES).find(n => t[1].startsWith(n))] || '_'), block, t[0].match(/\d{4}-\d{2}-\d{2}/)[0]);
  const entryDate = t[0].match(/\d{4}-\d{2}-\d{2}/)[0];
  if (/U\.S\.C\./.test(title)) { put(federal, title, keys); noteDate(fedDates, keys, entryDate); putSubs(fedSubs, keys, block); fedText += '\n' + block; continue; }
  const name = Object.keys(STATES).find(n => title.startsWith(n));
  if (!name) continue; // other states (Massachusetts) are not offered by this app
  const abbr = STATES[name];
  acc[abbr] ??= new Map(); subsAcc[abbr] ??= new Map(); texts[abbr] ??= '';
  dates[abbr] ??= {}; noteDate(dates[abbr], keys, entryDate);
  put(acc[abbr], title, keys);
  putSubs(subsAcc[abbr], keys, title + ' ' + block);
  texts[abbr] += '\n' + block;
}

// ---- verified figures
const stateData = JSON.parse(read('scripts/data/state-data.json') || '{}');
const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(x => strings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out)); return out; };

const subsObj = map => Object.fromEntries([...map.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, s]) => [k, [...s].sort()]));
const shape = (map, subs) => ({
  cites: [...map.keys()].sort(),
  keys: [...new Set([...map.values()].flatMap(s => [...s]))].sort(),
  subs: subsObj(subs || new Map()),
});
const states = {};
for (const ab of Object.values(STATES)) {
  const sd = stateData[ab] || {};
  const own = figureSets((texts[ab] || '') + '\n' + strings(sd).join('\n'));
  const depositText = typeof sd.security_deposit_rules === 'string' ? sd.security_deposit_rules : strings(sd.security_deposit_rules).join(' ');
  states[ab] = { ...shape(acc[ab] || new Map(), subsAcc[ab]), figDates: Object.fromEntries(Object.entries({ ...(figD.ALL || {}), ...(figD[ab] || {}) }).sort()), dates: Object.fromEntries(Object.entries(dates[ab] || {}).sort()), stateDataVerifiedOn: sdDate[ab] || null, nums: { ...own, depositDays: figureSets(depositText).days } };
}
const data = { _note: 'Generated by scripts/build-verified-citations.mjs from VERIFICATION_LOG*.md and state-data.json (VERIFIED/CORRECTED only). Do not edit by hand.', states, federal: { ...shape(federal, fedSubs), figDates: Object.fromEntries(Object.entries(figD.FED || {}).sort()), dates: Object.fromEntries(Object.entries(fedDates).sort()), nums: figureSets(fedText) } };
const js = '// @generated by scripts/build-verified-citations.mjs - do not edit by hand\nexport default ' + JSON.stringify(data, null, 2) + ';\n';

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (cur !== js) { console.error('api/_verified-citations.js is stale — run: node scripts/build-verified-citations.mjs'); process.exit(1); }
  console.log('verified-citations.js up to date');
} else {
  fs.writeFileSync(OUT, js);
  console.log(Object.entries(states).map(([k, v]) => `${k}:${v.cites.length}`).join(' ') + ` federal:${data.federal.cites.length}`);
}
