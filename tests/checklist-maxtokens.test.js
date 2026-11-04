// Checklist + generate: truncation handling and per-letter-type content (mocked Anthropic; no network).
//  - stop_reason "max_tokens" is never parsed: retried once with a higher limit, then fallback / error
//  - every letter type gets type-appropriate items from the model path and its own fallback on forced failure
//  - fallback items carry no deposit wording on non-deposit types, no citations, no figures
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'x'; delete process.env.G4_TEST_CODE_SECRET;
const CODE = 'LD-MOCK-0001';  // a real-buyer code; Payhip is mocked below
const { default: checklist } = await import('../api/checklist.js');
const { default: generate } = await import('../api/generate.js');
const { TYPES, fallbackFor } = await import('../api/_checklist-fallbacks.js');
const { PRODUCT_LINK } = await import('../api/_license.js');
const { lintLetter, lintNumbers, STATE_ABBR } = await import('../api/_citelint.js');

const TYPE_NAMES = Object.keys(TYPES);
const DEPOSIT = new Set(['Security Deposit Not Returned', 'Illegal Deductions from Deposit']);
const realFetch = globalThis.fetch;
let calls, usage = 0;
function mockModel(replies) {
  calls = []; usage = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/license/verify')) return new Response(JSON.stringify({ data: { enabled: true, product_link: PRODUCT_LINK } }), { status: 200 });
    if (u.includes('/license/usage')) { usage++; return new Response('{}', { status: 200 }); }
    assert.ok(u.includes('api.anthropic.com'), 'unexpected fetch: ' + u);
    const body = JSON.parse(init.body); calls.push(body);
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (r.http) return new Response('boom', { status: r.http });
    return new Response(JSON.stringify({ stop_reason: r.stop || 'end_turn', content: [{ type: 'text', text: r.text }] }), { status: 200 });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

const callChecklist = async (issueType, state = 'Georgia') => {
  const res = await checklist(new Request('http://x/api/checklist', { method: 'POST', body: JSON.stringify({ accessCode: CODE, state, issueType, letterExcerpt: 'excerpt' }) }));
  return { status: res.status, ...(await res.json()) };
};
const modelItems = type => Array.from({ length: 8 }, (_, i) => `Model step ${i + 1} for ${type}: keep dated records and send copies by certified mail`);

for (const type of TYPE_NAMES) {
  test(`checklist model path returns the model's type-appropriate items: ${type}`, async () => {
    mockModel([{ text: JSON.stringify(modelItems(type)) }]);
    const r = await callChecklist(type);
    assert.equal(r.status, 200);
    assert.deepEqual(r.checklist, modelItems(type));
    assert.equal(r._diag, undefined, 'real buyers never see diagnostics');
    assert.match(calls[0].messages[0].content, new RegExp(TYPES[type].focus.slice(0, 20)), 'prompt is built for this letter type');
    assert.equal(calls[0].max_tokens, 2000);
    if (!DEPOSIT.has(type)) assert.doesNotMatch(calls[0].messages[0].content, /security deposit dispute/i, 'no deposit framing for non-deposit types');
  });

  test(`forced model failure returns this type's own fallback: ${type}`, async () => {
    mockModel([{ http: 500 }]);
    const r = await callChecklist(type);
    assert.equal(r.status, 200);
    assert.deepEqual(r.checklist, fallbackFor(type));
    assert.ok(r.checklist.length >= 6);
    if (!DEPOSIT.has(type)) assert.ok(!r.checklist.some(i => /deposit/i.test(i)), 'no deposit wording on a non-deposit letter');
  });

  test(`fallback content is verified-content-only (no cites, no figures, no deadlines): ${type}`, () => {
    const items = fallbackFor(type);
    for (const abbr of Object.values(STATE_ABBR)) {
      const text = items.join('\n');
      assert.deepEqual(lintLetter(text, abbr).found, [], 'fallback cites nothing');
      assert.deepEqual(lintNumbers(text, abbr, '').violations, [], 'fallback states no unverified figure');
    }
    assert.ok(!items.some(i => /\d/.test(i)), 'no digits at all in fallback items');
  });
}

test('checklist: GA utility shutoff fallback is the utility list, not the deposit list', () => {
  const items = fallbackFor('Utility Shutoff');
  assert.ok(items.some(i => /utility/i.test(i)));
  assert.ok(!items.some(i => /deposit|move-out/i.test(i)));
});

test('checklist: truncated reply is retried once with a higher limit and the partial is never parsed', async () => {
  const partial = '["PARTIAL-ONLY item one", "PARTIAL-ONLY item two", "PARTIAL-ONLY item three", "PARTIAL-ONLY item f';
  mockModel([{ stop: 'max_tokens', text: partial }, { text: JSON.stringify(modelItems('Utility Shutoff')) }]);
  const r = await callChecklist('Utility Shutoff');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].max_tokens, 2000); assert.equal(calls[1].max_tokens, 4000);
  assert.deepEqual(r.checklist, modelItems('Utility Shutoff'));
  assert.ok(!JSON.stringify(r).includes('PARTIAL-ONLY'));
});

