// api/generate.js
// Vercel Edge Function — keeps ANTHROPIC_API_KEY server-side only

export const config = { runtime: 'edge' };

const VALID_CODES = (process.env.ACCESS_CODES || '').split(',').map(c => c.trim()).filter(Boolean);

export default async function handler(req) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { accessCode, systemPrompt, userPrompt, reviewMode, draftLetter } = body;

    // Validate access code
    if (!accessCode || !VALID_CODES.includes(accessCode.toUpperCase())) {
      return new Response(JSON.stringify({ error: 'Invalid access code' }), { status: 401, headers });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API not configured' }), { status: 500, headers });
    }

    // Build messages based on mode
    let messages;
    if (reviewMode && draftLetter) {
      messages = [{
        role: 'user',
        content: `Review and improve this variance letter. Fix: (1) replace vague language with specific numbers, (2) ensure every criterion is explicitly addressed with its own section header, (3) remove emotional appeals — replace with facts, (4) ensure hardship is property-based not owner preference, (5) confirm "minimum variance necessary" is explicit, (6) tighten redundancy. Return ONLY the improved letter, no commentary:\n\n${draftLetter}`
      }];
    } else {
      messages = [{ role: 'user', content: userPrompt }];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt || undefined,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'AI generation failed', detail: err }), { status: 502, headers });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return new Response(JSON.stringify({ text }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
