// NO ATTORNEY VOICE: letters are written and signed by the tenant. Lint unit tests, generate behaviour (mocked
// model), checklist items, every letter-type prompt, and static samples/templates. No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'x'; delete process.env.G4_TEST_CODE_SECRET;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { voiceHits, SIGNER_RULE } = await import('../api/_voicelint.js');
const { default: generate } = await import('../api/generate.js');
const { default: checklist } = await import('../api/checklist.js');
const { fallbackFor, TYPES } = await import('../api/_checklist-fallbacks.js');
const { PRODUCT_LINK } = await import('../api/_license.js');

const BANNED = [
  'Attorney for the Tenant', 'ATTORNEY  FOR   THE TENANT', 'attorney\nfor the tenant', 'Attorney for Tenant', 'Attorney for [Your Name]', 'Attorney for me',
  'Jane Doe, Esq.', 'JANE DOE ESQ', 'Jane Doe, Esquire', 'esquire',
  'Counsel for the Tenant', 'counsel for  Ms. Doe', 'Counsel for [Tenant]',
  'I write on behalf of my client', 'ON  BEHALF  OF  MY  CLIENT', 'on behalf of my client',
  'my client', 'Our client', 'This firm represents the tenant', 'our law firm represents',
  'Attorney at Law', 'attorney and counselor at law', 'Law Office of Jane Doe', 'law offices of Doe',
  'Attorney’s fees. Attorney for the Tenant',
];
const LEGIT = [
  'You may wish to consult an attorney.', 'the tenant may recover reasonable attorney’s fees', "attorney's fees and costs", 'file a complaint with the state attorney general',
  'consider a free consult with a local tenant legal-aid group or an attorney', 'consult counsel for advice if this continues', 'consult an attorney for guidance',
  'Retain an attorney', 'no attorney needed', 'I am the tenant and I write on my own behalf.', 'Sincerely,\n[Your Name]', 'The landlord’s attorney may contact me', 'Pursuant to the lease I have a clear remedy.',
];
for (const t of BANNED) test(`voice lint flags: ${JSON.stringify(t)}`, () => assert.ok(voiceHits(t).length > 0));
for (const t of LEGIT) test(`voice lint allows: ${JSON.stringify(t)}`, () => assert.deepEqual(voiceHits(t), []));
test('voice lint is clean for an empty / null input', () => { assert.deepEqual(voiceHits(''), []); assert.deepEqual(voiceHits(null), []); });

// ---- generate (mocked model) ----
const CODE = 'LD-MOCK-0001';
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const CLEAN = 'Dear Mr. Smith,\n\nI am writing about the broken heat in my unit. Please repair it within the time allowed.\n\nSincerely,\n[Your Name]';
const BAD = 'Dear Mr. Smith,\n\nI am writing about the broken heat. Please repair it promptly and keep this letter.\n\nSincerely,\nJane Doe\nAttorney for the Tenant';
let calls, usage;
function mock(texts) {
  calls = []; usage = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/license/verify')) return new Response(JSON.stringify({ data: { enabled: true, product_link: PRODUCT_LINK } }), { status: 200 });
    if (u.includes('/license/usage')) { usage++; return new Response('{}', { status: 200 }); }
    assert.ok(u.includes('api.anthropic.com'), 'unexpected fetch ' + u);
    calls.push(JSON.parse(init.body));
    const text = texts[Math.min(calls.length - 1, texts.length - 1)];
    return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }), { status: 200 });
  };
}
async function gen(body) {
  const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await generate({ method: 'POST', body: { accessCode: CODE, systemPrompt: 'You are a letter writer.', userPrompt: 'STATE: Georgia\nWrite a letter.', state: 'Georgia', letterType: 'Utility Shutoff', ...body } }, res);
  return res;
}

