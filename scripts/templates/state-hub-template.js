import { APP_CONFIG } from '../data/config.js';

export function renderStateHub(state, disputes, allStates) {
  const otherStates = allStates.filter(s => s.slug !== state.slug);

  const disputeCards = disputes.map(d => `
    <a class="dispute-card" href="/${state.slug}/${d.slug}">
      <div class="dispute-icon">${d.icon}</div>
      <div class="dispute-name">${d.name}</div>
      <div class="dispute-arrow">→</div>
    </a>`).join('');

  const otherStateLinks = otherStates.map(s => `
    <a class="state-link" href="/${s.slug}">${s.name}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${state.name} ${capitalize(APP_CONFIG.vertical)} — Demand Letter Generator | ${APP_CONFIG.name}</title>
<meta name="description" content="State-specific demand letters for ${APP_CONFIG.vertical} disputes in ${state.name}. AI-generated, attorney-quality, $${APP_CONFIG.price} flat. Covers all ${disputes.length} major dispute types.">
<link rel="canonical" href="https://${APP_CONFIG.domain}/${state.slug}">
<meta property="og:title" content="${state.name} ${capitalize(APP_CONFIG.vertical)} | ${APP_CONFIG.name}">
<meta property="og:description" content="State-specific demand letters for ${state.name}. $${APP_CONFIG.price} flat.">
<meta property="og:url" content="https://${APP_CONFIG.domain}/${state.slug}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;background:#f8fafc;color:#0f0f0f;line-height:1.6}
nav{position:sticky;top:0;z-index:100;background:rgba(248,250,252,0.92);backdrop-filter:blur(12px);border-bottom:1px solid #dde3ec;padding:14px 28px;display:flex;justify-content:space-between;align-items:center}
.nav-brand{display:flex;align-items:center;gap:10px;text-decoration:none}
.nav-icon{width:32px;height:32px;background:linear-gradient(135deg,${APP_CONFIG.primaryColor},#0d1f33);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px}
.nav-name{font-family:'Fraunces',Georgia,serif;font-size:17px;font-weight:700;color:#0f0f0f}
.nav-cta{background:${APP_CONFIG.primaryColor};color:#fff;padding:9px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600}
.hero{background:linear-gradient(160deg,#1a2a0a 0%,#2a4a1a 60%,#1a4a3a 100%);color:#fff;padding:80px 24px;text-align:center}
.hero h1{font-family:'Fraunces',Georgia,serif;font-size:clamp(32px,5vw,52px);font-weight:900;line-height:1.1;margin-bottom:16px;letter-spacing:-0.02em}
.hero p{font-size:18px;color:rgba(255,255,255,0.85);max-width:640px;margin:0 auto 32px;font-weight:300}
.btn-primary{background:${APP_CONFIG.accentColor};color:#0d1f33;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block}
.container{max-width:1100px;margin:0 auto;padding:64px 24px}
.intro{font-size:17px;color:#3a3a3a;line-height:1.75;max-width:780px;margin-bottom:48px}
h2{font-family:'Fraunces',Georgia,serif;font-size:32px;font-weight:900;margin-bottom:24px;letter-spacing:-0.02em}
.dispute-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:64px}
.dispute-card{background:#fff;border:1px solid #dde3ec;border-radius:10px;padding:24px;display:flex;align-items:center;gap:16px;text-decoration:none;color:#0f0f0f;transition:box-shadow 0.2s}
.dispute-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.08)}
.dispute-icon{font-size:32px;flex-shrink:0}
.dispute-name{flex:1;font-weight:700;font-size:15px}
.dispute-arrow{color:${APP_CONFIG.primaryColor};font-size:20px;font-weight:700}
.steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:24px;margin-bottom:64px}
.step{padding:0 16px}
.step-num{font-family:'Fraunces',Georgia,serif;font-size:48px;font-weight:900;color:${APP_CONFIG.primaryColor};opacity:0.2;line-height:1}
.step-title{font-weight:700;font-size:16px;margin:8px 0}
.step-body{font-size:14px;color:#6b6b6b;line-height:1.65}
.other-states{background:#eef2f7;padding:48px 24px;border-radius:14px}
.state-links{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
.state-link{background:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;color:#0f0f0f;font-weight:500;font-size:14px;border:1px solid #dde3ec}
.state-link:hover{background:${APP_CONFIG.primaryColor};color:#fff}
footer{background:#0f0f0f;color:rgba(255,255,255,0.5);text-align:center;padding:32px 24px;font-size:12px}
footer a{color:rgba(255,255,255,0.7);text-decoration:none}
.cta-section{text-align:center;padding:64px 24px;background:#fff;border-radius:14px;margin-bottom:48px}
.cta-section h2{margin-bottom:16px}
.cta-section p{color:#6b6b6b;margin-bottom:24px}
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
<section class="hero">
  <h1>${state.name} ${capitalize(APP_CONFIG.vertical)}</h1>
  <p>State-specific demand letters citing ${state.name} statutes. AI-generated, attorney-quality, $${APP_CONFIG.price} flat. Covers all ${disputes.length} major dispute types.</p>
  <a class="btn-primary" href="/app?state=${state.slug}">Generate My ${state.name} Letter →</a>
</section>
<div class="container">
  <p class="intro">${state.name} has specific statutory protections that govern ${APP_CONFIG.vertical}. Knowing your rights is the first step; enforcing them requires a formal written demand letter that cites the relevant ${state.name} statutes, sets a firm deadline, and states the legal consequences of non-compliance. ${APP_CONFIG.name} generates exactly that letter — tailored to ${state.name} law, your specific dispute, and your timeline. Below are the ${disputes.length} dispute types we cover for ${state.name} residents.</p>

  <h2>${state.name} Dispute Types</h2>
  <div class="dispute-grid">${disputeCards}</div>

  <h2>How It Works</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">01</div>
      <div class="step-title">Choose Your Dispute</div>
      <div class="step-body">Pick the ${state.name} dispute type from the cards above.</div>
    </div>
    <div class="step">
      <div class="step-num">02</div>
      <div class="step-title">Answer Quick Questions</div>
      <div class="step-body">Plain-English questions about your situation. No legal knowledge required.</div>
    </div>
    <div class="step">
      <div class="step-num">03</div>
      <div class="step-title">AI Writes Your Letter</div>
      <div class="step-body">Citing ${state.name} statutes, deadlines, and remedies. Attorney-quality.</div>
    </div>
    <div class="step">
      <div class="step-num">04</div>
      <div class="step-title">Send & Get Results</div>
      <div class="step-body">Print, sign, send certified mail. Most disputes resolve at this stage.</div>
    </div>
  </div>

  <div class="cta-section">
    <h2>Ready to take action in ${state.name}?</h2>
    <p>$${APP_CONFIG.price} flat. No subscription. Letter ready in 5 minutes.</p>
    <a class="btn-primary" href="${APP_CONFIG.payhipUrl}">${APP_CONFIG.ctaText} →</a>
  </div>

  <div class="other-states">
    <h2>Other States We Cover</h2>
    <div class="state-links">${otherStateLinks}</div>
  </div>
</div>
<footer>
  <p>${APP_CONFIG.name} &middot; &copy; 2026 The Super Simple Software Company &middot; <a href="mailto:support@buyappsonce.com">support@buyappsonce.com</a></p>
  <p style="margin-top:8px;font-size:11px;opacity:0.6">Legal Disclaimer: This page provides general information about ${state.name} ${APP_CONFIG.vertical} law and is not legal advice. Statutes change; verify current law or consult a licensed attorney for advice on your specific situation.</p>
</footer>
</body>
</html>`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
