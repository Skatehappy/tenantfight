# TenantFight — Phase-2 Regulatory Fix Report
Date: 2026-07-19
Standard: Three-Gate v7
Gate: **GREEN** (`node scripts/verify-gate.mjs` — A1 files ok; A9 citation-log parity all logged)
Commit: `38c5cc8056f7b371ee49bae162711f3381a6dbee`

## Scope
Audited every statutory citation surfaced by `scripts/verify-gate.mjs` (A9 citation-log
parity) across the gate's scanned files. All citations originate in `src/App.jsx`
(`public/landing.html` and `api/checklist.js` contain none; `landing.html` does not exist).

## Citations audited
- **32** distinct citation tokens on first gate run.
- After the fixes, **2** tokens (`§92.0081`, `§27-2005`) no longer appear anywhere in code
  because they were removed from the miscited passages; the gate now reports **30** logged
  citations. Their VERIFICATION_LOG.md entries are retained for the audit trail.
- Every citation has a dated entry in `VERIFICATION_LOG.md` with source file, verdict,
  subject, primary source URL, and action.

## Verdict counts
- **VERIFIED (no change): 27** citation subjects — CA §1954, §1942.5, §§1941/1942, §789.3,
  §1946.2, §1950.5, CCP §1161; NY RPL §223-b, §235, §235-b (habitability use), RPAPL §711,
  GOL §7-108; TX §92.331, §92.008, §24.005, §92.109; FL §83.67; MA c.186 §18/§14/§12,
  c.111 §127A; 42 U.S.C. §§3601-3619, §3604 & §3604(f), §3610, §3613; plus case law
  Green v. Superior Court and Boston Housing Authority v. Hemingway.
- **INCORRECT (miscited): 5** — NY RPL §235-b (as an entry statute), TX §92.0081 (lockout,
  not entry), MA c.186 §15B (deposit statute, not general entry — only §15B(1)(a) touches
  entry purposes), NYC Admin Code §27-2005 (habitability duty, not criminal shutoff),
  CA Penal Code §418 (forcible entry/detainer, not utility shutoff).

## Code changes (`src/App.jsx`)
1. **Line 322 (landlord-entry rule).** Removed the incorrect NY §235-b and TX §92.0081
   entry-statute citations; clarified that NY and TX have no general landlord-entry statute
   (rely on the lease entry clause and the common-law covenant of quiet enjoyment) and that
   MA G.L. c. 186 §15B(1)(a) only limits the purposes for which a lease may authorize entry.
2. **Line 373 (criminal-liability warning).** Removed the miscited NYC Admin Code §27-2005;
   rewrote so California Penal Code §418 remains only as an explicit "do not rely on §418,
   which governs forcible entry/detainer, not utility service" clarifier, and directs users
   to their local landlord-harassment / unlawful-eviction ordinance instead.

Correct uses of the affected statutes elsewhere were left intact: NY §235-b as the
habitability warranty (line 353); MA §15B as the security-deposit statute (lines 45, 309, 435).

## Remaining unknowns
None. All 30 in-code citations verified against primary sources (Perplexity MCP, 2026-07-19)
and logged. The gate passes on pre-commit and CI. The two removed citations
(§92.0081, §27-2005) are documented as INCORRECT in the log for future reference.