test('checklist: truncated twice falls back to the type list and never uses partial output', async () => {
  const partial = '["PARTIAL-ONLY one", "PARTIAL-ONLY two", "PARTIAL-ONLY three", "PARTIAL-ONLY four"]';  // even a parseable body is ignored when truncated
  mockModel([{ stop: 'max_tokens', text: partial }, { stop: 'max_tokens', text: partial }]);
  const r = await callChecklist('Utility Shutoff');
  assert.equal(calls.length, 2, 'exactly one retry');
  assert.deepEqual(r.checklist, fallbackFor('Utility Shutoff'));
  assert.ok(!JSON.stringify(r).includes('PARTIAL-ONLY'));
});

test('checklist: an unknown or missing letter type gets the neutral list', async () => {
  mockModel([{ http: 500 }]);
  const r = await callChecklist(undefined);
  assert.deepEqual(r.checklist, fallbackFor('Other Landlord Violation'));
  assert.ok(!r.checklist.some(i => /deposit/i.test(i)));
});

// ---- generate (Node-style handler)
function callGenerate(body) {
  return new Promise(resolve => {
    const out = { headers: {}, code: 200 };
    const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(o) { out.body = o; resolve(out); return this; }, end() { resolve(out); return this; } };
    generate({ method: 'POST', body: { accessCode: CODE, state: 'Georgia', systemPrompt: 'sys', userPrompt: 'Write the letter.\nSTATE: Georgia', ...body }, headers: {} }, res);
  });
}

test('generate: truncated letter is retried once with a higher limit, then the full letter is used', async () => {
  const letter = 'Dear Landlord, restore the heat today. '.repeat(10);
  mockModel([{ stop: 'max_tokens', text: 'HALF A LETTER' }, { text: letter }]);
  const r = await callGenerate({});
  assert.equal(r.code, 200);
  assert.equal(calls[0].max_tokens, 3000); assert.equal(calls[1].max_tokens, 6000);
  assert.equal(r.body.text, letter);
  assert.ok(!JSON.stringify(r.body).includes('HALF A LETTER'));
  assert.equal(usage, 1, 'the delivered letter marks the license used');
});

test('generate: truncated twice returns an error, never the partial letter', async () => {
  mockModel([{ stop: 'max_tokens', text: 'HALF A LETTER ' + 'x'.repeat(400) }]);
  const r = await callGenerate({});
  assert.equal(r.code, 502);
  assert.equal(calls.length, 2, 'exactly one retry');
  assert.ok(!JSON.stringify(r.body).includes('HALF A LETTER'));
  assert.match(r.body.error, /not been used/);
  assert.equal(usage, 0, 'the license is NOT marked used when the letter was truncated');
});
