// api/generate.js
import { MODEL } from './_config.js';

// Node serverless runtime (NOT edge). Edge caps at ~25s on Hobby and ignores
// maxDuration, which 504'd ~25s Opus letters. Node honors maxDuration:60. This
// MUST use the classic (req, res) handler: Vercel's Node runtime writes the
// response via res and IGNORES a returned Response object (returning one hangs
// the function until the timeout).
export const config = { maxDuration: 60 };

const PRODUCT_LINK = 'Kp6fH';

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
    const { accessCode, systemPrompt, userPrompt, reviewMode, draftLetter } = await readBody(req);

    if (!accessCode || !accessCode.trim()) {
      return res.status(401).json({ error: 'Access code required' });
    }

    const payhipApiKey = process.env.PAYHIP_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!payhipApiKey || !anthropicKey) {
      return res.status(500).json({ error: 'Service not configured' });
    }

    const isCheckCall = systemPrompt === 'Reply: VALID';
    const TEST_KEYS = (process.env.TEST_KEYS || 'SMOKE-TEST-2026-BAO').split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
    const isTestKey = TEST_KEYS.includes(String(accessCode || '').trim().toUpperCase());

    if (!isCheckCall && !isTestKey) {
      const payhipRes = await fetch(
        `https://payhip.com/api/v1/license/verify?product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
        { method: 'GET', headers: { 'payhip-api-key': payhipApiKey } }
      );
      const payhipData = payhipRes.ok ? await payhipRes.json().catch(() => null) : null;
      if (!payhipData || !payhipData.data) {
        return res.status(401).json({ error: 'Invalid access code. Check your Payhip receipt email.' });
      }
      if (payhipData.data.uses >= 1) {
        return res.status(401).json({ error: 'This code has already been used. Each code generates one letter.' });
      }
    }

    let messages;
    if (reviewMode && draftLetter) {
      messages = [{ role: 'user', content: `Review and improve this appeal letter. Fix vague language, ensure all arguments are explicitly stated, remove emotional appeals, tighten redundancy. Return ONLY the improved letter:\n\n${draftLetter}` }];
    } else {
      messages = [{ role: 'user', content: userPrompt }];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        thinking: { type: 'disabled' },
        system: (!isCheckCall && systemPrompt) ? systemPrompt : undefined,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'AI generation failed', detail: err });
    }

    const data = await response.json();
    // Extract the text block by type, not by position. With adaptive thinking a
    // model can place a "thinking" block at content[0], so content[0].text is
    // undefined even on a 200. Fail loudly on a missing text block — never return
    // undefined — and because this throws BEFORE the mark-usage call below, the
    // buyer's one-use license is NOT burned on a parse miss.
    const text = data.content?.find(b => b.type === 'text')?.text;
    if (!text) throw new Error(`No text block in API response (stop_reason: ${data.stop_reason || 'unknown'})`);

    // Mark license as used. Awaited (not fire-and-forget): on Node serverless,
    // work after res is sent is not guaranteed to run. Only for real buyer codes.
    if (!isCheckCall && !isTestKey) {
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
