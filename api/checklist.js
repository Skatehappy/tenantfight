// api/checklist.js
import { MODEL } from './_config.js';
import { verifyLicense, PRODUCT_LINK } from './_license.js';
import { isTestCode, createQuota } from './_g4t.js';
import { lockBlock, lintLetter, lintNumbers, stateAbbr, logRecord } from './_citelint.js';
import { callComplete } from './_complete.js';
import { typeInfo, fallbackFor } from './_checklist-fallbacks.js';

export const config = { runtime: 'edge' };

// Gate 4 test code (see _g4t.js): one checklist per letter, so 10 a day.
const quota = createQuota(10);


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
    const testMode = isTestCode(accessCode);
    if (testMode) {
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

    const type = issueType || varianceType;
    const abbrS = stateAbbr(state);
    const system = `You write short practical checklists for tenants.${lockBlock(abbrS ? state : '')}
Every item must be a plain action step. Do not cite a statute, ordinance or case unless it is on the verified list above, and state no dollar amount, percentage or day count as law unless it is on the verified figures list.`;
    const prompt = `Generate a practical checklist for a tenant sending a demand letter about ${typeInfo(type).focus}, as a JSON array of 8 to 10 strings. Every item is one plain action step of at most 25 words and fits this situation only: do not mention a security deposit unless the situation is a deposit dispute. Always include sending the letter by certified mail with return receipt and keeping a copy. Return ONLY a valid JSON array, no other text.

State: ${state}
Situation: ${type || 'other landlord violation'}
Letter excerpt: ${letterExcerpt?.substring(0, 200) || ''}`;

    // Never parse a cut-off reply: callComplete retries once with a higher limit, then reports truncation.
    // Any model failure (HTTP error, truncation, unparseable reply) falls back to this letter type's own list.
    const diag = {};
    const r = await callComplete('https://api.anthropic.com/v1/messages', apiKey, max => ({ model: MODEL, max_tokens: max, system, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: prompt }] }), [2000, 4000]);
    diag.attempts = r.attempts; diag.stop = r.stop; diag.status = r.status;
    let checklist = null;
    if (r.ok) {
      try { checklist = JSON.parse(r.text.replace(/```json|```/g, '').trim()); } catch { diag.parseFailed = true; }
    } else {
      diag.failed = r.truncated ? 'truncated' : 'model-error';
      console.log(JSON.stringify({ evt: 'checklist_model_fail', reason: diag.failed, status: r.status || null }));
    }

    // Citation + numeric lock: an item that cites an unverified authority (or an unverified subsection) or
    // states an unverified legal figure is dropped. If too little survives, the static fallback list is used.
    const abbr = abbrS;
    const userText = `${state || ''} ${varianceType || issueType || ''} ${letterExcerpt || ''}`;
    let dropped = 0;
    if (Array.isArray(checklist)) {
      checklist = checklist.filter(x => typeof x === 'string' && x.trim()).filter(item => {
        const lc = lintLetter(item, abbr).violations, ln = lintNumbers(item, abbr, userText).violations;
        const bad = lc.length + ln.length;
        if (bad) { dropped += 1; (diag.droppedItems = diag.droppedItems || []).push({ item: item.slice(0, 120), cites: lc.map(v => v.raw), nums: ln.map(v => v.raw) }); }
        return !bad;
      }).slice(0, 15);
    }
    diag.survivors = Array.isArray(checklist) ? checklist.length : -1;
    if (!Array.isArray(checklist) || checklist.length < 3) { diag.usedFallback = true; checklist = fallbackFor(type); }
    if (dropped) console.log(logRecord(abbr, 'checklist', [], [], { dropped }));

    return new Response(JSON.stringify(testMode ? { checklist, _diag: diag } : { checklist }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
