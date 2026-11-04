// api/_voicelint.js - NO ATTORNEY VOICE. Every letter is written and signed by the tenant in their own name.
// SIGNER_RULE goes into every letter prompt (client and server); voiceHits() is the server-side lint run on every
// generate output (draft, review, assertive) and every checklist item. No imports, Edge/browser safe.
export const SIGNER_RULE = 'The letter is written and signed by the tenant in their own name ([Your Name]). Never describe the writer as an attorney, counsel, law firm or representative and never sign for a client.';

// Patterns are matched on normalised text (curly quotes straightened, all whitespace runs -> one space, case-insensitive).
// Deliberately narrow so normal tenant text is untouched: "consult an attorney", "attorney's fees", "attorney general",
// "consult counsel for advice" are NOT hits.
const WHO = String.raw`(?:the\s+|a\s+)?(?:tenants?|lessee|resident|occupant|plaintiff|respondent|defendant|me|my\b|mr\b|ms\b|mrs\b|dr\b|\[|\()`;
const PATTERNS = [
  ['attorney for', new RegExp(String.raw`(?:^|\n)\s*attorneys?\s+for\b|\battorneys?\s+for\s+${WHO}`, 'i')],
  ['Esq.', /\besq\b/i],
  ['Esquire', /\besquire\b/i],
  ['counsel for', new RegExp(String.raw`(?:^|\n)\s*counsel\s+for\b|\bcounsel\s+for\s+${WHO}`, 'i')],
  ['on behalf of my client', /\bon\s+behalf\s+of\s+(?:my|our|the)\s+clients?\b/i],
  ['my client', /\b(?:my|our)\s+clients?\b/i],
  ['this firm represents', /\b(?:this|our|the)\s+(?:law\s+)?firm\s+(?:represents|has\s+been\s+retained)\b/i],
  ['attorney at law', /\battorneys?\s+(?:and\s+counsel(?:l?or)?\s+)?at\s+law\b/i],
  ['law office of', /\blaw\s+offices?\s+of\b/i],
];
export const normalizeVoice = s => String(s == null ? '' : s)
  .replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"')
  .replace(/[​-‍﻿]/g, '').replace(/[ \t\r\f\v  -  　]+/g, ' ').replace(/ ?\n ?/g, '\n');
// Returns the list of banned labels found ([] = clean).
export function voiceHits(text) {
  const t = normalizeVoice(text);
  return PATTERNS.filter(([, re]) => re.test(t)).map(([label]) => label);
}
