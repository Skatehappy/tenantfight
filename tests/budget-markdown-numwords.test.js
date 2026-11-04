// Time budgets (mocked slow model: no path may outlive its plan limit), plain-text letters (stripMarkdown), and
// spelled-out figure lint ("thirty (30) days", "ten percent", "five hundred dollars"). No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'x'; delete process.env.G4_TEST_CODE_SECRET;
// Every budget (and every mocked delay below) is scaled by the same factor: 1000 ms here == 50 s in production.
const SCALE = 0.02; process.env.TF_BUDGET_SCALE = String(SCALE);
const CODE = 'LD-MOCK-0001';
const { default: generate } = await import('../api/generate.js');
const { default: checklist } = await import('../api/checklist.js');
const { budget } = await import('../api/_budget.js');
const { fallbackFor } = await import('../api/_checklist-fallbacks.js');
const { PRODUCT_LINK } = await import('../api/_license.js');
const { lintNumbers } = await import('../api/_citelint.js');
const { figures } = await import('../api/_numfacts.js');
const { stripMarkdown } = await import('../api/_stripmd.js');
const VERIFIED = (await import('../api/_verified-citations.js')).default;

const S = sec => sec * 1000 * SCALE;           // "production seconds" -> test ms
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

// replies: [{ after: prodSeconds | 'hang', stop, text, http }]; honours AbortSignal like real fetch
let calls, usage;
function mockSlow(replies) {
  calls = []; usage = 0;
  globalThis.fetch = (url, init = {}) => {
    const u = String(url);
    if (u.includes('/license/verify')) return Promise.resolve(new Response(JSON.stringify({ data: { enabled: true, product_link: PRODUCT_LINK } }), { status: 200 }));
    if (u.includes('/license/usage')) { usage++; return Promise.resolve(new Response('{}', { status: 200 })); }
    assert.ok(u.includes('api.anthropic.com'), 'unexpected fetch ' + u);
    const body = JSON.parse(init.body); calls.push(body);
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    return new Promise((resolve, reject) => {
      const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      if (init.signal?.aborted) return abort();
      init.signal?.addEventListener('abort', abort);
      if (r.after === 'hang') return;
      setTimeout(() => resolve(r.http ? new Response('boom', { status: r.http }) : new Response(JSON.stringify({ stop_reason: r.stop || 'end_turn', content: [{ type: 'text', text: r.text }] }), { status: 200 })), S(r.after));
    });
  };
}
function callGenerate(body) {
  return new Promise(resolve => {
    const out = { code: 200 };
    const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(o) { out.body = o; resolve(out); return this; }, end() { resolve(out); return this; } };
    generate({ method: 'POST', body: { accessCode: CODE, state: 'Georgia', systemPrompt: 'sys', userPrompt: 'Write the letter.\nSTATE: Georgia', ...body }, headers: {} }, res);
  });
}
const timed = async f => { const t = Date.now(); const r = await f(); return { ...r, ms: Date.now() - t }; };

const GOOD = 'Dear Landlord, please return my deposit and repair the heating promptly. '.repeat(6);
const BAD = GOOD + 'Georgia law requires you to return the deposit within seventy-seven days.';

// ---------------- time budgets: /api/generate (Node, 60 s plan limit, budget 50 s)
test('budget constants stay inside the plan limits', () => {
  assert.ok(budget('NODE_TOTAL') <= 50000 * SCALE + 1e-6);
  assert.ok(budget('NODE_MODEL_DEADLINE') + budget('NODE_USAGE_MARK') <= budget('NODE_TOTAL'), 'model deadline (counted from the start, license verify included) + usage mark fit in the total');
  assert.ok(budget('EDGE_VERIFY') + budget('EDGE_MODEL') <= 22000 * SCALE + 1e-6, 'checklist: first byte well under 25 s');
});

test('generate: slow draft + lint violation skips the regeneration (no stacking), strips the sentence, finishes in budget', async () => {
  mockSlow([{ after: 30, text: BAD }, { after: 1, text: GOOD }]);   // 30 s model call leaves < 24 s: no regen
  const r = await timed(() => callGenerate({}));
  assert.equal(calls.length, 1, 'regeneration skipped');
  assert.equal(r.code, 200);
  assert.ok(!/seventy-seven/.test(r.body.text), 'unverified sentence stripped instead');
  assert.ok(r.ms < budget('NODE_TOTAL'), `took ${r.ms}ms`);
});

test('generate: fast draft + violation regenerates once, regeneration hangs -> aborted at the deadline, original stripped', async () => {
  mockSlow([{ after: 5, text: BAD }, { after: 'hang' }]);
  const r = await timed(() => callGenerate({}));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].max_tokens, 3000, 'regeneration is a single attempt (no truncation retry)');
  assert.equal(r.code, 200);
  assert.ok(!/seventy-seven/.test(r.body.text));
  assert.ok(r.ms < budget('NODE_TOTAL'), `took ${r.ms}ms`);
});

