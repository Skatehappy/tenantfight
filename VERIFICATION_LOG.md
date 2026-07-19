# TenantFight — Regulatory Verification Log
Created: 2026-07-19
Retrieval layer: Perplexity MCP
Master input: C:\NEWEST OF THE NEW\reports\Portfolio-Regulatory-Sweep.md
Standard: Three-Gate v7

---

### 2026-07-19 — California Civil Code §1954
- **Source file:** src/App.jsx:322
- **Verdict:** VERIFIED
- **Subject:** Landlord's right of entry; 24-hour written notice requirement.
- **Source:** https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1954
- **Action:** no change — confirmed

### 2026-07-19 — New York Real Property Law §235-b
- **Source file:** src/App.jsx:322, 353
- **Verdict:** INCORRECT
- **Subject:** §235-b is the implied warranty of HABITABILITY, not a landlord-entry statute. New York has no general landlord-entry statute. (Its use on line 353 for habitability is correct; the line 322 use as an "entry statute" was the miscite.)
- **Source:** https://www.nysenate.gov/legislation/laws/RPP/235-B
- **Action:** removed from the landlord-entry parenthetical (line 322); retained correctly on line 353 for habitability. See Step 4(a).

### 2026-07-19 — Texas Property Code §92.0081
- **Source file:** src/App.jsx:322
- **Verdict:** INCORRECT
- **Subject:** §92.0081 is the LOCKOUT statute, not a landlord-entry statute. Texas has no general landlord-entry statute.
- **Source:** https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm#92.0081
- **Action:** removed from the landlord-entry parenthetical (line 322). See Step 4(a).

### 2026-07-19 — Massachusetts G.L. c. 186 §15B
- **Source file:** src/App.jsx:45, 309, 322, 337, 435
- **Verdict:** INCORRECT
- **Subject:** §15B is the SECURITY-DEPOSIT statute; only §15B(1)(a) incidentally limits the purposes for which a lease may authorize entry. Its use as a security-deposit citation (lines 45, 309, 435) is correct; the line 322 use as a general "entry statute" was the miscite.
- **Source:** https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B
- **Action:** on line 322, replaced with the precise §15B(1)(a) entry-purpose limitation; retained correctly elsewhere as the deposit statute. See Step 4(a).

### 2026-07-19 — California Civil Code §1942.5
- **Source file:** src/App.jsx:337
- **Verdict:** VERIFIED
- **Subject:** Anti-retaliation; rebuttable presumption of retaliation within 180 days of protected activity.
- **Source:** https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1942.5
- **Action:** no change — confirmed

### 2026-07-19 — New York Real Property Law §223-b
- **Source file:** src/App.jsx:337
- **Verdict:** VERIFIED
- **Subject:** Retaliation against tenants; rebuttable presumption for actions within one year of a good-faith complaint.
- **Source:** https://www.nysenate.gov/legislation/laws/RPP/223-B
- **Action:** no change — confirmed

### 2026-07-19 — Texas Property Code §92.331
- **Source file:** src/App.jsx:337
- **Verdict:** VERIFIED
- **Subject:** Retaliation by landlord; prohibited retaliatory acts within six months of protected activity.
- **Source:** https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm#92.331
- **Action:** no change — confirmed

### 2026-07-19 — Massachusetts G.L. c. 186 §18
- **Source file:** src/App.jsx:337
- **Verdict:** VERIFIED
- **Subject:** Reprisal/retaliation against tenants; presumption of retaliation within six months.
- **Source:** https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section18
- **Action:** no change — confirmed

### 2026-07-19 — California Civil Code §§1941 (and §1942)
- **Source file:** src/App.jsx:353
- **Verdict:** VERIFIED
- **Subject:** Landlord's duty to maintain habitable premises (§1941) and tenant repair-and-deduct remedy (§1942); implied warranty of habitability.
- **Source:** https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1941
- **Action:** no change — confirmed

