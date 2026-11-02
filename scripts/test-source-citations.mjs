// Mock tests for gate A16 (no unlogged citation in any scripts/data/** source file). node scripts/test-source-citations.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSources } from './check-source-citations.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
const t = (name, cond) => { if (!cond) { bad++; console.error('FAIL ' + name); } };

function mock({ generated = {}, stateData = {}, jsFile = '' }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-src-'));
  fs.mkdirSync(path.join(d, 'api'));
  for (const f of ['_citelint.js', '_citekeys.js', '_numfacts.js']) fs.copyFileSync(path.join(ROOT, 'api', f), path.join(d, 'api', f));
  // TX verifies 92.103 (+ subsection b); AZ verifies 33-1321; federal verifies nothing
  const shape = (cites, keys, subs) => ({ cites, keys, subs, dates: {}, figDates: {}, nums: { days: [], dollars: [], percents: [], depositDays: [] } });
  fs.writeFileSync(path.join(d, 'api', '_verified-citations.js'), 'export default ' + JSON.stringify({
    states: { TX: shape(['Tex. Prop. Code § 92.103'], ['S:92.103'], { 'S:92.103': ['b'] }), AZ: shape(['A.R.S. § 33-1321'], ['S:33-1321'], {}) },
    federal: { ...shape([], [], {}), nums: { days: [], dollars: [], percents: [] } } }) + ';\n');
  const base = path.join(d, 'scripts', 'data');
  for (const [rel, obj] of Object.entries(generated)) { fs.mkdirSync(path.dirname(path.join(base, 'generated', rel)), { recursive: true }); fs.writeFileSync(path.join(base, 'generated', rel), JSON.stringify(obj)); }
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, 'state-data.json'), JSON.stringify(stateData));
  if (jsFile) fs.writeFileSync(path.join(base, 'extra.js'), jsFile);
  return d;
}
const run = async o => { const d = mock(o); try { return await scanSources({ root: d }); } finally { fs.rmSync(d, { recursive: true, force: true }); } };

const clean = await run({ generated: { 'texas/a.json': { lawExplanation: 'Return within 30 days under Tex. Prop. Code § 92.103(b).' } }, stateData: { TX: { x: 'See § 92.103.' } } });
t('clean sources pass', clean.bad.length === 0);

const unlogged = await run({ generated: { 'texas/a.json': { lawExplanation: 'See Tex. Prop. Code § 92.999.' } } });
t('unlogged citation in a rendered-style source fails', unlogged.bad.length === 1 && /92\.999/.test(unlogged.bad[0]));

const mergedFile = await run({ generated: { 'texas/merged-one.json': { faq: [{ q: 'q', a: 'Section 77.123 applies.' }] } } });
t('unlogged citation in a nested faq (merged-style) source fails', mergedFile.bad.length === 1 && /77\.123/.test(mergedFile.bad[0]));

const leak = await run({ generated: { 'texas/a.json': { lawExplanation: 'Under A.R.S. § 33-1321 the deposit is returned.' } } });
t('citation verified only for another state is a leak and fails', leak.bad.length === 1 && /33-1321/.test(leak.bad[0]));

const subs = await run({ generated: { 'texas/a.json': { lawExplanation: 'See § 92.103(z).' } } });
t('subsection not on file fails', subs.bad.length === 1);

const sd = await run({ stateData: { TX: { x: 'See § 55.555.' } } });
t('unlogged citation in state-data.json fails', sd.bad.length === 1 && /state-data\.json\[TX\]/.test(sd.bad[0]));

const js = await run({ jsFile: "export const note = 'cites § 12.345';\n" });
t('unlogged citation in a .js source fails', js.bad.length === 1 && /extra\.js/.test(js.bad[0]));
const jsComment = await run({ jsFile: '// example only: § 12.345\nexport const a = 1;\n' });
t('citation inside a JS comment is ignored', jsComment.bad.length === 0);

// the real repo must be clean
const real = await scanSources({ root: ROOT });
t('real scripts/data sources: 0 unlogged citations (' + real.bad.slice(0, 3).join(' | ') + ')', real.bad.length === 0);

if (bad) { console.error(bad + ' source-citation test(s) failed'); process.exit(1); }
console.log('source-citation mock tests passed (clean / unlogged / nested / cross-state leak / subsection / state-data / js / comments / real repo)');
