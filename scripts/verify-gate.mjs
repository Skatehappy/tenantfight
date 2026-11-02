// Three-Gate v7 — Gate 2 (execution-based verify) for letter apps.
// A1: required files present + package.json valid JSON.
// A9: citation-log parity — every statutory citation in src/App.jsx,
//     public/landing.html, landing.html, api/checklist.js must have a matching
//     entry in VERIFICATION_LOG.md (the citation identifier appears literally).
// Nonzero exit on any failure. Runs on pre-commit + GitHub Actions.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CITATION_FILES = ['src/App.jsx', 'public/landing.html', 'landing.html', 'api/checklist.js'];
const LOG = join(ROOT, 'VERIFICATION_LOG.md');

function fail(msg) { console.error('GATE RED — ' + msg); process.exit(1); }

// ── A1: required files ───────────────────────────────────────────────────────
for (const f of ['src/App.jsx', 'package.json']) if (!existsSync(join(ROOT, f))) fail('A1: missing ' + f);
try { JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')); } catch { fail('A1: package.json is not valid JSON'); }

// ── A9: citation-log parity ──────────────────────────────────────────────────
if (!existsSync(LOG)) fail('A9: VERIFICATION_LOG.md is missing');
const logNorm = readFileSync(LOG, 'utf8').replace(/\s+/g, '').toLowerCase();

let code = '';
for (const f of CITATION_FILES) { const p = join(ROOT, f); if (existsSync(p)) code += '\n' + readFileSync(p, 'utf8'); }

const tokens = new Set();
// section-symbol citations: §1954, §§5600-5615, §235-b, §92.0081, §27-2005 …
for (const m of code.matchAll(/§+\s*\d[0-9A-Za-z.\-]*/g)) {
  let t = m[0].replace(/\s+/g, '').replace(/[.\-]+$/, '');
  if (t.length > 1) tokens.add(t);
}
// CFR / U.S.C. citations: 42 U.S.C. §3604, 29 CFR §2560.503-1, 47 CFR §1.4000 …
for (const m of code.matchAll(/\b\d+\s+(?:U\.?\s?S\.?\s?C\.?|C?\.?\s?F\.?\s?R\.?)\s*§?\s*\d[0-9A-Za-z.\-]*/gi)) {
  tokens.add(m[0].replace(/\s+/g, ''));
}

const missing = [];
for (const t of tokens) if (!logNorm.includes(t.toLowerCase())) missing.push(t);

if (missing.length) {
  console.error('A9 FAIL — citations in code with no VERIFICATION_LOG.md entry (' + missing.length + '):');
  for (const m of [...missing].sort()) console.error('  ' + m);
  fail(missing.length + ' unlogged citation(s)');
}
// ── A10: letter citation lock — verified-citations.js current + mock tests pass (incl. subsection + numeric-claims + checklist lock + client templates) ──
for (const [label, args] of [['A10: api/_verified-citations.js is stale (run node scripts/build-verified-citations.mjs)', ['scripts/build-verified-citations.mjs', '--check']], ['A10: citation-lock mock tests failed (node scripts/test-citelint.mjs)', ['scripts/test-citelint.mjs']], ['A10: extended lock tests failed (node scripts/test-lock-extended.mjs)', ['scripts/test-lock-extended.mjs']]]) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); fail(label); }
}

// ── A11: auth gate — no path to Anthropic without a passed Payhip (or G4T) check; no bypass keys ──
{
  const r = spawnSync(process.execPath, ['scripts/test-auth.mjs'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); fail('A11: auth gate failed (node scripts/test-auth.mjs)'); }
}

// ── A12: Payhip mock + access-check tests (node:test) ──
{
  const r = spawnSync(process.execPath, ['--test', 'tests/payhip-mock.test.js', 'tests/isCheckCall.test.js'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); fail('A12: payhip-mock / isCheckCall tests failed (node --test tests/)'); }
}

// ── A13: Playwright UI button-wiring test (every button, nav, modal; zero console errors). Fail-closed: if
//      playwright is missing the gate is RED (npm i, or set PLAYWRIGHT_DIR to a node_modules that has it). ──
{
  const r = spawnSync(process.execPath, ['tests/ui-wiring.test.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 300000, env: process.env });
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); fail('A13: UI wiring test failed (node tests/ui-wiring.test.mjs)'); }
}

// ── A14: published pages: 0 held sentences, 0 unverified citations (strict: section + subsection), no corrected/removed value reappears ──
{
  const r = spawnSync(process.execPath, ['tests/held-and-unlogged.mjs'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); fail('A14: held / unverified / stale-value check failed (node tests/held-and-unlogged.mjs --list)'); }
}

// ── A15: every SEO-log entry has verified_on; nothing rendered or fed to a generator maps to an entry >12 months old (warn >10) ──
for (const [label, args] of [['A15: verified_on mock tests failed (node scripts/test-verified-on.mjs)', ['scripts/test-verified-on.mjs']], ['A15: strict verified_on mapping/freshness check failed (node scripts/check-verified-on.mjs): an unmapped citation or figure, or a stale entry', ['scripts/check-verified-on.mjs']]]) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); fail(label); }
  if (r.stderr) console.warn(r.stderr.trim());
  if (/^A15 /m.test(r.stdout || '')) console.log((r.stdout.match(/^A15 .*$/m) || [''])[0]);
}

// ── A16: no unlogged citation in ANY source file under scripts/data/** (strict, state-scoped; mock tests included) ──
for (const [label, args] of [['A16: source-citation mock tests failed (node scripts/test-source-citations.mjs)', ['scripts/test-source-citations.mjs']], ['A16: unlogged citation in a scripts/data source file (node scripts/check-source-citations.mjs)', ['scripts/check-source-citations.mjs']]]) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); fail(label); }
}

console.log('GATE GREEN — A1 files ok; A9 citation-log parity: all ' + tokens.size + ' citations logged; A10 citation lock (subsections, numeric claims, checklist, templates) ok; A11 auth gate ok; A12 payhip-mock + isCheckCall ok; A13 UI wiring ok; A14 0 held / 0 unverified citations / 0 stale values; A15 STRICT: every citation and $/%/day figure on a page or fed to a generator maps to a dated log entry (fresh); A16 0 unlogged citations in scripts/data/**.');
process.exit(0);