### 2026-07-19 — California case law: Green v. Superior Court
- **Source file:** src/App.jsx:353
- **Verdict:** VERIFIED
- **Subject:** Green v. Superior Court (1974) 10 Cal.3d 616 — established the implied warranty of habitability in California residential leases.
- **Source:** https://law.justia.com/cases/california/supreme-court/3d/10/616.html
- **Action:** no change — confirmed (non-section citation; logged for completeness)

### 2026-07-19 — Massachusetts G.L. c. 111 §127A
- **Source file:** src/App.jsx:353
- **Verdict:** VERIFIED
- **Subject:** State Sanitary Code; enforcement of minimum standards of fitness for human habitation.
- **Source:** https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter111/Section127A
- **Action:** no change — confirmed

### 2026-07-19 — Massachusetts case law: Boston Housing Authority v. Hemingway
- **Source file:** src/App.jsx:353
- **Verdict:** VERIFIED
- **Subject:** Boston Housing Authority v. Hemingway (1973) 363 Mass. 184 — established the implied warranty of habitability in Massachusetts.
- **Source:** https://law.justia.com/cases/massachusetts/supreme-court/1973/363-mass-184-1.html
- **Action:** no change — confirmed (non-section citation; logged for completeness)

### 2026-07-19 — California Civil Code §789.3
- **Source file:** src/App.jsx:369
- **Verdict:** VERIFIED
- **Subject:** Prohibited landlord self-help (utility shutoff, lockout); up to $100/day actual plus $100/day punitive damages.
- **Source:** https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=789.3
- **Action:** no change — confirmed

### 2026-07-19 — Texas Property Code §92.008
- **Source file:** src/App.jsx:369
- **Verdict:** VERIFIED
- **Subject:** Interruption of utilities by landlord prohibited; tenant remedies.
- **Source:** https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm#92.008
- **Action:** no change — confirmed

### 2026-07-19 — Florida Statutes §83.67
- **Source file:** src/App.jsx:369
- **Verdict:** VERIFIED
- **Subject:** Prohibited practices; landlord may not interrupt utilities or engage in self-help eviction.
- **Source:** http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/0083.67.html
- **Action:** no change — confirmed

### 2026-07-19 — New York Real Property Law §235 (interruption of services)
- **Source file:** src/App.jsx:369
- **Verdict:** VERIFIED
- **Subject:** Willful violation by landlord; intentional interruption of essential services prohibited.
- **Source:** https://www.nysenate.gov/legislation/laws/RPP/235
- **Action:** no change — confirmed

### 2026-07-19 — Massachusetts G.L. c. 186 §14 (quiet enjoyment / utility)
- **Source file:** src/App.jsx:369
- **Verdict:** VERIFIED
- **Subject:** Interference with quiet enjoyment; criminal and civil penalties for utility interruption.
- **Source:** https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section14
- **Action:** no change — confirmed

### 2026-07-19 — NYC Administrative Code §27-2005
- **Source file:** src/App.jsx:373
- **Verdict:** INCORRECT
- **Subject:** §27-2005 is the Housing Maintenance Code owner-duty (habitability) provision; it was miscited in the criminal illegal-utility-shutoff context.
- **Source:** https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-70432
- **Action:** removed from the criminal-liability warning (line 373). See Step 4(b).

### 2026-07-19 — California Penal Code §418
- **Source file:** src/App.jsx:373
- **Verdict:** INCORRECT
- **Subject:** §418 governs forcible entry/detainer; it does NOT govern illegal utility shutoff and was miscited for criminal-shutoff liability.
- **Source:** https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=418
- **Action:** line 373 rewritten so §418 remains only as an explicit "do not rely on California Penal Code §418, which governs forcible entry/detainer, not utility service" clarifier. See Step 4(b).

