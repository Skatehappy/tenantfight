// api/generate.js
import { MODEL } from './_config.js';
import { verifyLicense, PRODUCT_LINK } from './_license.js';
import { isTestCode, createQuota } from './_g4t.js';
import { lockBlock, lintLetter, lintNumbers, stripUnverified, stripSentences, stateAbbr, logRecord } from './_citelint.js';

// Node serverless runtime (NOT edge). Edge caps at ~25s on Hobby and ignores
// maxDuration, which 504'd ~25s Opus letters. Node honors maxDuration:60. This
// MUST use the classic (req, res) handler: Vercel's Node runtime writes the
// response via res and IGNORES a returned Response object (returning one hangs
// the function until the timeout).
export const config = { maxDuration: 60 };

// Gate 4 test code: see _g4t.js. Capped at TEST_LETTERS_PER_DAY letters a day (the app makes 3
// generate calls per letter).
const MAX_USER_PROMPT = 24000, MAX_SYSTEM_PROMPT = 30000, MAX_DRAFT = 24000;
const TEST_LETTERS_PER_DAY = 10;
const CALLS_PER_LETTER = 3;
const quota = createQuota(TEST_LETTERS_PER_DAY * CALLS_PER_LETTER);
const testUse = quota.state;

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

// Citation + numeric lock, step 2: lint the output against the verified set for the user's state
// (citations incl. subsections, and dollar / percent / day figures stated as law). A miss triggers ONE
// regeneration that names the rejected items; whatever is still unverified after that has its sentence
// stripped. Logs counts and statutory cite strings only (no letter text, no PII).
const lintAll = (text, abbr, userText) => {
  const c = lintLetter(text, abbr);
  const n = lintNumbers(text, abbr, userText);
  return { found: c.found, violations: [...c.violations, ...n.violations] };
};
const stripAll = (text, abbr, violations) => {
  let out = violations.some(v => v.kind !== 'num') ? stripUnverified(text, abbr) : text;
  const nums = violations.filter(v => v.kind === 'num').map(v => v.sentence);
  if (nums.length) out = stripSentences(out, nums);
  return out;
};
async function generateLocked({ anthropicKey, system, messages, abbr, kind, t0, userText = '' }) {
  let r = await callModel(anthropicKey, system, messages);
  if (!r.ok) return r;
  let { found, violations } = lintAll(r.text, abbr, userText);
  let regenerated = false;
  if (violations.length && Date.now() - t0 < 32000) {
    regenerated = true;
    const bad = [...new Set(violations.map(v => v.kind === 'num' ? `the figure "${v.raw}" (not a verified figure)` : v.reason === 'subsection' ? `${v.raw} (subsection not on file)` : v.raw))].join('; ');
    const r2 = await callModel(anthropicKey, system + `

REGENERATION NOTICE: your previous draft used authorities or figures that are NOT verified and were rejected: ${bad}. Write the letter again without them. Cite nothing that is not on the verified list above, and state no dollar amount, percentage or day count as law unless it is on the verified figures list or was supplied by the user.`, messages);
    if (r2.ok) { r = r2; ({ found, violations } = lintAll(r.text, abbr, userText)); }
  }
  let stripped = 0;
  if (violations.length) { r.text = stripAll(r.text, abbr, violations); stripped = violations.length; }
  if (found.length || violations.length || regenerated) console.log(logRecord(abbr, kind, found, violations, { regenerated, stripped }));
  return { ...r, stripped };
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

    // Access check (the unlock screen): validate the license and answer VALID. NEVER calls the model
    // and NEVER marks the code used. Both historical check strings are accepted.
    const isCheckCall = systemPrompt === 'Reply: VALID' || systemPrompt === 'Respond with only: VALID' || userPrompt === 'Access check';

    const testMode = isTestCode(accessCode.trim());
    if (!testMode) {
      const lic = await verifyLicense(accessCode, PRODUCT_LINK, payhipApiKey);
      if (!lic.ok) return res.status(lic.status).json({ error: lic.error });
    }
    if (isCheckCall) return res.status(200).json({ text: 'VALID' });
    if (testMode) {
      if (!quota.take()) {
        console.log(JSON.stringify({ evt: 'g4t_limit', day: testUse.day, calls: testUse.calls }));
        return res.status(429).json({ error: 'Test code daily limit reached.' });
      }
      console.log(JSON.stringify({ evt: 'g4t_use', day: testUse.day, calls: testUse.calls, cap: TEST_LETTERS_PER_DAY * CALLS_PER_LETTER }));
    }

    // Input caps (invalid input => 400, nothing is marked used, the code stays valid).
    const tooLong = (v, max) => typeof v === 'string' && v.length > max;
    if (tooLong(userPrompt, MAX_USER_PROMPT) || tooLong(systemPrompt, MAX_SYSTEM_PROMPT) || tooLong(draftLetter, MAX_DRAFT)) {
      return res.status(400).json({ error: 'Your input is too long. Shorten the longest answers and try again - your access code has not been used.' });
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
    const lock = lockBlock(abbr ? stateName : '') + (reviewMode ? '\nIn this review, delete any citation in the draft that is not on the verified list instead of keeping it.' : '');
    const system = ((systemPrompt || '') + lock).trim() || undefined;

    const r = await generateLocked({ anthropicKey, system, messages, abbr, kind: reviewMode ? 'review' : 'letter', t0, userText: `${userPrompt || ''}
${draftLetter || ''}` });
    if (!r.ok) return res.status(502).json({ error: 'AI generation failed', detail: r.err });
    const text = r.text;
    if (!text.trim() || (r.stripped && text.trim().length < 150)) {
      // thrown BEFORE the mark-usage call below, so the buyer's one-use license is NOT burned
      throw new Error('The letter did not pass the citation check. Please try again.');
    }

    // Mark license as used. Awaited (not fire-and-forget): on Node serverless,
    // work after res is sent is not guaranteed to run. Only for real buyer codes.
    if (!testMode) {
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
