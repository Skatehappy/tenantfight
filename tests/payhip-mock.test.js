// Payhip license verification against a MOCKED Payhip (global fetch is stubbed; nothing leaves the machine).
// Covers: the verify decision matrix, fail-closed behaviour, and that a code is only marked used after a
// letter was actually delivered (never on a model error or a letter that failed the citation check).
// node --test tests/payhip-mock.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PAYHIP_API_KEY = 'mock-payhip';
process.env.ANTHROPIC_API_KEY = 'mock-anthropic';
delete process.env.G4_TEST_CODE_SECRET;
const { verifyLicense, PRODUCT_LINK } = await import('../api/_license.js');
const { default: generate } = await import('../api/generate.js');

let payhip = 'valid', anthropic = 'ok', usage = 0, verifyUrls = [], anthropicCalls = 0, verifyHeaders = [];
const LETTER = 'Dear Landlord,\n' + 'I am writing about the condition of my apartment and ask that you make the repairs listed below within fourteen days and confirm in writing. '.repeat(3) + '\nSincerely,\nTenant';
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.anthropic.com/')) {
    anthropicCalls++;
    if (anthropic === 'error') return new Response('boom', { status: 529 });
    const text = anthropic === 'badcite' ? 'Per Cal. Civ. Code § 9999.9 you owe me triple damages.' : LETTER;
    return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 });
  }
  if (u.includes('/license/usage')) { usage++; return new Response('{}', { status: 200 }); }
  if (u.includes('/license/verify')) {
    verifyUrls.push(u); verifyHeaders.push(opts.headers || {});
    switch (payhip) {
      case 'valid': return new Response(JSON.stringify({ data: { enabled: true, product_link: PRODUCT_LINK, uses: 0 } }), { status: 200 });
      case 'used': return new Response(JSON.stringify({ data: { enabled: true, product_link: PRODUCT_LINK, uses: 5 } }), { status: 200 });
      case 'disabled': return new Response(JSON.stringify({ data: { enabled: false, product_link: PRODUCT_LINK } }), { status: 200 });
      case 'otherproduct': return new Response(JSON.stringify({ data: { enabled: true, product_link: 'ZZZZZ' } }), { status: 200 });
      case 'notfound': return new Response('{}', { status: 404 });
      case 'http500': return new Response('x', { status: 500 });
      case 'notjson': return new Response('<html>', { status: 200 });
      case 'down': throw new Error('ECONNRESET');
    }
  }
  throw new Error('unexpected fetch ' + u);
};
const reset = () => { usage = 0; verifyUrls = []; verifyHeaders = []; anthropicCalls = 0; anthropic = 'ok'; payhip = 'valid'; };
async function call(body) {
  const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await generate({ method: 'POST', body }, res);
  return res;
}
const REQ = { systemPrompt: 'S', userPrompt: 'STATE: California\nWrite the letter.', state: 'California' };

test('verifyLicense decision matrix', async () => {
  reset();
  for (const [mode, want] of [['valid', { ok: true }], ['used', { ok: true }], ['disabled', { ok: false, status: 401 }], ['otherproduct', { ok: false, status: 401 }], ['notfound', { ok: false, status: 401 }], ['http500', { ok: false, status: 401 }], ['notjson', { ok: false, status: 503 }], ['down', { ok: false, status: 503 }]]) {
    payhip = mode;
    const r = await verifyLicense('ABC-123', PRODUCT_LINK, 'k');
    assert.equal(r.ok, want.ok, mode);
    if (!want.ok) assert.equal(r.status, want.status, mode);
  }
  assert.equal((await verifyLicense('   ', PRODUCT_LINK, 'k')).status, 401, 'blank code');
});

test('verify call: product link + key in header, code URL-encoded, key never in the URL', async () => {
  reset();
  await verifyLicense('A B&C', PRODUCT_LINK, 'secret-key');
  assert.match(verifyUrls[0], /product_link=Kp6fH/);
  assert.match(verifyUrls[0], /license_key=A%20B%26C/);
  assert.ok(!verifyUrls[0].includes('secret-key'));
  assert.equal(verifyHeaders[0]['payhip-api-key'], 'secret-key');
});

test('good code: letter delivered, usage marked exactly once', async () => {
  reset();
  const r = await call({ accessCode: 'GOOD-1', ...REQ });
  assert.equal(r.code, 200); assert.equal(anthropicCalls, 1); assert.equal(usage, 1);
});

test('model error: 502 and the code is NOT marked used', async () => {
  reset(); anthropic = 'error';
  const r = await call({ accessCode: 'GOOD-1', ...REQ });
  assert.equal(r.code, 502); assert.equal(usage, 0);
});

test('letter that fails the citation check is not delivered and the code is NOT marked used', async () => {
  reset(); anthropic = 'badcite';
  const r = await call({ accessCode: 'GOOD-1', ...REQ });
  assert.equal(r.code, 500); assert.equal(usage, 0);
});

test('rejected / unverifiable codes never reach the model or the usage mark', async () => {
  for (const mode of ['disabled', 'otherproduct', 'notfound', 'http500', 'notjson', 'down']) {
    reset(); payhip = mode;
    const r = await call({ accessCode: 'X-1', ...REQ });
    assert.ok(r.code === 401 || r.code === 503, `${mode} -> ${r.code}`);
    assert.equal(anthropicCalls, 0, mode); assert.equal(usage, 0, mode);
  }
});

test('oversized input is a 400 with the code untouched', async () => {
  reset();
  const r = await call({ accessCode: 'GOOD-1', ...REQ, userPrompt: 'x'.repeat(30000) });
  assert.equal(r.code, 400); assert.equal(anthropicCalls, 0); assert.equal(usage, 0);
});
