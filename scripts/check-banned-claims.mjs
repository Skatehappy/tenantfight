// Gate A17 - banned marketing claims. Fails if any public page, template, generated data, JSON-LD or
// src marketing string claims lawyer/attorney quality or gives "legal advice" (except in a not/no/n't disclaimer sentence).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BANNED = /attorney[\s-]+quality|lawyer[\s-]+quality|attorney[\s-]+grade|lawyer[\s-]+grade|attorney[\s-]+written|attorney[\s-]+drafted|real\s+lawyer/i;
const LEGAL_ADVICE = /legal\s+advice/i;
const NEGATION = /\b(not|no|never|cannot|nor|does\s+not|do\s+not|is\s+not)\b|n['’]t\b/i;

// Returns an array of violation strings for a text blob.
export function findViolations(text) {
  const out = [];
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;/g, ' ');
  for (const blob of [text, plain]) {
    const m = blob.match(BANNED);
    if (m && !out.includes(m[0].toLowerCase())) out.push(m[0].toLowerCase());
  }
  // sentence-level check for "legal advice"
  for (const sent of plain.split(/(?<=[.!?])\s+|\n+/)) {
    if (LEGAL_ADVICE.test(sent) && !NEGATION.test(sent)) out.push('legal advice (non-disclaimer): ' + sent.trim().slice(0, 100));
  }
  return out;
}

function walk(dir, exts, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, exts, acc);
    else if (exts.some(e => n.endsWith(e))) acc.push(p);
  }
  return acc;
}

export function scanRepo(root) {
  const files = [
    ...walk(join(root, 'public'), ['.html', '.json', '.xml', '.txt']),
    ...walk(join(root, 'scripts', 'templates'), ['.js']),
    ...walk(join(root, 'scripts', 'data'), ['.json', '.js']),
    join(root, 'scripts', 'generate-content.js'), join(root, 'src', 'App.jsx'),
    join(root, 'index.html'), join(root, 'landing.html'),
  ].filter(existsSync);
  const bad = [];
  for (const f of files) for (const v of findViolations(readFileSync(f, 'utf8'))) bad.push(relative(root, f) + ': ' + v);
  return { files: files.length, bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = scanRepo(join(dirname(fileURLToPath(import.meta.url)), '..'));
  if (r.bad.length) { console.error('A17 FAIL - banned claims (' + r.bad.length + '):\n  ' + r.bad.slice(0, 40).join('\n  ')); process.exit(1); }
  console.log('A17 banned-claims: ' + r.files + ' files clean');
}
