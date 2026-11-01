// api/generate.js
import { timingSafeEqual } from 'node:crypto';
import { MODEL } from './_config.js';
import { lockBlock, lintLetter, stripViolations, stateAbbr, logRecord } from './_citelint.js';

// Node serverless runtime (NOT edge). Edge caps at ~25s on Hobby and ignores
// maxDuration, which 504'd ~25s Opus letters. Node honors maxDuration:60. This
// MUST use the classic (req, res) handler: Vercel's Node runtime writes the
// response via res and IGNORES a returned Response object (returning one hangs
// the function until the timeout).
export const config = { maxDuration: 60 };

const PRODUCT_LINK = 'Kp6fH';

// Gate 4 test code. Inert unless G4_TEST_CODE_SECRET is set in the Vercel env (no default, never
// in the repo). The accepted code is "G4T-" + that secret. It skips the Payhip verify and the
// usage-mark, and is capped at TEST_LETTERS_PER_DAY letters a day (the app makes 3 generate calls
// per letter). The counter lives in this function instance's memory, so it is best-effort: a cold
// start or a second warm instance starts its own count (worst case several x the cap, never unbounded
// by one instance). Every use is logged without the code.
const TEST_PREFIX = 'G4T-';
const TEST_LETTERS_PER_DAY = 10;
const CALLS_PER_LETTER = 3;
const testUse = { day: '', calls: 0 };

function isTestCode(code) {
  const secret = process.env.G4_TEST_CODE_SECRET;
  if (!secret || !code.startsWith(TEST_PREFIX)) return false;
  const a = Buffer.from(code.trim());
  const b = Buffer.from(TEST_PREFIX + secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function testQuota() {
  const day = new Date().toISOString().slice(0, 10);
  if (testUse.day !== day) { testUse.day = day; testUse.calls = 0; }
  if (testUse.calls >= TEST_LETTERS_PER_DAY * CALLS_PER_LETTER) return false;
  testUse.calls += 1;
  return true;
}

async function callModel(anthropicKey, system, messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, thinking: { type: 'disabled' }, system, messages }),
  });
  if (!response.ok) return { ok: false, err: await response.text() };
  const data = await response.json();
  // Extract the text block by type, not by position (adaptive thinking can put a "thinking" block first).
  const text = data.content?.find(b => b.type === 'text')?.text;
  if (!text) throw new Error(`No text block in API response (stop_reason: ${data.stop_reason || 'unknown'})`);
  return { ok: true, text };
}

// Citation lock, step 2: lint the output against the verified set for the user's state. A miss
// triggers ONE regeneration that names the rejected citations; whatever is still unverified after
// that has its sentence stripped. Logs counts and statutory cite strings only (no letter text, no PII).
async function generateLocked({ anthropicKey, system, messages, abbr, kind, t0 }) {
  let r = await callModel(anthropicKey, system, messages);
  if (!r.ok) return r;
  let { found, violations } = lintLetter(r.text, abbr);
  let regenerated = false;
  if (violations.length && Date.now() - t0 < 32000) {
    regenerated = true;
    const bad = [...new Set(violations.map(v => v.raw))].join('; ');
    const r2 = await callModel(anthropicKey, system + `

REGENERATION NOTICE: your previous draft cited authorities that are NOT verified and were rejected: ${bad}. Write the letter again without them. Cite nothing that is not on the verified list above.`, messages);
    if (r2.ok) { r = r2; ({ found, violations } = lintLetter(r.text, abbr)); }
  }
  let stripped = 0;
  if (violations.length) { r.text = stripViolations(r.text, violations); stripped = violations.length; }
  if (found.length || violations.length || regenerated) console.log(logRecord(abbr, kind, found, violations, { regenerated, stripped }));
  return { ...r, stripped };
}

