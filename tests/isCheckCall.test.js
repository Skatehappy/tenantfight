// The unlock-screen access check must validate the license and answer VALID without ever calling the
// model or marking the code used. Historical bug: the client sent "Respond with only: VALID" while the
// server matched "Reply: VALID", so every check fell through to a real generation and burned the code.
// node --test tests/isCheckCall.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PAYHIP_API_KEY = 'mock-payhip';
process.env.ANTHROPIC_API_KEY = 'mock-anthropic';
delete process.env.G4_TEST_CODE_SECRET;
const { default: generate } = await import('../api/generate.js');

let anthropic = 0, usage = 0, verify = 0;
globalThis.fetch = async url => {
  const u = String(url);
  if (u.startsWith('https://api.anthropic.com/')) { anthropic++; return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Dear Landlord, please repair. '.repeat(10) }] }), { status: 200 }); }
  if (u.includes('/license/usage')) { usage++; return new Response('{}', { status: 200 }); }
  if (u.includes('/license/verify')) { verify++; return new Response(JSON.stringify({ data: { enabled: true, product_link: 'Kp6fH' } }), { status: 200 }); }
  throw new Error('unexpected fetch ' + u);
};
const reset = () => { anthropic = 0; usage = 0; verify = 0; };
async function call(body) {
  const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await generate({ method: 'POST', body }, res);
  return res;
}

test('the client check string and the server check strings agree', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const app = readFileSync(join(ROOT, 'src', 'App.jsx'), 'utf8');
  const gen = readFileSync(join(ROOT, 'api', 'generate.js'), 'utf8');
  const sent = app.match(/accessCode: code, systemPrompt: "([^"]+)", userPrompt: "([^"]+)"/);
  assert.ok(sent, 'client access-check call found');
  assert.ok(gen.includes(`'${sent[1]}'`) || gen.includes(`'${sent[2]}'`), 'server recognises what the client sends');
});

for (const [name, sp, up] of [['client string', 'Respond with only: VALID', 'Access check'], ['legacy string', 'Reply: VALID', 'x'], ['user prompt only', 'whatever', 'Access check']]) {
  test(`check call (${name}) -> VALID, one license verify, no model call, no usage mark`, async () => {
    reset();
    const r = await call({ accessCode: 'GOOD-1', systemPrompt: sp, userPrompt: up });
    assert.equal(r.code, 200); assert.equal(r.body.text, 'VALID');
    assert.equal(verify, 1); assert.equal(anthropic, 0); assert.equal(usage, 0);
  });
}

test('a real generation request is not mistaken for a check', async () => {
  reset();
  const r = await call({ accessCode: 'GOOD-1', systemPrompt: 'You are a tenant attorney.', userPrompt: 'STATE: California\nWrite a letter.', state: 'California' });
  assert.equal(r.code, 200); assert.notEqual(r.body.text, 'VALID');
  assert.equal(anthropic, 1); assert.equal(usage, 1);
});

test('the review pass (empty prompts + draft) is a generation, not a check', async () => {
  reset();
  const r = await call({ accessCode: 'GOOD-1', systemPrompt: '', userPrompt: '', reviewMode: true, draftLetter: 'Dear Landlord, please repair.', state: 'California' });
  assert.equal(r.code, 200); assert.notEqual(r.body.text, 'VALID'); assert.equal(anthropic, 1);
});

test('a check with a bad code is rejected (401) and still costs nothing', async () => {
  reset();
  globalThis.fetch = async url => String(url).includes('/license/verify') ? new Response('{}', { status: 404 }) : (() => { throw new Error('should not be called'); })();
  const r = await call({ accessCode: 'FAKE', systemPrompt: 'Respond with only: VALID', userPrompt: 'Access check' });
  assert.equal(r.code, 401);
});
