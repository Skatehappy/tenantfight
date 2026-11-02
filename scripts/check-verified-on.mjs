// Gate A15 - verified_on freshness.
//   Every VERIFICATION_LOG-SEO-CONTENT.md entry carries `verified_on: YYYY-MM-DD`:
//     - July state blocks:  "- **verified_on:** YYYY-MM-DD" under each "## State (XX)" heading
//     - Phase B table rows: last column "verified_on" (header `| ... | verified_on |`)
//   FAIL  : any entry without a valid verified_on; any citation or figure rendered on a page (public/**)
//           or fed to a generator (api/_verified-citations.js: keys + state-data figures) whose log entry
//           was verified more than 12 months before NOW.
//   WARN  : the same, older than 10 months (non-fatal, listed).
//   NOW   : injectable - env TF_NOW=YYYY-MM-DD, `--now=YYYY-MM-DD`, or the `now` argument (tests). Default: today.
//   New entries: `node scripts/check-verified-on.mjs --stamp` fills any MISSING verified_on with today's date
//   (never overwrites an existing one). build-verified-citations.mjs only reads the log and carries the dates
//   into api/_verified-citations.js (`dates`, `stateDataVerifiedOn`); nothing rewrites the log automatically.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const iso = d => d.toISOString().slice(0, 10);
export function monthsBefore(now, n) { const d = new Date(now + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - n); return iso(d); }
// 'ok' | 'warn' (older than 10 months) | 'fail' (older than 12 months) | 'missing'
export function classify(date, now) {
  if (!date || !DATE.test(date) || Number.isNaN(Date.parse(date))) return 'missing';
  if (date < monthsBefore(now, 12)) return 'fail';
  if (date < monthsBefore(now, 10)) return 'warn';
  return 'ok';
}

