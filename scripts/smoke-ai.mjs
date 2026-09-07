// scripts/smoke-ai.mjs — pre-deploy AI smoke check.
//
// Makes ONE real Anthropic call with the configured model and asserts a valid,
// non-empty text response — the guard against a silently-dead model string.
// Run before every deploy:   node scripts/smoke-ai.mjs
// Requires ANTHROPIC_API_KEY in the environment (the same key Vercel uses).
//
// Exits 0 on PASS, non-zero on any failure (dead model 404, refusal, empty).
import { MODEL } from '../api/_config.js';

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error('FAIL: ANTHROPIC_API_KEY not set');
  process.exit(1);
}

console.log(`Smoke-testing model: ${MODEL}`);

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 64,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
  }),
});

if (!res.ok) {
  console.error(`FAIL: HTTP ${res.status} — ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
if (data.stop_reason === 'refusal') {
  console.error('FAIL: model refused the request');
  process.exit(1);
}

// Select the text block by type (robust even if a thinking block leads).
const text = data.content?.find((b) => b.type === 'text')?.text || '';
if (!text.trim()) {
  console.error(`FAIL: empty text response (stop_reason=${data.stop_reason})`);
  process.exit(1);
}

console.log(`PASS: ${MODEL} returned "${text.trim()}" (served by ${data.model})`);
process.exit(0);