// Fail-closed Payhip license verify. Runs on EVERY request (gate check and
// generation). Rejects unless HTTP 200 + data.enabled===true + product_link
// matches this app. Network error / timeout / non-JSON -> 503 (never "invalid").
async function verifyLicense(licenseKey, productLink, apiKey) {
  const key = (licenseKey || '').trim();
  if (!key) return { ok: false, status: 401, error: 'Invalid license key.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://payhip.com/api/v1/license/verify?product_link=${encodeURIComponent(productLink)}&license_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: { 'payhip-api-key': apiKey }, signal: controller.signal });
    if (res.status !== 200) return { ok: false, status: 401, error: 'Invalid license key.' };
    const json = await res.json();
    const d = json && json.data;
    if (!d || d.enabled !== true || d.product_link !== productLink) {
      return { ok: false, status: 401, error: 'Invalid license key.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, status: 503, error: 'License verification unavailable — please try again shortly.' };
  } finally {
    clearTimeout(timer);
  }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { accessCode, systemPrompt, userPrompt, reviewMode, draftLetter, state, letterType } = await readBody(req);
    const t0 = Date.now();

    if (!accessCode || !accessCode.trim()) {
      return res.status(401).json({ error: 'Access code required' });
    }

    const payhipApiKey = process.env.PAYHIP_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!payhipApiKey || !anthropicKey) {
      return res.status(500).json({ error: 'Service not configured' });
    }

    const isCheckCall = systemPrompt === 'Reply: VALID';

    const testMode = isTestCode(accessCode.trim());
    if (testMode) {
      // gate checks with a test code never reach the model
      if (isCheckCall || systemPrompt === 'Respond with only: VALID' || userPrompt === 'Access check') {
        return res.status(200).json({ text: 'VALID' });
      }
      if (!testQuota()) {
        console.log(JSON.stringify({ evt: 'g4t_limit', day: testUse.day, calls: testUse.calls }));
        return res.status(429).json({ error: 'Test code daily limit reached.' });
      }
      console.log(JSON.stringify({ evt: 'g4t_use', day: testUse.day, calls: testUse.calls, cap: TEST_LETTERS_PER_DAY * CALLS_PER_LETTER }));
    } else {
      const lic = await verifyLicense(accessCode, PRODUCT_LINK, payhipApiKey);
      if (!lic.ok) return res.status(lic.status).json({ error: lic.error });
    }

    let messages;
    if (reviewMode && draftLetter) {
      messages = [{ role: 'user', content: `Review and improve this appeal letter. Fix vague language, ensure all arguments are explicitly stated, remove emotional appeals, tighten redundancy. Return ONLY the improved letter:\n\n${draftLetter}` }];
    } else {
      messages = [{ role: 'user', content: userPrompt }];
    }

    // Citation lock, step 1: the state comes from the request, falling back to the "STATE:" line of
    // the prompt for pages cached before the client sent it. Unknown state => no state authorities offered.
    const stateName = state || (typeof userPrompt === 'string' && (userPrompt.match(/^STATE:\s*(.+)$/m) || [])[1]) || '';
    const abbr = stateAbbr(stateName);
    const lock = isCheckCall ? '' : lockBlock(abbr ? stateName : '') + (reviewMode ? '\nIn this review, delete any citation in the draft that is not on the verified list instead of keeping it.' : '');
    const system = isCheckCall ? undefined : ((systemPrompt || '') + lock).trim() || undefined;

    const r = isCheckCall
      ? await callModel(anthropicKey, system, messages)
      : await generateLocked({ anthropicKey, system, messages, abbr, kind: reviewMode ? 'review' : 'letter', t0 });
    if (!r.ok) return res.status(502).json({ error: 'AI generation failed', detail: r.err });
    const text = r.text;
    if (!text.trim() || (r.stripped && text.trim().length < 150)) {
      // thrown BEFORE the mark-usage call below, so the buyer's one-use license is NOT burned
      throw new Error('The letter did not pass the citation check. Please try again.');
    }

    // Mark license as used. Awaited (not fire-and-forget): on Node serverless,
    // work after res is sent is not guaranteed to run. Only for real buyer codes.
    if (!isCheckCall && !testMode) {
      try {
        await fetch(`https://payhip.com/api/v1/license/usage`, {
          method: 'PUT',
          headers: { 'payhip-api-key': payhipApiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
        });
      } catch { /* letter already generated; don't fail the response on a usage-mark hiccup */ }
    }

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
