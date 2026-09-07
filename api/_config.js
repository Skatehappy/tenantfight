// api/_config.js — single source of truth for the Anthropic model string.
//
// Why this file exists: model IDs get deprecated on a schedule and there is no
// local signal when one dies (a dead ID returns 404 not_found_error, which does
// NOT appear on the Anthropic Usage dashboard). Keeping the ID in exactly one
// place — overridable by the ANTHROPIC_MODEL env var without a code deploy —
// means the next deprecation is a Vercel env change, not an 8-file edit.
//
// Files prefixed with "_" are ignored by Vercel's api/ router, so this is not
// exposed as an endpoint.
//
// Current Anthropic model ID (verified EMPIRICALLY 2026-09-07 against the live
// API, not a catalog): "claude-opus-5" returns HTTP 200 from /v1/messages and is
// listed by /v1/models. With thinking disabled it returns a text block at
// content[0] and completes a 550-750 word letter in ~23s — well under Vercel's
// 60s limit. The retired "claude-sonnet-4-20250514" returns 404 not_found_error.
// A prior note here wrongly claimed opus-5 did not exist; that was a stale-catalog
// error, disproven by curl. If opus-5 is ever deprecated, override via the
// ANTHROPIC_MODEL env var in Vercel (no code deploy); "claude-opus-4-8" is the
// same-tier fallback and also returns text at content[0].
export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