// Parse log text -> [{ id, kind, verified_on }]
export function parseEntries(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const pb = lines.findIndex(l => l.startsWith('## Phase B'));
  const entries = [];
  let blk = null;
  for (let i = 0; i < (pb < 0 ? lines.length : pb); i++) {
    const h = lines[i].match(/^## (.*?\(([A-Z]{2})\))\s*$/);
    if (h) { blk = { id: h[1], kind: 'state-block', verified_on: '' }; entries.push(blk); continue; }
    const v = lines[i].match(/^- \*\*verified_on:\*\*\s*(\S+)/);
    if (blk && v) blk.verified_on = v[1];
  }
  if (pb >= 0) {
    let state = '', col = -1;
    for (let i = pb; i < lines.length; i++) {
      const l = lines[i];
      const h = l.match(/^### (.*)$/); if (h) { state = h[1]; col = -1; continue; }
      if (!l.startsWith('|')) continue;
      const cells = l.split('|').slice(1, -1).map(c => c.trim());
      if (/^Citation/i.test(cells[0])) { col = cells.findIndex(c => /^verified_on$/i.test(c)); continue; }
      if (/^-+$/.test(cells[0].replace(/\s/g, ''))) continue;
      entries.push({ id: `${state} | ${cells[0].slice(0, 60)}`, kind: 'row', line: i + 1, verified_on: col >= 0 ? (cells[col] || '') : '' });
    }
  }
  return entries;
}

export function checkEntries(entries, now) {
  const errors = [];
  for (const e of entries) if (classify(e.verified_on, now) === 'missing') errors.push(`entry has no valid verified_on: ${e.id}`);
  return { errors, warns: [] };
}

// used: [{ where, date }] (date = verified_on of the log entry the cited / fed item maps to)
export function checkUsage(used, now) {
  const errors = [], warns = [], seen = new Set();
  for (const u of used) {
    const c = classify(u.date, now), k = c + '|' + u.where + '|' + u.date;
    if (seen.has(k)) continue; seen.add(k);
    if (c === 'fail') errors.push(`${u.where}: log entry verified ${u.date}, more than 12 months before ${now}`);
    else if (c === 'warn') warns.push(`${u.where}: log entry verified ${u.date}, more than 10 months before ${now}`);
  }
  return { errors, warns };
}

// Fill MISSING verified_on with `today` (never overwrites an existing value).
export function stamp(text, today) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const pb = lines.findIndex(l => l.startsWith('## Phase B'));
  const out = [];
  let col = -1, blkIdx = -1, blkHas = false;
  const closeBlk = () => { if (blkIdx >= 0 && !blkHas) out.splice(blkIdx + 1, 0, `- **verified_on:** ${today}`); blkIdx = -1; };
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (pb < 0 || i < pb) {
      if (/^## .*\([A-Z]{2}\)\s*$/.test(l)) { closeBlk(); out.push(l); blkIdx = out.length - 1; blkHas = false; continue; }
      if (/^- \*\*verified_on:\*\*\s*\S+/.test(l)) blkHas = true;
      out.push(l); continue;
    }
    if (i === pb) closeBlk();
    if (/^### /.test(l)) col = -1;
    if (l.startsWith('|')) {
      const cells = l.split('|').slice(1, -1).map(c => c.trim());
      if (/^Citation/i.test(cells[0])) { col = cells.findIndex(c => /^verified_on$/i.test(c)); if (col < 0) l += ' verified_on |'; }
      else if (/^-+$/.test(cells[0].replace(/\s/g, ''))) { if (col < 0) l += '---|'; }
      else if (col < 0) l += ' ' + today + ' |';
      else if (!DATE.test(cells[col] || '')) { cells[col] = today; l = '| ' + cells.join(' | ') + ' |'; }
    }
    out.push(l);
  }
  if (pb < 0) closeBlk();
  return out.join('\n');
}

// ---- repo scan ----
const stripHtml = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<head[\s\S]*?<\/head>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&sect;/g, '§').replace(/\s+/g, ' ');
const SLUG = { arizona: 'AZ', california: 'CA', florida: 'FL', georgia: 'GA', illinois: 'IL', 'new-york': 'NY', 'north-carolina': 'NC', ohio: 'OH', pennsylvania: 'PA', texas: 'TX' };

export async function scanRepo({ root = ROOT, now }) {
  const log = fs.readFileSync(path.join(root, 'VERIFICATION_LOG-SEO-CONTENT.md'), 'utf8');
  const entries = parseEntries(log);
  const res = checkEntries(entries, now);
  const vc = (await import(pathToFileURL(path.join(root, 'api', '_verified-citations.js')).href)).default;
  const { extractCitations } = await import(pathToFileURL(path.join(root, 'api', '_citekeys.js')).href);
  const used = [];
  // fed to generators: every lock key and the state-data figures
  for (const [ab, st] of Object.entries(vc.states)) {
    used.push({ where: `generator lock ${ab} state-data figures`, date: st.stateDataVerifiedOn });
    for (const [k, d] of Object.entries(st.dates || {})) used.push({ where: `generator lock ${ab} ${k}`, date: d });
  }
  for (const [k, d] of Object.entries(vc.federal.dates || {})) used.push({ where: `generator lock federal ${k}`, date: d });
  // rendered on pages
  let pages = 0;
  const pub = path.join(root, 'public');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.html$/.test(e.name) ? [path.join(d, e.name)] : []);
  for (const f of fs.existsSync(pub) ? walk(pub) : []) {
    const rel = path.relative(pub, f).replace(/\\/g, '/'), ab = SLUG[rel.split('/')[0]];
    pages++;
    if (!ab) continue;
    const text = stripHtml(fs.readFileSync(f, 'utf8'));
    const st = vc.states[ab];
    used.push({ where: `page public/${rel} (state-data figures)`, date: st.stateDataVerifiedOn });
    for (const c of extractCitations(text, { inheritIlcs: true })) {
      const d = st.dates?.[c.key] ?? vc.federal.dates?.[c.key];
      if (d) used.push({ where: `page public/${rel} ${c.key}`, date: d });
    }
  }
  const u = checkUsage(used, now);
  return { entries, pages, errors: [...res.errors, ...u.errors], warns: [...res.warns, ...u.warns] };
}

const argv = process.argv.slice(2);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const now = argv.find(a => a.startsWith('--now='))?.slice(6) || process.env.TF_NOW || new Date().toLocaleDateString('en-CA');
  if (argv.includes('--stamp')) {
    const f = path.join(ROOT, 'VERIFICATION_LOG-SEO-CONTENT.md');
    const t = fs.readFileSync(f, 'utf8'), o = stamp(t, now);
    if (o !== t.replace(/\r\n/g, '\n')) { fs.writeFileSync(f, o); console.log('stamped missing verified_on with ' + now); } else console.log('nothing to stamp');
    process.exit(0);
  }
  const r = await scanRepo({ now });
  const older = m => r.entries.filter(e => DATE.test(e.verified_on) && e.verified_on < monthsBefore(now, m)).length;
  console.log(`A15 verified_on: ${r.entries.length} entries, ${r.pages} pages scanned, now=${now}; older than 10 months: ${older(10)}, older than 12 months: ${older(12)}`);
  for (const w of r.warns) console.warn('WARN ' + w);
  for (const e of r.errors) console.error('ERROR ' + e);
  process.exit(r.errors.length ? 1 : 0);
}
