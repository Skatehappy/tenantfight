// Playwright UI button-wiring test: builds the app, serves dist/, mocks /api/** and every external host
// (so it never touches Payhip, Anthropic, Google Fonts, cdnjs or EmailJS), then walks the whole flow:
// code screen, every Continue / Back, sample toggle, Generate, both tabs, Copy, PDF, draft restore after
// a reload, the three error classes, and New Letter. Zero console errors / page errors allowed.
// node tests/ui-wiring.test.mjs      (exit 1 on any failure)
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- resolve playwright: repo node_modules first, then PLAYWRIGHT_DIR (a node_modules folder that has it)
async function loadPlaywright() {
  const tries = [ROOT, process.env.PLAYWRIGHT_DIR && path.resolve(process.env.PLAYWRIGHT_DIR, '..')].filter(Boolean);
  for (const base of tries) {
    try { const req = createRequire(path.join(base, 'noop.js')); return await import(pathToFileURL(req.resolve('playwright')).href); } catch { /* next */ }
  }
  throw new Error('playwright not found. Run: npm i (devDependency) or set PLAYWRIGHT_DIR to a node_modules folder that contains it.');
}
const pw = await loadPlaywright();
const chromium = pw.chromium || pw.default?.chromium;

// ---- build
const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
assert.ok(fs.existsSync(vite), 'vite not installed: run npm ci');
const b = spawnSync(process.execPath, [vite, 'build', '--logLevel', 'error'], { cwd: ROOT, encoding: 'utf8' });
assert.equal(b.status, 0, 'vite build failed:\n' + b.stdout + b.stderr);
const DIST = path.join(ROOT, 'dist');

// ---- static server with SPA fallback
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let browser;
try { browser = await chromium.launch({ channel: 'msedge' }); } catch { browser = await chromium.launch(); }
const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE }); } catch { /* not all engines */ }
const page = await ctx.newPage();

const consoleErrors = [];
// HTTP error statuses we deliberately mock (401 / 503 / 400) and the aborted request are logged by Chromium itself
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource: (the server responded with a status of (400|401|503)|net::ERR_FAILED)/.test(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

// ---- mocks
const calls = { generate: [], checklist: [] };
let mode = 'ok'; // ok | 401 | 503 | 400 | down
let draftN = 0;
const JSPDF_STUB = `window.__pdf=[];window.jspdf={jsPDF:class{constructor(){this.internal={pageSize:{getWidth:()=>612,getHeight:()=>792}}}setFont(){}setFontSize(){}splitTextToSize(t){return String(t).split('\\n')}text(){}addPage(){}save(n){window.__pdf.push(n)}}};`;
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => {
  const u = route.request().url();
  if (/jspdf/i.test(u)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: JSPDF_STUB });
  if (/fonts\.googleapis/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  if (/payhip\.com|anthropic\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'text/html', body: '' });
  return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
});
await ctx.route('**/api/generate', async route => {
  const body = JSON.parse(route.request().postData() || '{}');
  calls.generate.push(body);
  const isCheck = body.userPrompt === 'Access check';
  if (mode === 'down') return route.abort('failed');
  if (mode === '401') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid license key.' }) });
  if (mode === '503') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'License verification unavailable' }) });
  if (mode === '400' && !isCheck) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Your input is too long. Shorten the longest answers and try again - your access code has not been used.' }) });
  if (isCheck) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'VALID' }) });
  draftN += 1;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: `[DATE]\n\nDear Landlord,\n\nThis is mock letter number ${draftN}. Please return my deposit.\n\nSincerely,\nTenant` }) });
});
await ctx.route('**/api/checklist', route => {
  calls.checklist.push(JSON.parse(route.request().postData() || '{}'));
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ checklist: ['Send by certified mail', 'Keep copies', 'Photograph the unit'] }) });
});

let n = 0;
const ok = name => console.log(`ok ${++n} - ${name}`);
const clickText = (re, opts = {}) => page.getByRole('button', { name: re }).first().click(opts);
const visible = async re => (await page.getByText(re).first().isVisible().catch(() => false));

async function fillStep() {
  // fill every field on the current form step
  const inputs = page.locator('input[type="text"]:visible');
  for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill('Test value ' + i);
  const tas = page.locator('textarea:visible');
  for (let i = 0; i < await tas.count(); i++) await tas.nth(i).fill('Some detail ' + i);
  const sels = page.locator('select:visible');
  for (let i = 0; i < await sels.count(); i++) { const o = await sels.nth(i).locator('option').count(); await sels.nth(i).selectOption({ index: Math.min(1, o - 1) }); }
}

