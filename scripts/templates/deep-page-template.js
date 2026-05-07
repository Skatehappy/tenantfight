import { APP_CONFIG } from '../data/config.js';

export function renderDeepPage(state, dispute, content, allStates, allDisputes) {
  const otherStatesForDispute = allStates.filter(s => s.slug !== state.slug);
  const otherDisputesForState = allDisputes.filter(d => d.slug !== dispute.slug);

  const faqHTML = content.faq.map(f => `
    <div class="faq-item">
      <div class="faq-q">${escapeHtml(f.q)}</div>
      <div class="faq-a">${escapeHtml(f.a)}</div>
    </div>`).join('');

  const faqSchema = content.faq.map(f => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a }
  }));

  const otherStateLinks = otherStatesForDispute.map(s => `
    <a class="cross-link" href="/${s.slug}/${dispute.slug}">${s.name} ${dispute.name}</a>`).join('');

  const otherDisputeLinks = otherDisputesForState.map(d => `
    <a class="cross-link" href="/${state.slug}/${d.slug}">${d.icon} ${d.name}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(content.metaTitle)}</title>
<meta name="description" content="${escapeHtml(content.metaDescription)}">
<link rel="canonical" href="https://${APP_CONFIG.domain}/${state.slug}/${dispute.slug}">
<meta property="og:title" content="${escapeHtml(content.metaTitle)}">
<meta property="og:description" content="${escapeHtml(content.metaDescription)}">
<meta property="og:url" content="https://${APP_CONFIG.domain}/${state.slug}/${dispute.slug}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "LegalService",
  "name": `${APP_CONFIG.name} - ${state.name} ${dispute.name}`,
  "areaServed": { "@type": "State", "name": state.name },
  "description": content.metaDescription,
  "offers": { "@type": "Offer", "price": APP_CONFIG.price.toString(), "priceCurrency": "USD" }
}, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqSchema
}, null, 2)}
</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;background:#f8fafc;color:#0f0f0f;line-height:1.6}
nav{position:sticky;top:0;z-index:100;background:rgba(248,250,252,0.92);backdrop-filter:blur(12px);border-bottom:1px solid #dde3ec;padding:14px 28px;display:flex;justify-content:space-between;align-items:center}
.nav-brand{display:flex;align-items:center;gap:10px;text-decoration:none}
.nav-icon{width:32px;height:32px;background:linear-gradient(135deg,${APP_CONFIG.primaryColor},#0d1f33);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px}
.nav-name{font-family:'Fraunces',Georgia,serif;font-size:17px;font-weight:700}
.nav-cta{background:${APP_CONFIG.primaryColor};color:#fff;padding:9px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600}
.breadcrumb{padding:16px 24px;background:#eef2f7;font-size:13px;color:#6b6b6b}
.breadcrumb a{color:${APP_CONFIG.primaryColor};text-decoration:none}
.hero{background:linear-gradient(160deg,#1a2a0a 0%,#2a4a1a 60%,#1a4a3a 100%);color:#fff;padding:64px 24px;text-align:center}
.hero h1{font-family:'Fraunces',Georgia,serif;font-size:clamp(28px,4.5vw,44px);font-weight:900;line-height:1.15;margin-bottom:16px;letter-spacing:-0.02em;max-width:900px;margin-left:auto;margin-right:auto}
.hero p{font-size:17px;color:rgba(255,255,255,0.85);max-width:680px;margin:0 auto 28px;font-weight:300}
.btn-primary{background:${APP_CONFIG.accentColor};color:#0d1f33;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block}
.container{max-width:980px;margin:0 auto;padding:48px 24px}
.statute-callout{background:#fff;border-left:4px solid ${APP_CONFIG.primaryColor};border-radius:8px;padding:24px;margin-bottom:40px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}
.statute-callout-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:8px}
.statute-callout-label{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b6b6b;font-weight:700;margin-bottom:4px}
.statute-callout-value{font-size:15px;font-weight:600;color:#0f0f0f}
h2{font-family:'Fraunces',Georgia,serif;font-size:28px;font-weight:900;margin:40px 0 16px;letter-spacing:-0.02em}
.prose{font-size:16px;line-height:1.8;color:#3a3a3a;margin-bottom:24px}
.prose p{margin-bottom:14px}
.cta-block{background:linear-gradient(135deg,${APP_CONFIG.primaryColor},#0d1f33);color:#fff;border-radius:14px;padding:40px;text-align:center;margin:48px 0}
.cta-block h2{color:#fff;margin-top:0}
.cta-block p{color:rgba(255,255,255,0.8);margin-bottom:24px}
.faq-grid{border:1px solid #dde3ec;border-radius:10px;overflow:hidden;margin-bottom:48px;background:#fff}
.faq-item{padding:24px 28px;border-bottom:1px solid #dde3ec}
.faq-item:last-child{border-bottom:none}
.faq-q{font-weight:700;font-size:16px;margin-bottom:8px}
.faq-a{font-size:14px;color:#3a3a3a;line-height:1.7}
.cross-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:48px 0}
.cross-section h3{font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#6b6b6b;font-weight:700;margin-bottom:12px}
.cross-link{display:block;padding:8px 14px;background:#fff;border:1px solid #dde3ec;border-radius:6px;text-decoration:none;color:#0f0f0f;font-size:13px;margin-bottom:6px}
.cross-link:hover{background:${APP_CONFIG.primaryColor};color:#fff}
@media(max-width:640px){.cross-grid{grid-template-columns:1fr}}
.disclaimer{background:#eef2f7;padding:24px;border-radius:8px;font-size:13px;color:#6b6b6b;line-height:1.7;margin:48px 0}
footer{background:#0f0f0f;color:rgba(255,255,255,0.5);text-align:center;padding:32px 24px;font-size:12px}
footer a{color:rgba(255,255,255,0.7);text-decoration:none}
</style>
</head>
<body>
<nav>
  <a class="nav-brand" href="/">
    <div class="nav-icon">${APP_CONFIG.brandIcon}</div>
    <span class="nav-name">${APP_CONFIG.name}</span>
  </a>
  <a class="nav-cta" href="${APP_CONFIG.payhipUrl}">${APP_CONFIG.ctaText} →</a>
</nav>
<div class="breadcrumb">
  <a href="/">Home</a> &rsaquo; <a href="/${state.slug}">${state.name}</a> &rsaquo; ${escapeHtml(dispute.name)}
</div>
<section class="hero">
  <h1>${escapeHtml(content.h1)}</h1>
  <p>${escapeHtml(content.metaDescription)}</p>
  <a class="btn-primary" href="/app?state=${state.slug}&dispute=${dispute.slug}">Generate My Letter — $${APP_CONFIG.price}</a>
</section>
<div class="container">
  <div class="prose"><p>${escapeHtml(content.introParagraph)}</p></div>

  <div class="statute-callout">
    <div class="statute-callout-row">
      <div>
        <div class="statute-callout-label">Statute</div>
        <div class="statute-callout-value">${escapeHtml(content.statuteCitation)}</div>
      </div>
      <div>
        <div class="statute-callout-label">Deadline</div>
        <div class="statute-callout-value">${escapeHtml(content.deadline)}</div>
      </div>
      <div>
        <div class="statute-callout-label">Penalty / Remedy</div>
        <div class="statute-callout-value">${escapeHtml(content.penalty)}</div>
      </div>
    </div>
  </div>

  <h2>${escapeHtml(dispute.name)} Law in ${state.name}</h2>
  <div class="prose">${formatProse(content.lawExplanation)}</div>

  <h2>How a Demand Letter Works in ${state.name}</h2>
  <div class="prose">${formatProse(content.letterStrategy)}</div>

  <h2>Procedural Notes for ${state.name}</h2>
  <div class="prose">${formatProse(content.proceduralNotes)}</div>

  <div class="cta-block">
    <h2>Generate Your ${state.name} ${escapeHtml(dispute.name)}</h2>
    <p>$${APP_CONFIG.price} flat. State-specific. Ready in 5 minutes.</p>
    <a class="btn-primary" href="/app?state=${state.slug}&dispute=${dispute.slug}">${APP_CONFIG.ctaText} →</a>
  </div>

  <h2>Frequently Asked Questions</h2>
  <div class="faq-grid">${faqHTML}</div>

  <div class="cross-grid">
    <div class="cross-section">
      <h3>Other ${state.name} Disputes</h3>
      ${otherDisputeLinks}
    </div>
    <div class="cross-section">
      <h3>Same Dispute, Other States</h3>
      ${otherStateLinks}
    </div>
  </div>

  <div class="disclaimer">
    <strong>Legal Disclaimer:</strong> This page provides general information about ${state.name} ${APP_CONFIG.vertical} law and is not legal advice. Statutes change; verify current law with ${state.name}'s statutes or consult a licensed attorney for advice on your specific situation. ${APP_CONFIG.name} generates demand letters; it does not provide legal representation.
  </div>
</div>
<footer>
  <p>${APP_CONFIG.name} &middot; &copy; 2026 The Super Simple Software Company &middot; <a href="mailto:support@buyappsonce.com">support@buyappsonce.com</a></p>
</footer>
</body>
</html>`;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function formatProse(text) {
  if (!text) return '';
  return text.split(/\n\n+/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
}
