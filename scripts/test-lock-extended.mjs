// Mock tests for the extended lock: subsection-level citation matching, the numeric-claims check,
// the lock on api/checklist.js, and the client prompt templates in src/App.jsx.
// No network, no real license codes, no Anthropic calls: global fetch is stubbed.
// node scripts/test-lock-extended.mjs   (exit 1 on any failure)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.PAYHIP_API_KEY = 'mock-payhip';
process.env.ANTHROPIC_API_KEY = 'mock-anthropic';
process.env.G4_TEST_CODE_SECRET = 'EXTSECRET';
const CODE = 'G4T-EXTSECRET';

const { lintLetter, lintNumbers, extractCitations, stripUnverified, stripSentences, lockBlock } = await import('../api/_citelint.js');
const { default: VERIFIED } = await import('../api/_verified-citations.js');
const { default: generate } = await import('../api/generate.js');
const { default: checklist } = await import('../api/checklist.js');

let queue = [], anthropicCalls = 0, systems = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith('https://api.anthropic.com/')) {
    anthropicCalls++; systems.push(JSON.parse(opts.body).system || '');
    const text = queue.length > 1 ? queue.shift() : queue[0];
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  }
  throw new Error('unexpected fetch ' + url);
};
const reset = (...q) => { queue = q; anthropicCalls = 0; systems = []; };
async function gen(body) {
  const res = { code: 200, body: null, headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await generate({ method: 'POST', body: { accessCode: CODE, systemPrompt: 'S', ...body } }, res);
  return res;
}
const cl = async body => { const r = await checklist(new Request('http://x/api/checklist', { method: 'POST', body: JSON.stringify({ accessCode: CODE, ...body }) })); return { status: r.status, body: await r.json() }; };

let n = 0;
const ok = name => console.log(`ok ${++n} - ${name}`);

// 1. subsection-level matching
{
  const keySub = extractCitations('Under Property Code § 92.056(e)(1), you may terminate.')[0];
  assert.deepEqual(keySub.sub, ['e', '1']);
  assert.equal(lintLetter('Under Property Code § 92.056(e), the tenant may terminate the lease.', 'TX').violations.length, 0, 'logged subsection (e) is allowed');
  const bad = lintLetter('Under Property Code § 92.056(z), the tenant may terminate the lease.', 'TX').violations;
  assert.equal(bad.length, 1); assert.equal(bad[0].reason, 'subsection');
  assert.equal(lintLetter('Under Property Code § 92.056, the tenant may terminate the lease.', 'TX').violations.length, 0, 'bare section stays allowed');
  const stripped = stripUnverified('Under Property Code § 92.056(z), the tenant may do anything. I request repairs within fourteen days.', 'TX');
  assert.ok(!stripped.includes('92.056') && stripped.includes('fourteen days'));
  assert.match(lockBlock('Texas'), /subsections on file/);
  ok('subsection must be on file for the section; bare section ok; bad subsection sentence stripped; lock lists subsections');
}

// 2. sentence-final ILCS cite is not mangled by the trailing period
{
  assert.equal(lintLetter('Notice is governed by 735 ILCS 5/9-209.', 'IL').violations.length, 0);
  assert.equal(lintLetter('Repairs are governed by 765 ILCS 742/5.', 'IL').violations.length, 0);
  ok('trailing period does not break ILCS keys');
}

// 3. numeric claims
{
  const user = 'STATE: Texas\nDeposit paid: $2,400\nDemand deadline: 10 days';
  assert.equal(lintNumbers('Under Property Code § 92.0563, the court may award a civil penalty of $500.', 'TX', user).violations.length, 0, 'verified dollar figure');
  assert.equal(lintNumbers('Under Property Code § 92.0563, the court may award a civil penalty of $7,777.', 'TX', user).violations.length, 1, 'invented dollar figure');
  assert.equal(lintNumbers('Under Property Code § 92.109, you owe me three times my $2,400 deposit, or $7,200.', 'TX', user).violations.length, 0, 'user amount and computed total');
  const dep = lintNumbers('Under Property Code § 92.109, a landlord must return the deposit within 14 days.', 'TX', 'STATE: Texas').violations;
  assert.equal(dep.length, 1); assert.equal(dep[0].why, 'deposit-deadline');
  assert.equal(lintNumbers('Under Property Code § 92.103, a landlord must return the deposit within 30 days.', 'TX', 'STATE: Texas').violations.length, 0, 'verified deadline');
  assert.equal(lintNumbers('I demand the repairs within 10 days of this letter.', 'TX', user).violations.length, 0, 'no legal assertion -> not checked');
  assert.equal(lintNumbers('State law gives landlords 45 days to act.', 'TX', 'STATE: Texas').violations.length, 1, 'state-law day count');
  assert.equal(lintNumbers('Under Civil Code § 1942, the repair cost may not exceed 95% of rent.', 'CA', 'STATE: California').violations.length, 1, 'invented percent');
  const s = stripSentences('Keep this. State law gives landlords 45 days to respond. Keep that.', ['State law gives landlords 45 days to respond.']);
  assert.equal(s, 'Keep this. Keep that.');
  ok('numeric check: verified / user-supplied / computed pass; invented dollars, percents, days and wrong deposit deadline flagged; sentence stripped');
}

// 4. generate: invented figure -> one regeneration, then sentence stripped
{
  const good = 'Dear Landlord,\nUnder Property Code § 92.0563, the court may award a civil penalty of $500. Please repair within fourteen days and confirm in writing that the work has been scheduled, because the condition affects my health and my daily use of the home.\nSincerely,\nTenant';
  const badFig = 'Dear Landlord,\nUnder Property Code § 92.0563, the court may award a civil penalty of $7,777. Please repair within fourteen days and confirm in writing that the work has been scheduled, because the condition affects my health and my daily use of the home.\nSincerely,\nTenant';
  reset(badFig, good);
  let r = await gen({ userPrompt: 'STATE: Texas\nWrite a letter.', state: 'Texas' });
  assert.equal(r.code, 200); assert.equal(anthropicCalls, 2);
  assert.ok(r.body.text.includes('$500') && !r.body.text.includes('7,777'));
  assert.match(systems[0], /VERIFIED FIGURES/); assert.match(systems[1], /REGENERATION NOTICE/); assert.match(systems[1], /7,777/);
  reset(badFig);
  r = await gen({ userPrompt: 'STATE: Texas\nWrite a letter.', state: 'Texas' });
  assert.equal(anthropicCalls, 2);
  assert.ok(!r.body.text.includes('7,777') && r.body.text.includes('fourteen days') && r.body.text.endsWith('Tenant'), 'sentence stripped, letter intact');
  ok('generate: unverified figure regenerated once, then stripped');
}

// 5. checklist is locked
{
  const items = ['Send the letter by certified mail and keep the receipt.', 'File under Tex. Prop. Code § 9999.9 within 3 days.', 'Photograph every defect with dates.', 'State law caps your penalty at $7,777.', 'Keep copies of all communications.'];
  reset(JSON.stringify(items));
  let r = await cl({ state: 'Texas', issueType: 'Habitability / Repair Issues', letterExcerpt: 'x' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.checklist, [items[0], items[2], items[4]]);
  assert.match(systems[0], /CITATION LOCK/); assert.match(systems[0], /Property Code/);
  assert.match(queue[0], /./);
  reset(JSON.stringify(['See § 9999.9.', 'Per § 8888.8 you win.']));
  r = await cl({ state: 'Texas' });
  assert.ok(r.body.checklist.length >= 5 && r.body.checklist.every(x => !/9999|8888/.test(x)), 'too few clean items -> static fallback');
  reset(JSON.stringify(items));
  r = await cl({ state: 'Narnia' });
  assert.ok(!r.body.checklist.some(x => /9999|7,777/.test(x)));
  ok('checklist: lock block in prompt; unverified-citation / unverified-figure items dropped; fallback when too few remain');
}

// 6. client prompt templates (src/App.jsx): every example citation must be verified for some state (or federal)
{
  const all = new Set([...VERIFIED.federal.keys, ...Object.values(VERIFIED.states).flatMap(s => s.keys)]);
  const src = readFileSync(join(ROOT, 'src', 'App.jsx'), 'utf8');
  const a = src.indexOf('const pickSystemPrompt') >= 0 ? src.indexOf('const pickSystemPrompt') : src.indexOf('const systemPrompt');
  assert.ok(a > 0, 'prompt templates located');
  const lines = src.split('\n');
  const bad = [];
  lines.forEach((l, i) => { if (i + 1 < 300) return; for (const c of extractCitations(l)) if (!all.has(c.key)) bad.push(`${i + 1}: ${c.raw}`); });
  assert.deepEqual(bad, [], 'unverified citation examples in client templates:\n' + bad.join('\n'));
  // the sample letter and landing page must not carry presumption windows or figures the log contradicts
  assert.ok(!/90.180 day/.test(src) && !/90.180 day/.test(readFileSync(join(ROOT, 'public', 'landing.html'), 'utf8')));
  ok('client templates cite only verified authorities; no unverified presumption window');
}

globalThis.fetch = realFetch;
delete process.env.G4_TEST_CODE_SECRET;
console.log(`\nALL ${n} EXTENDED LOCK TESTS PASSED`);
