// scripts/test-auth.mjs — auth gate: api/generate.js and api/checklist.js must never reach
// api.anthropic.com without a passed Payhip verify (or a G4T test code); access
// checks never call the model or mark usage; no hard-coded bypass keys anywhere. Stubbed fetch only.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.PAYHIP_API_KEY = 'mock-payhip';
process.env.ANTHROPIC_API_KEY = 'mock-anthropic';
delete process.env.G4_TEST_CODE_SECRET;

const { default: generate } = await import('../api/generate.js');
const { default: checklist } = await import('../api/checklist.js');

let payhipMode = 'valid', anthropicCalls = 0, usageMarks = 0, verifyCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) {
    anthropicCalls++;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '["a","b"]' }] }), { status: 200 });
  }
  if (u.includes('/license/usage')) { usageMarks++; return new Response('{}', { status: 200 }); }
  if (u.includes('/license/verify')) {
    verifyCalls++;
    if (payhipMode === 'down') throw new Error('network');
    if (payhipMode === 'http500') return new Response('x', { status: 500 });
    if (payhipMode === 'notfound') return new Response('{}', { status: 404 });
    if (payhipMode === 'nodata') return new Response(JSON.stringify({}), { status: 200 });
    if (payhipMode === 'disabled') return new Response(JSON.stringify({ data: { enabled: false, product_link: 'Kp6fH' } }), { status: 200 });
    if (payhipMode === 'wrongproduct') return new Response(JSON.stringify({ data: { enabled: true, product_link: 'zzzzz' } }), { status: 200 });
    return new Response(JSON.stringify({ data: { enabled: true, product_link: 'Kp6fH', uses: 0 } }), { status: 200 });
  }
  throw new Error('unexpected fetch ' + u);
};