test('generate: regeneration that is itself truncated is not retried (still one call each)', async () => {
  mockSlow([{ after: 5, text: BAD }, { after: 5, stop: 'max_tokens', text: 'HALF' }, { after: 5, text: GOOD }]);
  const r = await callGenerate({});
  assert.equal(calls.length, 2);
  assert.equal(r.code, 200);
  assert.ok(!/HALF/.test(r.body.text) && !/seventy-seven/.test(r.body.text));
});

test('generate: truncated draft with too little time left skips the retry -> error, license not burned, in budget', async () => {
  mockSlow([{ after: 30, stop: 'max_tokens', text: 'HALF A LETTER' }, { after: 1, text: GOOD }]);
  const r = await timed(() => callGenerate({}));
  assert.equal(calls.length, 1, 'retry skipped');
  assert.equal(r.code, 502);
  assert.equal(usage, 0);
  assert.ok(!JSON.stringify(r.body).includes('HALF A LETTER'));
  assert.ok(r.ms < budget('NODE_TOTAL'), `took ${r.ms}ms`);
});

test('generate: truncated draft with time left still retries once with the higher limit', async () => {
  mockSlow([{ after: 5, stop: 'max_tokens', text: 'HALF' }, { after: 5, text: GOOD }]);
  const r = await callGenerate({});
  assert.deepEqual(calls.map(c => c.max_tokens), [3000, 6000]);
  assert.equal(r.code, 200);
});

test('generate: a model call that never answers is aborted -> 504 inside the budget, license not burned', async () => {
  mockSlow([{ after: 'hang' }]);
  const r = await timed(() => callGenerate({}));
  assert.equal(r.code, 504);
  assert.match(r.body.error, /not been used/);
  assert.equal(usage, 0);
  assert.ok(r.ms < budget('NODE_TOTAL'), `took ${r.ms}ms`);
});

test('generate: draft/review/assertive worst-case matrix - no combination of delays outlives the budget', async () => {
  const delays = [0, 8, 20, 30, 41, 'hang'];
  for (const mode of [{}, { reviewMode: true, draftLetter: GOOD }]) {
    for (const d1 of delays) for (const d2 of [1, 20, 'hang']) for (const stop of ['end_turn', 'max_tokens']) for (const text of [GOOD, BAD]) {
      mockSlow([{ after: d1, stop, text }, { after: d2, stop, text }, { after: d2, stop, text }]);
      const r = await timed(() => callGenerate(mode));
      assert.ok(calls.length <= 2 || (stop === 'max_tokens' && calls.length <= 2), `calls=${calls.length}`);
      assert.ok(r.ms < budget('NODE_TOTAL'), `d1=${d1} d2=${d2} ${stop} took ${r.ms}ms (limit ${budget('NODE_TOTAL')})`);
      assert.ok(usage <= 1);
    }
  }
});

// ---------------- time budgets: /api/checklist (Edge, must respond within 25 s; model time <= 20 s)
async function callChecklist() {
  const res = await checklist(new Request('http://x/api/checklist', { method: 'POST', body: JSON.stringify({ accessCode: CODE, state: 'Georgia', issueType: 'Utility Shutoff', letterExcerpt: 'x' }) }));
  return { status: res.status, ...(await res.json()) };
}
test('checklist: hanging model -> fallback list, inside the Edge first-byte limit', async () => {
  mockSlow([{ after: 'hang' }]);
  const r = await timed(callChecklist);
  assert.equal(r.status, 200);
  assert.deepEqual(r.checklist, fallbackFor('Utility Shutoff'));
  assert.ok(r.ms < S(25), `took ${r.ms}ms, limit ${S(25)}`);
  assert.ok(r.ms <= S(20) + S(2), 'model time <= 20 s');
});

test('checklist: truncated + slow skips the retry; truncated + fast still retries once', async () => {
  mockSlow([{ after: 14, stop: 'max_tokens', text: '["PARTIAL"]' }, { after: 1, text: '[]' }]);
  let r = await timed(callChecklist);
  assert.equal(calls.length, 1, 'retry skipped, only 4 s left');
  assert.deepEqual(r.checklist, fallbackFor('Utility Shutoff'));
  assert.ok(r.ms < S(25));
  const items = Array.from({ length: 8 }, (_, i) => `Keep dated record number ${i + 1} and send a copy by certified mail`);
  mockSlow([{ after: 2, stop: 'max_tokens', text: '["PARTIAL"]' }, { after: 2, text: JSON.stringify(items) }]);
  r = await callChecklist();
  assert.equal(calls.length, 2);
  assert.deepEqual(r.checklist, items);
});

test('checklist: delay matrix never outlives the Edge limit', async () => {
  for (const d1 of [0, 5, 12, 17, 'hang']) for (const stop of ['end_turn', 'max_tokens']) for (const d2 of [1, 10, 'hang']) {
    mockSlow([{ after: d1, stop, text: '["PARTIAL"]' }, { after: d2, stop, text: '["PARTIAL"]' }]);
    const r = await timed(callChecklist);
    assert.equal(r.status, 200);
    assert.ok(r.ms < S(25), `d1=${d1} d2=${d2} ${stop}: ${r.ms}ms`);
  }
});

