// api/generate.js
export const config = { runtime: 'edge' };

const PRODUCT_LINK = 'Kp6fH';

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const body = await req.json();
    const { accessCode, systemPrompt, userPrompt, reviewMode, draftLetter } = body;

    if (!accessCode || !accessCode.trim()) {
      return new Response(JSON.stringify({ error: 'Access code required' }), { status: 401, headers });
    }

    const payhipApiKey = process.env.PAYHIP_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!payhipApiKey || !anthropicKey) {
      return new Response(JSON.stringify({ error: 'Service not configured' }), { status: 500, headers });
    }

    const isCheckCall = systemPrompt === 'Reply: VALID';

    if (!isCheckCall) {
      const payhipRes = await fetch(
        `https://payhip.com/api/v1/license/verify?product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
        {
          method: 'GET',
          headers: { 'payhip-api-key': payhipApiKey },
        }
      );

      const payhipData = payhipRes.ok ? await payhipRes.json().catch(() => null) : null;

      if (!payhipData || !payhipData.data) {
        return new Response(JSON.stringify({ error: 'Invalid access code. Check your Payhip receipt email.' }), { status: 401, headers });
      }

      if (payhipData.data.uses >= 1) {
        return new Response(JSON.stringify({ error: 'This code has already been used. Each code generates one letter.' }), { status: 401, headers });
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: (!isCheckCall && systemPrompt) ? systemPrompt : undefined,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'AI generation failed', detail: err }), { status: 502, headers });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Mark license as used (non-blocking)
    if (!isCheckCall) {
      fetch(
        `https://payhip.com/api/v1/license/usage`,
        {
          method: 'PUT',
          headers: {
            'payhip-api-key': payhipApiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
        }
      ).catch(() => {});
    }

    return new Response(JSON.stringify({ text }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
