// Mock test for the letter citation lock (api/_citelint.js + api/generate.js) and the G4T- test code.
// No network, no real license codes, no Anthropic calls: global fetch is stubbed.
// node scripts/test-citelint.mjs   (exit 1 on any failure)
import assert from 'node:assert/strict';

process.env.PAYHIP_API_KEY = 'mock-payhip';
process.env.ANTHROPIC_API_KEY = 'mock-anthropic';
const SECRET = 'mock-g4-secret';

const { default: handler } = await import('../api/generate.js');
const { extractCitations, lintLetter } = await import('../api/_citelint.js');

const REAL = 'Under Civil Code § 1942, I may repair the defect and deduct the cost from rent.';
const FAKE_STAT = 'Under Cal. Civ. Code § 9999.9, you owe me triple damages.';
const FAKE_CASE = 'In Smith v. Holloway Properties, the court awarded a full refund.';
const FILLER = 'I request that you make the repairs within fourteen days of this letter and confirm in writing.';
const letter = (...s) => ['[DATE]', 'Dear Landlord,', s.join(' '), 'Sincerely,', 'Tenant'].join('\n');

let anthropicCalls, payhipVerify, payhipUsage, anthropicSystems, queue;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith('https://api.anthropic.com/')) {
    anthropicCalls++;
    anthropicSystems.push(JSON.parse(opts.body).system || '');
    const text = queue.length > 1 ? queue.shift() : queue[0];
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  }
  if (url.includes('/license/verify')) {
    payhipVerify++;
    return new Response(JSON.stringify({ data: { enabled: true, product_link: 'Kp6fH', uses: 0 } }), { status: 200 });
  }
  if (url.includes('/license/usage')) { payhipUsage++; return new Response('{}', { status: 200 }); }
  throw new Error('unexpected fetch ' + url);
};

