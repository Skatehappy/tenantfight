// Reports (and fails on) two things for the pages that are actually published:
//   1. held sentences: source sentences the build-time hold-back (scripts/data/pending.js) would withhold
//   2. unverified citations: citations in the rendered public/**/*.html that are not in the verified set
//      for that page's state (strict: section + subsection, via api/_citelint.js)
// node tests/held-and-unlogged.mjs [--list]
import fs from 'node:fs';
import path from 'node:path';
import { unlogged } from '../scripts/data/pending.js';
import { lintLetter, sentenceSpans } from '../api/_citelint.js';

// run from the repo root (pending.js reads the logs relative to the cwd)
const AB = { arizona: 'AZ', california: 'CA', florida: 'FL', georgia: 'GA', illinois: 'IL', 'new-york': 'NY', 'north-carolina': 'NC', ohio: 'OH', pennsylvania: 'PA', texas: 'TX' };
const merged = new Set(JSON.parse(fs.readFileSync('scripts/data/merged-combos.json', 'utf8')));
const sents = s => sentenceSpans(s).map(([a, b]) => s.slice(a, b).trim()).filter(Boolean);
const walk = (v, cb) => { if (typeof v === 'string') cb(v); else if (Array.isArray(v)) v.forEach(x => walk(x, cb)); else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, cb)); };

let held = 0; const heldList = [];
for (const [slug] of Object.entries(AB)) for (const f of fs.readdirSync(`scripts/data/generated/${slug}`)) {
  const key = `${slug}/${f.replace('.json', '')}`; if (merged.has(key)) continue; // merged combos are not published
  walk(JSON.parse(fs.readFileSync(`scripts/data/generated/${slug}/${f}`, 'utf8')), s => { for (const x of sents(s)) { const u = unlogged(x); if (u.length) { held++; heldList.push(`${key}: ${u.join(', ')} | ${x.slice(0, 90)}`); } } });
}

let bad = 0; const badList = []; const distinct = new Map();
const stripHtml = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<head[\s\S]*?<\/head>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&sect;/g, '§').replace(/\s+/g, ' ');
for (const [slug, ab] of Object.entries(AB)) {
  const dir = `public/${slug}`;
  for (const p of [dir, ...fs.readdirSync(dir).filter(n => fs.statSync(path.join(dir, n)).isDirectory()).map(n => path.join(dir, n))]) {
    const f = path.join(p, 'index.html'); if (!fs.existsSync(f)) continue;
    const text = stripHtml(fs.readFileSync(f, 'utf8'));
    for (const x of sents(text)) { const v = lintLetter(x, ab).violations; if (v.length) { bad += v.length; for (const y of v) { const k = `${ab} ${y.raw.replace(/\s+/g, ' ')} (${y.reason})`; distinct.set(k, (distinct.get(k) || 0) + 1); } badList.push(`${f}: ${[...new Set(v.map(y => y.raw))].join(', ')} | ${x.slice(0, 80)}`); } }
  }
}
// 3. values Phase B corrected/removed must not come back (rendered pages, source data, landing, client)
const STALE = [/five court days/i, /765 ILCS 720/, /Utility Payments Act/, /90.180 day/, /5-12-060/, /250\.206/, /Illinois Retaliatory Eviction Act/, /increased from 3 days by HSTPA/, /Philadelphia Code, including the Good Cause/, /§ 1950\.5\(l\)/, /83\.56\(2\)\(a\)\); 7-day unconditional/, /1940-1954\.06(?!1)/];
let stale = 0;
for (const d of ['public', 'scripts/data', 'src', 'api']) for (const f of fs.readdirSync(d, { recursive: true })) { const p = path.join(d, f); if (!/\.(html|json|js|jsx)$/.test(p) || fs.statSync(p).isDirectory()) continue; const s = fs.readFileSync(p, 'utf8'); for (const re of STALE) if (re.test(s)) { stale++; console.log('STALE ' + re + ' in ' + p); } }
console.log(`stale corrected values: ${stale}`);
console.log(`held sentences (published pages): ${held}`);
console.log(`unverified citations in rendered pages (strict): ${bad}`);
if (process.argv.includes('--distinct')) console.log([...distinct.entries()].sort().map(([k, v]) => v + 'x ' + k).join('\n'));
if (process.argv.includes('--list')) { console.log(heldList.join('\n')); console.log(badList.join('\n')); }
process.exit(held || bad || stale ? 1 : 0);
