# TenantFight — Content Enrichment Log (SEO Phase 2)

Date: 2026-07-22 · Directive: CC-DIRECTIVE-All-Letter-Apps-Content-Enrichment.md (app 3, P2)

## Inventory
Same generator as hoafight: 10 states × 10 landlord-tenant dispute topics + 10 state
hubs = 111 pages. No `/letters` hub in this repo (deferred; enrichment sections are
the index-rate fix).

## Technical SEO
`vercel.json`: fixed the homepage redirect — replaced the redundant `/` → `/landing.html`
301 with `/landing.html` → `/` so the `.html` alternate consolidates to the canonical
root. Canonicals + sitemap already bare-domain `https://tenantfight.com`.

## STEP 1 — state-data.json (10 states)
Verified per-state landlord-tenant data (statute, security-deposit rules, habitability,
repair-and-deduct, rent withholding, entry notice, retaliation, lease termination,
eviction process, rent control, regulatory body, unique protections, common disputes,
recent reform). WebSearch-sourced (Perplexity unavailable). **51 sources** in
`VERIFICATION_LOG-SEO-CONTENT.md`. Differentiation: CA (AB 12 1-month deposit, AB 1482
cap, 21-day return), TX (no cap/30-day/3x penalty, no entry statute), FL (15/30-day
notice, no repair-and-deduct), NY (1-month/14-day forfeit, Good Cause Eviction 2024),
IL (multi-act, 45-day/2x, Retaliation Act 2025), PA (2mo→1mo cap, Pugh v. Holmes), OH
(rent escrow, 5% interest), GA (Safe at Home Act 2024, 2-mo cap, 3x), NC (tiered caps,
no withholding, self-help bar), AZ (URLTA repair-and-deduct, 1.5mo/14-business-day).

## STEP 2-3 — Generator + verify
Ported the shared `enrichment.js` pattern (tenant fields + topic map: deposit→
security_deposit_rules; repair→habitability/repair_and_deduct; eviction→eviction_process;
entry→entry_notice; retaliation→retaliation_protections). 4 sections (Tenant Rights
Overview / Your Rights / How to Enforce / Common Disputes + Protections-Worth-Knowing)
below existing content; 2-3 data-derived FAQ Q&As merged into FAQPage JSON-LD (8/page);
state-hub snapshot. Regenerated 111 pages (URLs unchanged); modules compile; JSON-LD
valid. Build only.
