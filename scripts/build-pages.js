import fs from 'fs';
import path from 'path';
import { STATES } from './data/states.js';
import { DISPUTES } from './data/disputes.js';
import { APP_CONFIG } from './data/config.js';
import { renderStateHub } from './templates/state-hub-template.js';
import { renderDeepPage } from './templates/deep-page-template.js';

const PUBLIC_DIR = 'public';
const GENERATED_DIR = path.join('scripts', 'data', 'generated');

let stats = { stateHubs: 0, deepPages: 0, missing: 0 };
const missingPages = [];

for (const state of STATES) {
  const stateDir = path.join(PUBLIC_DIR, state.slug);
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  fs.writeFileSync(
    path.join(stateDir, 'index.html'),
    renderStateHub(state, DISPUTES, STATES)
  );
  stats.stateHubs++;

  for (const dispute of DISPUTES) {
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
      renderDeepPage(state, dispute, content, STATES, DISPUTES)
    );
    stats.deepPages++;
  }
}

const sitemapUrls = [
  `<url><loc>https://${APP_CONFIG.domain}/</loc><priority>1.0</priority><changefreq>weekly</changefreq></url>`,
  ...STATES.map(s => `<url><loc>https://${APP_CONFIG.domain}/${s.slug}</loc><priority>0.8</priority><changefreq>monthly</changefreq></url>`),
  ...STATES.flatMap(s => DISPUTES.map(d => `<url><loc>https://${APP_CONFIG.domain}/${s.slug}/${d.slug}</loc><priority>0.7</priority><changefreq>monthly</changefreq></url>`))
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
console.log(`Missing:     ${stats.missing}`);
if (missingPages.length > 0) {
  console.log(`\nMissing pages (re-run npm run generate:content):`);
  missingPages.forEach(p => console.log(`  ${p}`));
}
console.log(`Sitemap and robots.txt written.`);
