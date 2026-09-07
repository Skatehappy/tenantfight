# TenantFight

Vercel-hosted letter generator (tenant demand / security-deposit disputes). The
buyer-facing app calls the Anthropic API server-side from `api/generate.js`
(the letter) and `api/checklist.js` (the submission checklist); the key stays in
the `ANTHROPIC_API_KEY` Vercel env var.

## AI model

| | |
|---|---|
| **Model** | `claude-opus-5` |
| **Single source** | `api/_config.js` → `MODEL` (override with the `ANTHROPIC_MODEL` env var, no code deploy) |
| **Last verified** | 2026-09-03 (against platform.claude.com models overview) |

Model IDs are deprecated on a schedule and a dead ID returns a 404
`not_found_error` that does **not** show on the Anthropic Usage dashboard. When
that happens, bump `ANTHROPIC_MODEL` in Vercel (or `api/_config.js`) and
re-verify with the smoke check below.

### Pre-deploy smoke check

```
ANTHROPIC_API_KEY=sk-ant-... node scripts/smoke-ai.mjs
```

Makes one real API call with the configured model and asserts a valid non-empty
response. **Run it before every deploy** — it fails loudly on a dead model,
refusal, or empty response. Both API routes also fail loudly at runtime (HTTP
502 with a clear message) rather than returning a blank letter or checklist.
