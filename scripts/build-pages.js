import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { isMerged } from './data/merged.js';
import { STATES } from './data/states.js';
import { DISPUTES } from './data/disputes.js';
import { APP_CONFIG } from './data/config.js';
import { renderStateHub } from './templates/state-hub-template.js';
import { renderDeepPage } from './templates/deep-page-template.js';

const PUBLIC_DIR = 'public';
const GENERATED_DIR = path.join('scripts', 'data', 'generated');

// SEO Phase 2 — per-state regulatory data (verified; see VERIFICATION_LOG-SEO-CONTENT.md).
let STATE_DATA = {};
try {
  STATE_DATA = JSON.parse(fs.readFileSync(path.join('scripts', 'data', 'state-data.json'), 'utf8'));
} catch (e) {
  console.warn('WARN: scripts/data/state-data.json not found — pages will build without enrichment sections.');
}

let stats = { stateHubs: 0, deepPages: 0, missing: 0 };
const missingPages = [];

for (const state of STATES) {
  const stateDir = path.join(PUBLIC_DIR, state.slug);
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  fs.writeFileSync(
    path.join(stateDir, 'index.html'),
    renderStateHub(state, DISPUTES, STATES, STATE_DATA[state.abbr])
  );
  stats.stateHubs++;

  for (const dispute of DISPUTES) {
    // Merged combos are consolidated into the state hub and 301-redirected (vercel.json).
    if (isMerged(state.slug, dispute.slug)) {
      fs.rmSync(path.join(stateDir, dispute.slug), { recursive: true, force: true });
      stats.merged = (stats.merged || 0) + 1;
      continue;
    }
    const cacheFile = path.join(GENERATED_DIR, state.slug, `${dispute.slug}.json`);

    if (!fs.existsSync(cacheFile)) {
      console.log(`MISSING content for ${state.slug}/${dispute.slug}`);
      missingPages.push(`${state.slug}/${dispute.slug}`);
      stats.missing++;
      continue;
    }

    const content = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const disputeDir = path.join(stateDir, dispute.slug);
    if (!fs.existsSync(disputeDir)) fs.mkdirSync(disputeDir, { recursive: true });

    fs.writeFileSync(
      path.join(disputeDir, 'index.html'),
      renderDeepPage(state, dispute, content, STATES, DISPUTES, STATE_DATA[state.abbr])
    );
    stats.deepPages++;
  }
}

// Sitemap lists indexable URLs only (merged combos 301 to their hub). lastmod is the
// file's last git commit date; a file changed since HEAD gets today's date.
const TODAY = new Date().toISOString().slice(0, 10);
function lastmod(file) {
  try {
    if (execFileSync('git', ['status', '--porcelain', '--', file], { encoding: 'utf8' }).trim()) return TODAY;
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim() || TODAY;
  } catch { return TODAY; }
}
const url = (loc, file, priority, changefreq) =>
  `<url><loc>https://${APP_CONFIG.domain}${loc}</loc><lastmod>${lastmod(path.join(PUBLIC_DIR, file))}</lastmod><priority>${priority}</priority><changefreq>${changefreq}</changefreq></url>`;

const sitemapUrls = [
  url('/', 'landing.html', '1.0', 'weekly'),
  ...STATES.map(s => url(`/${s.slug}`, `${s.slug}/index.html`, '0.8', 'monthly')),
  ...STATES.flatMap(s => DISPUTES.filter(d => !isMerged(s.slug, d.slug))
    .map(d => url(`/${s.slug}/${d.slug}`, `${s.slug}/${d.slug}/index.html`, '0.7', 'monthly')))
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join('\n')}
</urlset>`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemap);

const robots = `User-agent: *
Allow: /
Sitemap: https://${APP_CONFIG.domain}/sitemap.xml
`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robots);

console.log(`\n=== Build complete ===`);
console.log(`State hubs:  ${stats.stateHubs}`);
console.log(`Deep pages:  ${stats.deepPages}`);
console.log(`Merged:      ${stats.merged || 0} (301 to state hub)`);
console.log(`Missing:     ${stats.missing}`);
if (missingPages.length > 0) {
  console.log(`\nMissing pages (re-run npm run generate:content):`);
  missingPages.forEach(p => console.log(`  ${p}`));
}
console.log(`Sitemap and robots.txt written.`);
