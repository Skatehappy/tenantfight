// Gate A16 - no unlogged citation in ANY source file under scripts/data/**.
//   scripts/data/generated/<state>/<topic>.json   checked against that state's verified set (strict: section + subsection;
//                                                  a citation that is verified only for ANOTHER state is a leak and fails)
//   scripts/data/state-data.json                  each top-level key is a state abbreviation
//   every other .json / .js under scripts/data    no state scope: the citation must be verified for at least one state
//                                                  or be federal (JS comments are ignored)
//   Merged (unrendered) combo files are checked exactly like rendered ones: they are still sources.
// node scripts/check-source-citations.mjs [--list]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AB = { arizona: 'AZ', california: 'CA', florida: 'FL', georgia: 'GA', illinois: 'IL', 'new-york': 'NY', 'north-carolina': 'NC', ohio: 'OH', pennsylvania: 'PA', texas: 'TX' };
const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(x => strings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out)); return out; };
const stripJsComments = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\r$/, '').replace(/\s\/\/\s.*$/, '')).join('\n');
const walkFiles = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walkFiles(path.join(d, e.name)) : [path.join(d, e.name)]);

export async function scanSources({ root = ROOT } = {}) {
  const lint = await import(pathToFileURL(path.join(root, 'api', '_citelint.js')).href);
  const vc = (await import(pathToFileURL(path.join(root, 'api', '_verified-citations.js')).href)).default;
  const states = Object.keys(vc.states);
  const bad = [];
  const check = (text, ab, where) => {
    for (const line of String(text).split('\n')) for (const [a, b] of lint.sentenceSpans(line)) {
      const sent = line.slice(a, b);
      for (const c of lint.extractCitations(sent)) {
        const ok = ab ? lint.citeAllowed(c, ab) : states.some(s => lint.citeAllowed(c, s));
        if (!ok) bad.push(`${where}${ab ? ' [' + ab + ']' : ''}: unlogged citation "${c.raw}" (${c.key}${c.sub?.length ? ' sub ' + c.sub.join('') : ''}) in: ${sent.trim().slice(0, 90)}`);
      }
    }
  };
  const base = path.join(root, 'scripts', 'data');
  let files = 0;
  for (const f of fs.existsSync(base) ? walkFiles(base) : []) {
    const rel = path.relative(base, f).replace(/\\/g, '/');
    const raw = fs.readFileSync(f, 'utf8');
    if (/\.json$/.test(f)) {
      files++;
      const o = JSON.parse(raw);
      const m = rel.match(/^generated\/([^/]+)\//);
      if (m) check(strings(o).join('\n'), AB[m[1]] || null, `scripts/data/${rel}`);
      else if (rel === 'state-data.json') for (const [ab, v] of Object.entries(o)) check(strings(v).join('\n'), states.includes(ab) ? ab : null, `scripts/data/${rel}[${ab}]`);
      else check(strings(o).join('\n'), null, `scripts/data/${rel}`);
    } else if (/\.(m?js|cjs)$/.test(f)) {
      files++;
      check(stripJsComments(raw), null, `scripts/data/${rel}`);
    }
  }
  return { files, bad };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await scanSources();
  console.log(`A16 source citations: ${r.files} source files under scripts/data, ${r.bad.length} unlogged citation(s)`);
  for (const b of r.bad) console.error('UNLOGGED ' + b);
  process.exit(r.bad.length ? 1 : 0);
}
