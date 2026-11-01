// State×topic combos consolidated into their state hub (2026-11-01 indexing plan).
// A merged combo is not generated, is 301-redirected to /<state>#<topic> (vercel.json),
// is left out of the sitemap, and is rendered as a short section on the state hub.
import fs from 'fs';
import path from 'path';

export const MERGED = new Set(JSON.parse(fs.readFileSync(path.join('scripts', 'data', 'merged-combos.json'), 'utf8')));
export function isMerged(stateSlug, disputeSlug) { return MERGED.has(`${stateSlug}/${disputeSlug}`); }
export function comboHref(stateSlug, disputeSlug) {
  return isMerged(stateSlug, disputeSlug) ? `/${stateSlug}#${disputeSlug}` : `/${stateSlug}/${disputeSlug}`;
}