function mkRes() {
  const r = { code: 200, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
async function callGenerate(body) { const res = mkRes(); await generate({ method: 'POST', body }, res); return { status: res.code, body: res.body }; }
async function callChecklist(body) {
  const r = await checklist(new Request('http://x/api/checklist', { method: 'POST', body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json() };
}
const reset = () => { anthropicCalls = 0; usageMarks = 0; verifyCalls = 0; };

// 1. Denied paths: Anthropic is never reached on either endpoint.
const gen = { systemPrompt: 'S', userPrompt: 'STATE: Texas\nwrite a letter' };
const deny = [
  ['no code', null, 'valid', 401], ['blank code', '  ', 'valid', 401],
  ['fake code (Payhip 404)', 'FAKE-1', 'notfound', 401], ['Payhip http 500', 'FAKE-1', 'http500', 401],
  ['Payhip no data', 'FAKE-1', 'nodata', 401], ['license disabled', 'FAKE-1', 'disabled', 401],
  ['wrong product', 'FAKE-1', 'wrongproduct', 401], ['Payhip unreachable', 'FAKE-1', 'down', 503],
];
for (const [name, code, mode, want] of deny) {
  payhipMode = mode;
  for (const [ep, fn, body] of [['generate', callGenerate, { ...gen, accessCode: code }], ['checklist', callChecklist, { accessCode: code, state: 'Texas' }]]) {
    reset();
    const r = await fn(body);
    assert.equal(r.status, want, `${ep}: ${name} -> ${r.status}`);
    assert.equal(anthropicCalls, 0, `${ep}: ${name} reached Anthropic`);
    assert.equal(usageMarks, 0, `${ep}: ${name} marked usage`);
  }
}

// 2. A G4T-looking code with no secret configured is just a bad code.
payhipMode = 'notfound'; reset();
assert.equal((await callGenerate({ ...gen, accessCode: 'G4T-ANYTHING' })).status, 401);
assert.equal(anthropicCalls, 0);

// 3. Access check: 3 checks of a valid code => verify only; zero model calls, zero usage marks.
payhipMode = 'valid'; reset();
for (const sp of ['Respond with only: VALID', 'Reply: VALID', 'anything']) {
  const r = await callGenerate({ accessCode: 'GOOD-1', systemPrompt: sp, userPrompt: 'Access check' });
  assert.equal(r.status, 200); assert.equal(r.body.text, 'VALID');
}
assert.equal(anthropicCalls, 0, 'access check called the model');
assert.equal(usageMarks, 0, 'access check marked usage');
assert.equal(verifyCalls, 3, 'access check must verify the license every time');
// ... and a bad code on the check path is still rejected.
payhipMode = 'notfound'; reset();
assert.equal((await callGenerate({ accessCode: 'BAD', systemPrompt: 'Respond with only: VALID', userPrompt: 'Access check' })).status, 401);

// 4. Valid code passes: checklist reaches Anthropic exactly once, after verify, with no usage mark.
payhipMode = 'valid'; reset();
const c = await callChecklist({ accessCode: 'GOOD-1', state: 'Texas' });
assert.equal(c.status, 200); assert.equal(anthropicCalls, 1); assert.ok(verifyCalls >= 1);
assert.equal(usageMarks, 0, 'checklist must not mark usage');

// 5. G4T with the secret configured: accepted for generate checks without Payhip; bad suffix rejected;
//    the checklist does not accept G4T.
process.env.G4_TEST_CODE_SECRET = 'UNITTESTSECRET12345';
payhipMode = 'notfound'; reset();
const g = await callGenerate({ accessCode: 'G4T-UNITTESTSECRET12345', systemPrompt: 'Respond with only: VALID', userPrompt: 'Access check' });
assert.equal(g.status, 200); assert.equal(anthropicCalls, 0); assert.equal(usageMarks, 0);
assert.equal((await callGenerate({ ...gen, accessCode: 'G4T-WRONG' })).status, 401);
// 5b. G4T on the checklist: wrong secret -> 401 and no Anthropic; correct secret -> Anthropic exactly
//     once, no Payhip verify, no usage mark; and with the secret unset the same code is just a bad code.
payhipMode = 'notfound'; reset();
let k = await callChecklist({ accessCode: 'G4T-WRONG', state: 'Texas' });
assert.equal(k.status, 401); assert.equal(anthropicCalls, 0, 'checklist: wrong G4T secret reached Anthropic');
reset();
k = await callChecklist({ accessCode: 'G4T-UNITTESTSECRET12345', state: 'Texas' });
assert.equal(k.status, 200); assert.equal(anthropicCalls, 1, 'checklist: valid G4T should reach Anthropic once');
assert.equal(verifyCalls, 0, 'checklist: G4T must skip Payhip'); assert.equal(usageMarks, 0);
delete process.env.G4_TEST_CODE_SECRET; reset();
k = await callChecklist({ accessCode: 'G4T-UNITTESTSECRET12345', state: 'Texas' });
assert.equal(k.status, 401, 'checklist: G4T with secret unset must be rejected'); assert.equal(anthropicCalls, 0);
process.env.G4_TEST_CODE_SECRET = 'UNITTESTSECRET12345';
delete process.env.G4_TEST_CODE_SECRET;
globalThis.fetch = realFetch;

// 6. Static: every api handler that can reach Anthropic must call the shared verify, and
//    no known bypass keys / env bypass lists exist anywhere shipped.
const apiDir = join(ROOT, 'api');
for (const f of readdirSync(apiDir).filter(f => f.endsWith('.js') && !f.startsWith('_'))) {
  const src = readFileSync(join(apiDir, f), 'utf8');
  if (src.includes('api.anthropic.com') || src.includes('callModel')) assert.ok(/verifyLicense\s*\(/.test(src), `${f}: reaches Anthropic without verifyLicense()`);
}
for (const f of readdirSync(apiDir).filter(f => f.startsWith('_') && f.endsWith('.js'))) {
  assert.ok(!readFileSync(join(apiDir, f), 'utf8').includes('api.anthropic.com'), `${f}: helper reaches Anthropic directly`);
}
const BAD = ['SMOKE' + '-TEST', 'TEST' + '_KEYS', 'ACCESS' + '_CODES', 'BAO' + '"', 'BAO' + "'"];
function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    if (['node_modules', '.git', 'dist', '.vercel'].includes(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(js|mjs|jsx|json|html|md)$/.test(n)) out.push(p);
  }
  return out;
}
for (const d of ['api', 'src', 'scripts', 'public']) {
  if (!existsSync(join(ROOT, d))) continue;
  for (const p of walk(join(ROOT, d))) {
    if (p.endsWith('test-auth.mjs')) continue;
    const t = readFileSync(p, 'utf8');
    for (const b of BAD) assert.ok(!t.includes(b), `bypass string "${b}" in ${p}`);
  }
}
if (existsSync(join(ROOT, 'vercel.json'))) for (const b of BAD) assert.ok(!readFileSync(join(ROOT, 'vercel.json'), 'utf8').includes(b), 'bypass string in vercel.json');

console.log('test-auth: all assertions passed');