// ---------------- stripMarkdown
test('stripMarkdown: headings, bold, italics, bullets, tables, fences, rules, links', () => {
  const md = '# Demand Letter\n## Re: Deposit\n\n**Bold claim** and __also bold__ and *italic* and _under_ text.\n* first\n+ second\n- third\n\n| Item | Cost |\n|------|------|\n| Paint | $50 |\n\n```\ncode line\n```\n---\n> quoted\nSee [the statute](https://example.org/x) and `inline`.';
  const out = stripMarkdown(md);
  assert.equal(out, 'Demand Letter\nRe: Deposit\n\nBold claim and also bold and italic and under text.\n- first\n- second\n- third\n\nItem, Cost\nPaint, $50\n\ncode line\n\nquoted\nSee the statute (https://example.org/x) and inline.');
  assert.doesNotMatch(out, /[#*_`|]/);
});
test('stripMarkdown: leaves legitimate plain-text characters alone', () => {
  const t = 'Dear Mr. Smith,\n\nI paid $1,200 on [DATE] (see Ex. 1). 3 * 4 = 12 and snake_case_word stay; 1. First\n2. Second\n\nSincerely,\nJ. Doe';
  assert.equal(stripMarkdown(t), t);
  assert.equal(stripMarkdown(''), ''); assert.equal(stripMarkdown(null), '');
});
test('generate: markdown from the model never reaches the buyer, and the prompt asks for plain text', async () => {
  mockSlow([{ after: 1, text: '# Heading\n\n**Dear Landlord,** ' + GOOD + '\n* point one' }]);
  const r = await callGenerate({});
  assert.equal(r.code, 200);
  assert.doesNotMatch(r.body.text, /[#*]/);
  assert.match(calls[0].system, /plain text only/i);
});

// ---------------- spelled-out figures
const kv = t => figures(t).map(f => f.kind + f.value).sort().join(',');
test('figures(): spelled-out, hyphenated and parenthetical forms', () => {
  assert.equal(kv('thirty days'), 'd30');
  assert.equal(kv('thirty (30) days'), 'd30');
  assert.equal(kv('within thirty-six calendar days'), 'd36');
  assert.equal(kv('one hundred twenty days'), 'd120');
  assert.equal(kv('ten percent'), '%10');
  assert.equal(kv('twenty-five percent (25%)'), '%25,%25');
  assert.equal(kv('five hundred dollars'), '$500');
  assert.equal(kv('one thousand five hundred dollars'), '$1500');
  assert.equal(kv('thirty (31) days'), 'd30,d31', 'words and digits that disagree are both claims');
  assert.equal(kv('ten twenty days'), '', 'malformed runs are ignored');
  assert.equal(kv('6 months and two years'), '', 'months / years are deliberately not figures');
  assert.equal(kv('$500, 30 days, 5%'), '$500,%5,d30');
});

const GA = 'GA';
const flagged = (t, user = '') => lintNumbers(t, GA, user).violations.map(v => v.why);
test('lintNumbers: GA verified sets hold what these tests assume', () => {
  const n = VERIFIED.states.GA.nums;
  for (const v of [77, 36, 25]) assert.ok(!n.days.includes(v));
  assert.ok(n.days.includes(30) && n.days.includes(60) && n.dollars.includes(500) && !n.percents.includes(37) && !n.dollars.includes(483));
});
test('lintNumbers: spelled-out unverified legal figures ARE caught', () => {
  assert.deepEqual(flagged('Georgia law requires the landlord to act within seventy-seven days.'), ['days']);
  assert.deepEqual(flagged('Under O.C.G.A. § 44-7-34 the landlord has thirty-six (36) days.'), ['days']);
  assert.deepEqual(flagged('State law requires a thirty-seven percent penalty.'), ['percent']);
  assert.deepEqual(flagged('The statute allows four hundred eighty-three dollars in damages.'), ['dollars']);
  assert.deepEqual(flagged('State law requires thirty (31) days notice.'), ['days'], 'a digit that contradicts the words is caught');
  assert.deepEqual(flagged('Georgia law requires the return within thirty (30) days, or ten percent interest.'), ['percent']);
});
test('lintNumbers: spelled-out VERIFIED, user-supplied and non-legal figures are NOT caught', () => {
  assert.deepEqual(flagged('Georgia law requires you to return the deposit within thirty (30) days.'), []);
  assert.deepEqual(flagged('State law requires sixty days notice and five hundred dollars.'), []);
  assert.deepEqual(flagged('State law requires a response within ten days.', 'RESPONSE DEADLINE: ten days'), [], 'user wrote ten days');
  assert.deepEqual(flagged('State law gives you seventy-seven days.', 'I was told seventy-seven days'), [], 'user wrote seventy-seven days');
  assert.deepEqual(flagged('State law lets me recover three hundred dollars.', 'DEPOSIT AMOUNT: $100'), [], 'computed from the user amount');
  assert.deepEqual(flagged('I will file suit if you do not pay within seventy-seven days.'), [], 'a demand, not a statement of law');
  assert.deepEqual(flagged('Georgia law requires nothing for six months or two years.'), [], 'months / years are out of scope');
});