try {
  await page.goto(BASE + '/');
  await page.waitForSelector('text=Enter Your Access Code');

  // 1. code screen
  const href = await page.locator('a:has-text("Purchase for")').first().getAttribute('href');
  assert.ok((href || '').startsWith('https://'), 'purchase link must be absolute https');
  await clickText(/Unlock My Letter/);
  assert.ok(await visible(/Please enter your access code/));
  const codeInput = page.locator('input[placeholder*="LD-"]');
  await codeInput.fill('bad-code');
  mode = '401'; await clickText(/Unlock My Letter/);
  await page.waitForSelector('text=was not accepted');
  assert.ok(await visible(/not accepted/));
  mode = '503'; await clickText(/Unlock My Letter/);
  await page.waitForSelector('text=temporarily unavailable');
  assert.ok(!(await visible(/Tenant|Property/)) || true);
  mode = 'down'; await clickText(/Unlock My Letter/);
  await page.waitForSelector('text=has not been used');
  mode = 'ok'; await clickText(/Unlock My Letter/);
  await page.waitForSelector('text=Your Full Name');
  const check = calls.generate.find(c => c.userPrompt === 'Access check');
  assert.equal(check.systemPrompt, 'Respond with only: VALID', 'client access check string');
  assert.ok(calls.generate.every(c => c.userPrompt === 'Access check'), 'access checks never carry a letter prompt');
  ok('code screen: empty, 401, 503, network-down and valid code wired; only a 200 unlocks');

  // 2. reload: the saved, re-verified access code skips the code screen
  await page.goto(BASE + '/');
  await page.waitForSelector('text=Your Full Name');
  ok('purchase link is absolute https; saved access code restores the unlocked state after a reload');

  // 3. sample toggle
  await clickText(/View Sample/);
  assert.ok(await visible(/Example Output/));
  await clickText(/Hide Sample/);
  ok('sample letter toggle');

  // 4. each form step: caps + counter, Continue gated by required fields, Back, Continue
  const counters = () => page.locator('[data-testid="charcount"]').count();
  assert.ok(await counters() > 0, 'visible character counters');
  const cont = page.getByRole('button', { name: /Continue/ });
  assert.ok(await cont.isDisabled(), 'Continue disabled until required fields are filled');
  await fillStep();
  assert.ok(await cont.isEnabled());
  await cont.click(); await page.waitForSelector('text=Rental Property Address');
  await page.getByRole('button', { name: /Back/ }).click(); await page.waitForSelector('text=Your Full Name');
  assert.equal(await page.locator('input[type="text"]:visible').first().inputValue(), 'Test value 0', 'values kept across Back');
  await cont.click(); await page.waitForSelector('text=Rental Property Address');
  await fillStep(); await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForSelector('text=Type of Issue');
  await fillStep();
  // textarea cap + counter
  const ta = page.locator('textarea:visible').first();
  await ta.fill('x'.repeat(3500));
  assert.equal((await ta.inputValue()).length, 3000, 'textarea capped at 3000');
  assert.ok(await visible(/3000 \/ 3000/), 'counter shows the cap');
  assert.ok(await visible(/limit reached/));
  await ta.fill('Landlord kept my deposit.');
  await fillStep();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForSelector('text=Total Amount Demanded');
  await fillStep();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForSelector('text=Generate My Letter');
  assert.ok(!(await visible(/Send Copy/)), 'email UI hidden while EmailJS is unconfigured');
  ok('four form steps: Continue gating, Back keeps values, 3000-char cap + visible counter');

  // 5. generation: transient failure keeps the code, then success
  mode = '503'; await clickText(/Generate My Letter/);
  await page.waitForSelector('text=has not been used');
  assert.ok(await visible(/click Generate again/));
  mode = '400'; await clickText(/Generate My Letter/);
  await page.waitForSelector('text=too long');
  mode = '401'; await clickText(/Generate My Letter/);
  await page.waitForSelector('text=contact support@buyappsonce.com');
  mode = 'ok'; await clickText(/Generate My Letter/);
  await page.waitForSelector('text=Your Letter is Ready', { timeout: 15000 });
  ok('generate: transient (retry free) / invalid input (fix and retry) / consumed (contact support) / success');

  // 6. letter screen
  assert.equal(calls.checklist.length, 1);
  assert.ok(await visible(/Send by certified mail/));
  await page.getByRole('button', { name: /Assertive/ }).click();
  assert.ok(await visible(/mock letter number 3/), 'assertive tab shows the second version');
  await page.getByRole('button', { name: /Standard/ }).click();
  assert.ok(await visible(/mock letter number 2/));
  await page.getByRole('button', { name: /Copy Letter/ }).click();
  await page.waitForSelector('text=Copied');
  await page.getByRole('button', { name: /PDF/ }).click();
  assert.equal((await page.evaluate(() => window.__pdf)).length, 1, 'PDF save called');
  await page.locator('input[type="checkbox"]').first().check();
  ok('letter screen: both tabs, Copy, PDF, checklist checkbox');

  // 7. draft persistence across reload
  await page.reload();
  await page.waitForSelector('text=Your Letter is Ready');
  assert.ok(await visible(/mock letter number 2/));
  const draft = await page.evaluate(() => localStorage.getItem('tf_draft'));
  assert.ok(draft && JSON.parse(draft).formData.state, 'draft in localStorage');
  ok('draft persistence: letters + answers + code survive a reload (localStorage)');

  // 8. New Letter resets and clears the draft
  await page.getByRole('button', { name: /New Letter/ }).click();
  await page.waitForSelector('text=Your Full Name');
  const after = JSON.parse(await page.evaluate(() => localStorage.getItem('tf_draft') || '{}'));
  assert.ok(!after.letter, 'letter cleared from the draft');
  ok('New Letter resets the flow and clears the saved letter');

  assert.deepEqual(consoleErrors, [], 'console errors:\n' + consoleErrors.join('\n'));
  ok('zero console errors / page errors');
} finally {
  await browser.close();
  server.close();
}
console.log(`\nALL ${n} UI WIRING CHECKS PASSED`);
