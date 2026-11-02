// api/checklist.js
import { MODEL } from './_config.js';
import { verifyLicense, PRODUCT_LINK } from './_license.js';
import { isTestCode, createQuota } from './_g4t.js';
import { lockBlock, lintLetter, lintNumbers, stateAbbr, logRecord } from './_citelint.js';

export const config = { runtime: 'edge' };

// Gate 4 test code (see _g4t.js): one checklist per letter, so 10 a day.
const quota = createQuota(10);

const FALLBACK = ['Send letter via certified mail with return receipt requested — keep the tracking number', 'Keep a complete copy of everything you send', 'Gather proof of deposit payment — cancelled check, bank statement, or receipt', 'Document property condition at move-out — photos, videos, dated', "Note your state's deadline for landlord to return deposit", 'Compile all prior written communications with your landlord', "Check your state's penalty statute — many states allow 2-3x damages for wrongful withholding", 'If ignored, file in small claims court — no attorney needed, low filing fee', "File complaint with your state's tenant rights agency or attorney general"];

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
    const { accessCode, state, varianceType, issueType, letterExcerpt } = await req.json();

    // Same fail-closed Payhip verify as generate.js (no usage mark). No hard-coded or env bypass codes.
    const payhipApiKey = process.env.PAYHIP_API_KEY;
    if (!payhipApiKey || !process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'Service not configured' }), { status: 500, headers });
    }
    if (isTestCode(accessCode)) {
      if (!quota.take()) {
        console.log(JSON.stringify({ evt: 'g4t_limit', ep: 'checklist', day: quota.state.day, calls: quota.state.calls }));
        return new Response(JSON.stringify({ error: 'Test code daily limit reached.' }), { status: 429, headers });
      }
      console.log(JSON.stringify({ evt: 'g4t_use', ep: 'checklist', day: quota.state.day, calls: quota.state.calls, cap: quota.state.cap }));
    } else {
      const lic = await verifyLicense(accessCode, PRODUCT_LINK, payhipApiKey);
      if (!lic.ok) return new Response(JSON.stringify({ error: lic.error }), { status: lic.status, headers });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system: `You write short practical checklists for tenants.${lockBlock(stateAbbr(state) ? state : '')}
Every item must be a plain action step. Do not cite a statute, ordinance or case unless it is on the verified list above, and state no dollar amount, percentage or day count as law unless it is on the verified figures list.`,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `Generate a practical submission checklist for a tenant demand letter / security deposit dispute as a JSON array of strings. Include items like: send via certified mail, keep copy of everything, photograph the property condition, gather receipts for deposit payment, check state deadline for deposit return, document all prior communications with landlord, file in small claims court if ignored, check state-specific penalty laws. Return ONLY a valid JSON array, no other text.

State: ${state}
Situation: ${varianceType || issueType || 'tenant demand letter / security deposit dispute'}
Letter excerpt: ${letterExcerpt?.substring(0, 200) || ''}`,
        }],
      }),
    });

    // Fail loudly on an API error instead of silently returning an empty
    // checklist (the pre-migration bug: a dead model 404'd and this returned []).
    if (!response.ok) {
      const detail = await response.text();
      return new Response(JSON.stringify({ error: 'Checklist generation failed', detail }), { status: 502, headers });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '[]';
    const clean = text.replace(/```json|```/g, '').trim();

    let checklist;
    try {
      checklist = JSON.parse(clean);
    } catch {
      checklist = FALLBACK;
    }

    // Citation + numeric lock: an item that cites an unverified authority (or an unverified subsection) or
    // states an unverified legal figure is dropped. If too little survives, the static fallback list is used.
    const abbr = stateAbbr(state);
    const userText = `${state || ''} ${varianceType || issueType || ''} ${letterExcerpt || ''}`;
    let dropped = 0;
    if (Array.isArray(checklist)) {
      checklist = checklist.filter(x => typeof x === 'string' && x.trim()).filter(item => {
        const bad = lintLetter(item, abbr).violations.length + lintNumbers(item, abbr, userText).violations.length;
        if (bad) dropped += 1;
        return !bad;
      }).slice(0, 15);
    }
    if (!Array.isArray(checklist) || checklist.length < 3) checklist = FALLBACK;
    if (dropped) console.log(logRecord(abbr, 'checklist', [], [], { dropped }));

    return new Response(JSON.stringify({ checklist }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