test('model emits "Attorney for the Tenant" then a clean letter -> clean letter returned, notice names the phrase', async () => {
  mock([BAD, CLEAN]);
  const r = await gen({});
  assert.equal(r.code, 200); assert.equal(r.body.text, CLEAN);
  assert.equal(calls.length, 2); assert.equal(usage, 1);
  assert.match(calls[1].system, /REGENERATION NOTICE[\s\S]*attorney for/i);
});
test('model emits it twice -> 502, usage NOT marked, offending text never returned', async () => {
  mock([BAD, BAD]);
  const r = await gen({});
  assert.equal(r.code, 502); assert.equal(usage, 0);
  assert.ok(!/attorney for the tenant/i.test(JSON.stringify(r.body)));
  assert.match(r.body.error, /not been used/);
});
test('review pass and assertive pass are linted too', async () => {
  mock([BAD, BAD]);
  const r = await gen({ systemPrompt: '', userPrompt: '', reviewMode: true, draftLetter: CLEAN });
  assert.equal(r.code, 502); assert.equal(usage, 0);
  mock([BAD, CLEAN]);
  const r2 = await gen({ userPrompt: 'STATE: Georgia\nWrite a MORE ASSERTIVE and DETAILED demand letter.' });
  assert.equal(r2.code, 200); assert.equal(r2.body.text, CLEAN);
});
test('a clean letter is one model call; the signer rule is added server-side to every request', async () => {
  mock([CLEAN]);
  const r = await gen({ systemPrompt: '' });
  assert.equal(r.code, 200); assert.equal(calls.length, 1); assert.ok(calls[0].system.includes(SIGNER_RULE));
});
test('legitimate attorney fees wording in a letter is not rejected', async () => {
  const t = CLEAN.replace('Please repair', 'I reserve the right to seek attorney’s fees where the law allows. Please repair');
  mock([t]);
  const r = await gen({});
  assert.equal(r.code, 200); assert.equal(calls.length, 1);
});

// ---- checklist ----
test('checklist items with attorney-voice text are dropped; clean ones kept; fallback has none', async () => {
  const items = Array.from({ length: 8 }, (_, i) => `Keep dated records, step ${i + 1}`);
  mock([JSON.stringify([...items, 'Sign as Attorney for the Tenant', 'Have Jane Doe, Esq. sign it'])]);
  const res = await checklist(new Request('http://x/api/checklist', { method: 'POST', body: JSON.stringify({ accessCode: CODE, state: 'Georgia', issueType: 'Utility Shutoff', letterExcerpt: 'x' }) }));
  const j = await res.json();
  assert.deepEqual(j.checklist, items);
  for (const ty of Object.keys(TYPES)) assert.deepEqual(voiceHits(fallbackFor(ty).join('\n')), [], ty);
});

// ---- prompts ----
const app = readFileSync(join(ROOT, 'src/App.jsx'), 'utf8');
test('client SIGNER_RULE is the server rule; every letter-type prompt includes it and has no banned phrase or attorney persona', () => {
  assert.match(app, /import \{ SIGNER_RULE \} from "\.\.\/api\/_voicelint\.js"/);
  const prompts = [...app.matchAll(/const (\w*[pP]rompt) = `([\s\S]*?)`;/g)].filter(m => /^You are an expert/.test(m[2]));
  assert.ok(prompts.length >= 9, 'found the letter-type prompts: ' + prompts.length);
  for (const [, name, body] of prompts) {
    assert.ok(body.includes('${SIGNER_RULE}'), name + ' includes the signer rule');
    const resolved = body.replace('${SIGNER_RULE}', SIGNER_RULE);
    assert.deepEqual(voiceHits(resolved), [], name);
    assert.doesNotMatch(resolved, /you are (an? )?[^.\n]*\battorney\b/i, name + ' persona');
  }
  assert.doesNotMatch(app, /expert tenant rights attorney/i);
});

// ---- static samples / templates / checklist content ----
function walk(d, out = []) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; }
test('static sample letter, templates and generated page content contain no attorney-voice phrase', () => {
  const sample = app.match(/const SAMPLE_LETTER = `([\s\S]*?)`;/)[1];
  assert.deepEqual(voiceHits(sample), []);
  const files = [...walk(join(ROOT, 'scripts/templates')), ...walk(join(ROOT, 'scripts/data')), ...walk(join(ROOT, 'public')).filter(f => f.endsWith('.html')), join(ROOT, 'api/_checklist-fallbacks.js')];
  for (const f of files) assert.deepEqual(voiceHits(readFileSync(f, 'utf8')), [], f);
});