const reset = (...q) => { anthropicCalls = 0; payhipVerify = 0; payhipUsage = 0; anthropicSystems = []; queue = q; };
async function call(body) {
  const res = { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await handler({ method: 'POST', body }, res);
  return res;
}
const gen = (accessCode, extra = {}) => call({ accessCode, systemPrompt: 'You are a tenant attorney.', userPrompt: 'STATE: California\nWrite a letter.', state: 'California', letterType: 'Habitability / Repair Issues', ...extra });

let n = 0;
const ok = name => console.log(`ok ${++n} - ${name}`);

// 1. extractor basics: real cite allowed, fake cite and fake case flagged, "Section 8" ignored
{
  const keys = extractCitations('See § 1942, §§ 92.331, 92.333(b), 735 ILCS 5/9-101, Section 8 voucher, Green v. Superior Court, 10 Cal.3d 616.').map(c => c.key);
  for (const k of ['S:1942', 'S:92.331', 'S:92.333', 'I:735/5/9-101', 'C:green', 'R:10cal3d616']) assert.ok(keys.includes(k), 'missing ' + k);
  assert.ok(!keys.includes('S:8'));
  assert.equal(lintLetter(REAL, 'CA').violations.length, 0);
  assert.equal(lintLetter(FAKE_STAT, 'CA').violations.length, 1);
  assert.equal(lintLetter(FAKE_CASE, 'CA').violations.length, 1);
  ok('extractor + lint on real / fake statute / fake case');
}

// 2. test code ignored when G4_TEST_CODE_SECRET is unset (inert): goes to Payhip, which here approves the key
{
  delete process.env.G4_TEST_CODE_SECRET;
  reset(letter(REAL, FILLER, FILLER));
  const r = await gen('G4T-' + SECRET);
  assert.equal(payhipVerify, 1, 'inert test code must hit Payhip like any code');
  assert.equal(payhipUsage, 1);
  ok('G4T- code is inert without the env var (normal Payhip path)');
}

process.env.G4_TEST_CODE_SECRET = SECRET;

// 3. fake statute + fake case: regenerate once; second draft is clean and is used
{
  reset(letter(REAL, FAKE_STAT, FAKE_CASE, FILLER), letter(REAL, FILLER, FILLER));
  const r = await gen('G4T-' + SECRET);
  assert.equal(r.code, 200);
  assert.equal(anthropicCalls, 2, 'one generation + one regeneration');
  assert.ok(!r.body.text.includes('9999.9') && !r.body.text.includes('Holloway'));
  assert.ok(r.body.text.includes('§ 1942'));
  assert.match(anthropicSystems[0], /CITATION LOCK/);
  assert.match(anthropicSystems[0], /Civil Code § 1942/);
  assert.match(anthropicSystems[1], /REGENERATION NOTICE/);
  assert.match(anthropicSystems[1], /9999\.9/);
  assert.equal(payhipVerify, 0, 'test code skips Payhip verify');
  assert.equal(payhipUsage, 0, 'test code skips the usage mark');
  ok('fake citation -> regenerated once without it; lock block in prompt; Payhip untouched');
}

// 4. fake citation survives the regeneration: the sentence is stripped, real citation kept, no third call
{
  reset(letter(REAL, FAKE_STAT, FILLER, FILLER), letter(REAL, FAKE_STAT, FAKE_CASE, FILLER, FILLER));
  const r = await gen('G4T-' + SECRET);
  assert.equal(r.code, 200);
  assert.equal(anthropicCalls, 2);
  assert.ok(!r.body.text.includes('9999.9'), 'fake statute stripped');
  assert.ok(!r.body.text.includes('Holloway'), 'fake case stripped');
  assert.ok(!r.body.text.includes('triple damages'), 'the whole sentence is removed');
  assert.ok(r.body.text.includes('§ 1942') && r.body.text.includes('fourteen days'), 'rest of the letter intact');
  assert.ok(r.body.text.startsWith('[DATE]\nDear Landlord,') && r.body.text.endsWith('Sincerely,\nTenant'));
  ok('fake citation persists after regeneration -> sentence stripped, letter otherwise intact');
}

// 5. clean output: single call, untouched
{
  const clean = letter(REAL, FILLER, FILLER);
  reset(clean);
  const r = await gen('G4T-' + SECRET);
  assert.equal(anthropicCalls, 1);
  assert.equal(r.body.text, clean);
  ok('clean letter passes through unchanged (1 model call)');
}

// 6. review pass is linted too
{
  reset(letter(REAL, FAKE_STAT, FILLER, FILLER), letter(REAL, FILLER, FILLER));
  const r = await call({ accessCode: 'G4T-' + SECRET, systemPrompt: '', userPrompt: '', reviewMode: true, draftLetter: letter(FAKE_STAT), state: 'California' });
  assert.equal(anthropicCalls, 2);
  assert.ok(!r.body.text.includes('9999.9'));
  assert.match(anthropicSystems[0], /delete any citation in the draft/);
  ok('review-mode output is linted and regenerated');
}

// 7. unknown state: nothing is verified, so every statute cite is removed
{
  reset(letter(REAL, FILLER, FILLER), letter(REAL, FILLER, FILLER));
  const r = await call({ accessCode: 'G4T-' + SECRET, systemPrompt: 'x', userPrompt: 'Write a letter.', state: 'Narnia' });
  assert.ok(!r.body.text.includes('§ 1942'));
  ok('unknown state -> no state authorities offered, unlisted citations stripped');
}

// 8. wrong test code -> normal Payhip path
{
  reset(letter(REAL, FILLER, FILLER));
  await gen('G4T-wrong');
  assert.equal(payhipVerify, 1);
  ok('wrong G4T- code is treated as an ordinary code');
}

// 9. gate check with the test code never calls the model
{
  reset(letter(REAL));
  const r = await call({ accessCode: 'G4T-' + SECRET, systemPrompt: 'Respond with only: VALID', userPrompt: 'Access check' });
  assert.equal(r.code, 200); assert.equal(r.body.text, 'VALID'); assert.equal(anthropicCalls, 0);
  ok('test-code access check returns VALID without a model call');
}

// 10. real buyer code: Payhip verify + usage mark happen, lint still applies
{
  reset(letter(REAL, FAKE_STAT, FILLER, FILLER), letter(REAL, FILLER, FILLER));
  const r = await gen('REAL-CODE-1234');
  assert.equal(payhipVerify, 1); assert.equal(payhipUsage, 1);
  assert.ok(!r.body.text.includes('9999.9'));
  ok('real code path: Payhip verify + usage mark unchanged, lint applied');
}

// 11. daily cap: 10 letters x 3 calls = 30 generation calls, then 429 (counter state is shared with the tests above)
{
  let last;
  for (let i = 0; i < 40; i++) { reset(letter(REAL, FILLER, FILLER)); last = await gen('G4T-' + SECRET); if (last.code === 429) break; }
  assert.equal(last.code, 429);
  assert.equal(anthropicCalls, 0, 'no model call once capped');
  ok('G4T- daily cap enforced (429)');
}

globalThis.fetch = realFetch;
console.log(`\nALL ${n} CITELINT TESTS PASSED`);