### 2026-07-19 — 42 U.S.C. §§3601-3619 (Fair Housing Act)
- **Source file:** src/App.jsx:401
- **Verdict:** VERIFIED
- **Subject:** Federal Fair Housing Act; prohibits discrimination in housing on protected bases.
- **Source:** https://www.law.cornell.edu/uscode/text/42/chapter-45/subchapter-I
- **Action:** no change — confirmed

### 2026-07-19 — 42 U.S.C. §3604 & §3604(f) (FHA disability)
- **Source file:** src/App.jsx:405
- **Verdict:** VERIFIED
- **Subject:** Prohibited discrimination; §3604(f) covers disability, reasonable accommodation and reasonable modification.
- **Source:** https://www.law.cornell.edu/uscode/text/42/3604
- **Action:** no change — confirmed

### 2026-07-19 — 42 U.S.C. §3610 (HUD complaint)
- **Source file:** src/App.jsx:408
- **Verdict:** VERIFIED
- **Subject:** Administrative enforcement; HUD complaint must be filed within one year of the discriminatory act.
- **Source:** https://www.law.cornell.edu/uscode/text/42/3610
- **Action:** no change — confirmed

### 2026-07-19 — 42 U.S.C. §3613 (private right of action)
- **Source file:** src/App.jsx:408
- **Verdict:** VERIFIED
- **Subject:** Private civil action; actual and punitive damages, attorney's fees, injunctive relief.
- **Source:** https://www.law.cornell.edu/uscode/text/42/3613
- **Action:** no change — confirmed

### 2026-07-19 — California Code of Civil Procedure §1161 (unlawful detainer)
- **Source file:** src/App.jsx:419
- **Verdict:** VERIFIED
- **Subject:** Unlawful detainer; grounds and notice requirements for eviction.
- **Source:** https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=1161
- **Action:** no change — confirmed

### 2026-07-19 — Texas Property Code §24.005 (eviction notice)
- **Source file:** src/App.jsx:419
- **Verdict:** VERIFIED
- **Subject:** Notice to vacate prior to filing eviction suit.
- **Source:** https://statutes.capitol.texas.gov/Docs/PR/htm/PR.24.htm#24.005
- **Action:** no change — confirmed

### 2026-07-19 — New York RPAPL §711 (eviction grounds)
- **Source file:** src/App.jsx:419
- **Verdict:** VERIFIED
- **Subject:** Grounds where a special proceeding to recover possession may be maintained.
- **Source:** https://www.nysenate.gov/legislation/laws/RPA/711
- **Action:** no change — confirmed

### 2026-07-19 — Massachusetts G.L. c. 186 §12 (eviction notice)
- **Source file:** src/App.jsx:419
- **Verdict:** VERIFIED
- **Subject:** Notice to determine a tenancy at will; eviction notice requirements.
- **Source:** https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section12
- **Action:** no change — confirmed

### 2026-07-19 — California Civil Code §1946.2 (just-cause eviction)
- **Source file:** src/App.jsx:421
- **Verdict:** VERIFIED
- **Subject:** Tenant Protection Act just-cause eviction requirements.
- **Source:** https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1946.2
- **Action:** no change — confirmed

### 2026-07-19 — California Civil Code §1950.5 (security deposit)
- **Source file:** src/App.jsx:435
- **Verdict:** VERIFIED
- **Subject:** Security deposits; itemized statement and return timelines.
- **Source:** https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5
- **Action:** no change — confirmed

### 2026-07-19 — Texas Property Code §92.109 (deposit)
- **Source file:** src/App.jsx:435
- **Verdict:** VERIFIED
- **Subject:** Liability of landlord for bad-faith retention of security deposit.
- **Source:** https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm#92.109
- **Action:** no change — confirmed

### 2026-07-19 — New York General Obligations Law §7-108 (deposit)
- **Source file:** src/App.jsx:435
- **Verdict:** VERIFIED
- **Subject:** Security deposit handling, itemization, and 14-day return requirement.
- **Source:** https://www.nysenate.gov/legislation/laws/GOB/7-108
- **Action:** no change — confirmed
