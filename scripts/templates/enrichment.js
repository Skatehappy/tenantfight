// scripts/templates/enrichment.js — TenantFight (landlord-tenant domain)
// SEO Phase 2: injects verified, state-specific tenant-rights sections BELOW the
// existing page content, driven by scripts/data/state-data.json so prose reflects
// each state's actual law (a 14-day deposit return reads differently from 30; a
// repair-and-deduct state differently from one with only court remedies).

function esc(s){ if(s==null) return ''; return String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function has(v){ if(v==null) return false; const s=String(v).trim(); return s!=='' && s.toLowerCase()!=='null' && s.toLowerCase()!=='n/a'; }
function clean(s){ return String(s==null?'':s).trim().replace(/\s+/g,' ').replace(/\.+$/,''); }
function sent(s){ const t=clean(s); return t?t+'.':''; }
function lcFrag(s){ const t=clean(s); return t?sent(t.charAt(0).toLowerCase()+t.slice(1)):''; }
function article(w){ return /^[aeiou]/i.test(String(w).trim())?'an':'a'; }

const TOPIC_EMPHASIS = {
  'security-deposit-demand-letter': ['security_deposit_rules'],
  'habitability-violation-letter':  ['habitability_standards','repair_and_deduct'],
  'illegal-entry-notice':           ['entry_notice_requirements','retaliation_protections'],
  'landlord-retaliation-letter':    ['retaliation_protections','eviction_process'],
  'wrongful-eviction-response':     ['eviction_process','retaliation_protections'],
  'utility-shutoff-letter':         ['eviction_process','habitability_standards'],
  'move-out-deduction-dispute':     ['security_deposit_rules'],
  'landlord-lease-violation':       ['habitability_standards','entry_notice_requirements'],
  'mold-pest-infestation-letter':   ['habitability_standards','repair_and_deduct'],
  'quiet-enjoyment-violation':      ['entry_notice_requirements','retaliation_protections'],
};
const RIGHTS = [
  ['security_deposit_rules','Security deposit'],
  ['habitability_standards','Habitability'],
  ['repair_and_deduct','Repair and deduct'],
  ['rent_withholding','Rent withholding'],
  ['entry_notice_requirements','Landlord entry / notice'],
  ['retaliation_protections','Retaliation protection'],
  ['lease_termination_rules','Ending the tenancy'],
  ['eviction_process','Eviction process'],
  ['rent_control','Rent control'],
];

function overviewProse(state,d){
  const st=d.landlord_tenant_statute||{};
  const paras=[];
  const noStatute=/no single|no comprehensive/i.test(st.name||'');
  if(noStatute){
    paras.push(`${state} has no single comprehensive landlord-tenant code — your rights come from a set of statutes (${has(st.citation)?st.citation:'security-deposit, retaliation, and eviction acts'}) plus, in some cities, stronger local ordinances. Knowing which provision applies is what gives a demand letter its force.`);
  } else {
    paras.push(`Landlord-tenant relationships in ${state} are governed by the ${st.name}${has(st.citation)?` (${st.citation})`:''}. It sets the baseline rules for deposits, repairs, entry, and eviction that a lease cannot lawfully undercut.`);
  }
  const rb=d.regulatory_body||'';
  if(has(rb)) paras.push(`${sent(rb)}`);
  if(has(d.recent_reform) && !/^(no|none)\b/i.test(d.recent_reform)) paras.push(`A recent change to watch: ${sent(d.recent_reform)}`);
  return paras;
}

export function renderEnrichmentSections(state, dispute, d){
  if(!d) return '';
  const S=state.name;
  const overview=overviewProse(S,d).filter(has).map(p=>`      <p>${esc(p)}</p>`).join('\n');

  const emph=TOPIC_EMPHASIS[dispute.slug]||RIGHTS.map(r=>r[0]);
  const order=[...emph, ...RIGHTS.map(r=>r[0]).filter(k=>!emph.includes(k))];
  const labelOf=Object.fromEntries(RIGHTS);
  const rights=order.map(k=>{ const v=d[k]; if(!has(v)) return ''; return `      <p><strong>${esc(labelOf[k])}:</strong> ${esc(sent(v))}</p>`; }).filter(Boolean).join('\n');

  const rb=d.regulatory_body||'';
  const enforceBits=[];
  if(has(rb)) enforceBits.push(`      <p>${esc(sent(rb))}</p>`);
  if(has(d.eviction_process)) enforceBits.push(`      <p><strong>If eviction is threatened:</strong> ${esc(sent(d.eviction_process))}</p>`);
  const enforceBody = enforceBits.length ? enforceBits.join('\n')
    : `      <p>${esc(S)} tenant disputes are enforced through the courts (small claims for deposits, housing/eviction court for possession). A dated, statute-cited demand letter is the practical first step and often resolves the issue before filing.</p>`;

  const issues=Array.isArray(d.common_disputes)?d.common_disputes.filter(has):[];
  const issuesList=issues.length?`      <ul>\n${issues.map(i=>`        <li>${esc(i)}</li>`).join('\n')}\n      </ul>`:`      <p>The most common ${esc(S)} landlord-tenant disputes involve security deposits, repairs/habitability, and evictions.</p>`;

  const feats=Array.isArray(d.unique_protections)?d.unique_protections.filter(has):[];
  const featBlock=feats.length?`    <section class="enrich-section">
      <h2>${esc(S)} Tenant Protections Worth Knowing</h2>
      <ul>\n${feats.slice(0,4).map(f=>`        <li>${esc(f)}</li>`).join('\n')}\n      </ul>
    </section>`:'';

  return `
  <div class="enrich">
    <section class="enrich-section">
      <h2>${esc(S)} Tenant Rights Overview</h2>
${overview}
    </section>
    <section class="enrich-section">
      <h2>Your Rights as ${article(S)} ${esc(S)} Tenant</h2>
${rights}
    </section>
    <section class="enrich-section">
      <h2>How to Enforce Your Rights in ${esc(S)}</h2>
${enforceBody}
    </section>
    <section class="enrich-section">
      <h2>Common Landlord-Tenant Disputes in ${esc(S)}</h2>
${issuesList}
    </section>
${featBlock}
  </div>`;
}

export function dataFaqs(state, d){
  if(!d) return [];
  const S=state.name; const out=[];
  if(has(d.security_deposit_rules)) out.push({q:`What are the security deposit rules in ${S}?`, a:sent(d.security_deposit_rules)});
  if(has(d.entry_notice_requirements)) out.push({q:`How much notice must a landlord give before entering in ${S}?`, a:sent(d.entry_notice_requirements)});
  if(has(d.rent_control)) out.push({q:`Does ${S} have rent control?`, a:sent(d.rent_control)});
  else if(has(d.retaliation_protections)) out.push({q:`Is my landlord allowed to retaliate against me in ${S}?`, a:sent(d.retaliation_protections)});
  return out.slice(0,3);
}

export function stateLawSnapshot(stateName, d){
  if(!d) return '';
  return overviewProse(stateName,d)[0]||'';
}

export function stateTeaser(state, d){
  if(!d) return '';
  const st=d.landlord_tenant_statute||{};
  if(/no single|no comprehensive/i.test(st.name||'')) return `No single tenant code — governed by ${has(st.citation)?st.citation:'multiple statutes'} plus local ordinances`;
  return `Governed by ${st.name}${has(st.citation)?` (${st.citation})`:''}`;
}
