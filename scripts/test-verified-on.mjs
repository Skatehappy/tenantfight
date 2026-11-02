// Mock tests for gate A15 (verified_on freshness). node scripts/test-verified-on.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, monthsBefore, parseEntries, stamp, scanRepo } from './check-verified-on.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
const t = (name, cond) => { if (!cond) { bad++; console.error('FAIL ' + name); } };
const NOW = '2026-11-01';

// unit: ages (fresh / 10-month warn / 13-month fail / missing)
t('fresh ok', classify('2026-10-01', NOW) === 'ok');
t('exactly 10 months ok', classify(monthsBefore(NOW, 10), NOW) === 'ok');
t('10 months + 1 day warn', classify('2025-12-31', NOW) === 'warn');
t('11 months warn', classify('2025-12-01', NOW) === 'warn');
t('exactly 12 months still warn (not fail)', classify(monthsBefore(NOW, 12), NOW) === 'warn');
t('13 months fail', classify('2025-10-01', NOW) === 'fail');
t('missing', classify('', NOW) === 'missing');
t('garbage', classify('soon', NOW) === 'missing');

// mock repo
function mockRepo({ ruleDate, blockDate, rowDate, rowBlank, extraPage = '', extraSd = '' }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-vo-'));
  fs.mkdirSync(path.join(d, 'api')); fs.mkdirSync(path.join(d, 'public', 'texas'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'api', '_citekeys.js'), path.join(d, 'api', '_citekeys.js'));
  const row = `| Tex. Prop. Code § 92.103 | VERIFIED | 30-day return. | https://x |${rowBlank ? '' : ' ' + rowDate + ' |'}`;
  fs.writeFileSync(path.join(d, 'VERIFICATION_LOG-SEO-CONTENT.md'), [
    '# log', '## Texas (TX)', blockDate ? `- **verified_on:** ${blockDate}` : '- **Primary statute:** x', '- **Sources (1):**', '',
    '## Phase B - x', '### Texas (TX)', '| Citation as it now appears | Status | What it says | Source | verified_on |', '|---|---|---|---|---|', row, ''].join('\n'));
  fs.writeFileSync(path.join(d, 'api', '_verified-citations.js'), 'export default ' + JSON.stringify({
    states: { TX: { dates: { 'S:92.103': rowDate }, figDates: { 'd:30': rowDate }, stateDataVerifiedOn: blockDate } }, federal: { dates: {}, figDates: {} } }) + ';\n');
  fs.mkdirSync(path.join(d, 'scripts', 'data'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'api', '_numfacts.js'), path.join(d, 'api', '_numfacts.js'));
  fs.writeFileSync(path.join(d, 'scripts', 'data', 'state-data.json'), JSON.stringify({ TX: { rules: 'Return the deposit within 30 days. ' + extraSd } }));
  fs.writeFileSync(path.join(d, 'public', 'texas', 'index.html'), '<html><body><p>Return the deposit within 30 days. Tex. Prop. Code § 92.103 applies. ' + extraPage + '</p></body></html>');
  return d;
}
const run = async o => { const d = mockRepo(o); try { return await scanRepo({ root: d, now: NOW }); } finally { fs.rmSync(d, { recursive: true, force: true }); } };

const fresh = await run({ blockDate: '2026-10-01', rowDate: '2026-10-15' });
t('fresh: no errors', fresh.errors.length === 0 && fresh.warns.length === 0 && fresh.entries.length === 2);
const warn = await run({ blockDate: '2026-10-01', rowDate: '2025-11-15' }); // ~11.5 months
t('10-month: warns, not fatal', warn.errors.length === 0 && warn.warns.length > 0 && warn.warns.some(w => /page public\/texas/.test(w)) && warn.warns.some(w => /generator lock/.test(w)));
const old = await run({ blockDate: '2026-10-01', rowDate: '2025-09-30' }); // 13 months
t('13-month: fails (page + generator)', old.errors.some(e => /page public\/texas/.test(e)) && old.errors.some(e => /generator lock TX S:92.103/.test(e)));
const oldFig = await run({ blockDate: '2025-09-01', rowDate: '2026-10-15' });
t('stale state-data figures fail', oldFig.errors.some(e => /state-data.json figures/.test(e)));
const miss = await run({ blockDate: '2026-10-01', rowBlank: true });
t('missing row date fails', miss.errors.some(e => /no valid verified_on/.test(e)));
const missBlk = await run({ blockDate: '', rowDate: '2026-10-15' });
t('missing block date fails', missBlk.errors.some(e => /no valid verified_on: Texas \(TX\)/.test(e)));

// STRICT MODE: nothing is skipped. An unmapped citation or an unmapped $ / % / day figure fails the gate.
const unCite = await run({ blockDate: '2026-10-01', rowDate: '2026-10-15', extraPage: 'See Tex. Prop. Code § 92.999.' });
t('unmapped citation on a page fails', unCite.errors.some(e => /UNMAPPED CITATION page public\/texas.*92\.999/.test(e)));
const unFig = await run({ blockDate: '2026-10-01', rowDate: '2026-10-15', extraPage: 'Filing fees run $45 to $80.' });
t('unmapped dollar figure on a page fails', unFig.errors.some(e => /UNMAPPED FIGURE page public\/texas.*\$45/.test(e)) && unFig.errors.some(e => /\$80/.test(e)));
const unDay = await run({ blockDate: '2026-10-01', rowDate: '2026-10-15', extraPage: 'The landlord has 14 days to answer and may add 5% interest.' });
t('unmapped day and percent figures fail', unDay.errors.some(e => /"14 days"/.test(e)) && unDay.errors.some(e => /"5%"/.test(e)));
const unSd = await run({ blockDate: '2026-10-01', rowDate: '2026-10-15', extraSd: 'Late fee capped at $50 and § 92.888.' });
t('unmapped figure and citation fed to a generator (state-data.json) fail', unSd.errors.some(e => /UNMAPPED FIGURE state-data\.json\[TX\].*\$50/.test(e)) && unSd.errors.some(e => /UNMAPPED CITATION state-data\.json\[TX\].*92\.888/.test(e)));

// stamp: fills only missing, never overwrites
const src = ['## Texas (TX)', '- **Primary statute:** x', '', '## Phase B', '### Texas (TX)', '| Citation | Status | What | Source |', '|---|---|---|---|', '| a § 1 | VERIFIED | x | y |'].join('\n');
const s1 = stamp(src, '2026-11-01'), e1 = parseEntries(s1);
t('stamp fills block + row', e1.length === 2 && e1.every(e => e.verified_on === '2026-11-01'));
const s2 = stamp(s1.replace('2026-11-01 |', '2026-01-01 |'), '2026-12-01'), e2 = parseEntries(s2);
t('stamp preserves existing', e2.find(e => e.kind === 'row').verified_on === '2026-01-01' && e2.find(e => e.kind === 'state-block').verified_on === '2026-11-01');
t('stamp adds a new row with today', parseEntries(stamp(s1 + '\n| b § 2 | VERIFIED | x | y | |', '2026-12-05')).at(-1).verified_on === '2026-12-05');

// the real log must parse with every entry dated
const real = parseEntries(fs.readFileSync(path.join(ROOT, 'VERIFICATION_LOG-SEO-CONTENT.md'), 'utf8'));
t('real log: entries found', real.length > 200);
t('real log: all dated', real.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.verified_on)));

if (bad) { console.error(bad + ' verified_on test(s) failed'); process.exit(1); }
console.log('verified_on mock tests passed (fresh / 10-month warn / 13-month fail / missing / stamp / real log)');
