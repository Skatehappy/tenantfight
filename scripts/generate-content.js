import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { STATES } from './data/states.js';
import { DISPUTES } from './data/disputes.js';
import { APP_CONFIG } from './data/config.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GENERATED_DIR = path.join('scripts', 'data', 'generated');
const FAILURES_LOG = path.join(GENERATED_DIR, '_failures.log');

if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

function buildPrompt(state, dispute, vertical) {
  return `You are a legal content writer specializing in ${vertical} law. Write a comprehensive, accurate, state-specific landing page for a tool that generates ${dispute.name} letters in ${state.name}.

Output MUST be valid JSON with this exact schema (no preamble, no markdown fence, no explanation):

{
  "h1": "page title with state and dispute type",
  "metaTitle": "50-60 chars, includes state and dispute and 'demand letter'",
  "metaDescription": "140-160 chars, compelling, includes state and dispute",
  "statuteCitation": "exact statute reference",
  "deadline": "specific number of days",
  "penalty": "specific multiplier or remedy",
  "introParagraph": "100-150 words, plain language, why this state's law matters",
  "lawExplanation": "250-350 words, explains the dispute law in this state",
  "letterStrategy": "200-300 words, how a demand letter works in this state",
  "proceduralNotes": "100-150 words, court limits, filing fees, time limits, state-specific notes",
  "faq": [
    {"q": "question", "a": "50-100 word answer"},
    {"q": "question", "a": "50-100 word answer"},
    {"q": "question", "a": "50-100 word answer"},
    {"q": "question", "a": "50-100 word answer"},
    {"q": "question", "a": "50-100 word answer"}
  ]
}

REQUIREMENTS:
- All statute citations must be real and currently valid
- All deadlines must match current state law
- All penalties/remedies must reflect actual statute
- No legalese - readable by non-lawyers
- Total word count across fields: 800-1200 words minimum
- Do not invent facts. If unsure, use phrases like "varies by jurisdiction"
- Output ONLY the JSON object

State: ${state.name}
Dispute type: ${dispute.name}
Vertical: ${vertical}
Small claims limit: $${state.smallClaimsLimit.toLocaleString()}`;
}

function validate(content) {
  if (!content) return 'parsing failed';
  const required = ['h1', 'metaTitle', 'metaDescription', 'statuteCitation', 'deadline', 'penalty', 'introParagraph', 'lawExplanation', 'letterStrategy', 'proceduralNotes', 'faq'];
  for (const key of required) {
    if (!content[key]) return `missing field: ${key}`;
  }
  if (!Array.isArray(content.faq) || content.faq.length < 5) return 'faq must have 5 items';

  const totalText = [content.introParagraph, content.lawExplanation, content.letterStrategy, content.proceduralNotes, ...content.faq.map(f => f.q + ' ' + f.a)].join(' ');
  const wordCount = totalText.split(/\s+/).filter(Boolean).length;
  if (wordCount < 800) return `word count too low: ${wordCount}`;

  if (!/§|Section|Title|Code|Stat\.|Statute|ILCS|Compiled Statutes/i.test(content.statuteCitation)) return 'statute citation does not match expected pattern';

  return null;
}

async function generateOne(state, dispute) {
  const stateDir = path.join(GENERATED_DIR, state.slug);
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  const cacheFile = path.join(stateDir, `${dispute.slug}.json`);
  if (fs.existsSync(cacheFile)) {
    console.log(`  SKIP ${state.slug}/${dispute.slug} (cached)`);
    return { status: 'skipped' };
  }

  const prompt = buildPrompt(state, dispute, APP_CONFIG.vertical);

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    const jsonText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      const error = `JSON parse error for ${state.slug}/${dispute.slug}: ${e.message}`;
      console.log(`  FAIL ${state.slug}/${dispute.slug} - ${error}`);
      fs.appendFileSync(FAILURES_LOG, error + '\n');
      return { status: 'failed', reason: error };
    }

    const validationError = validate(parsed);
    if (validationError) {
      const error = `Validation error for ${state.slug}/${dispute.slug}: ${validationError}`;
      console.log(`  FAIL ${state.slug}/${dispute.slug} - ${error}`);
      fs.appendFileSync(FAILURES_LOG, error + '\n');
      return { status: 'failed', reason: error };
    }

    fs.writeFileSync(cacheFile, JSON.stringify(parsed, null, 2));
    console.log(`  OK   ${state.slug}/${dispute.slug}`);
    return { status: 'success' };
  } catch (e) {
    const error = `API error for ${state.slug}/${dispute.slug}: ${e.message}`;
    console.log(`  FAIL ${state.slug}/${dispute.slug} - ${error}`);
    fs.appendFileSync(FAILURES_LOG, error + '\n');
    return { status: 'failed', reason: error };
  }
}

async function main() {
  console.log(`Generating content for ${APP_CONFIG.name}...`);
  console.log(`Total pages: ${STATES.length * DISPUTES.length}`);

  let stats = { success: 0, failed: 0, skipped: 0 };

  for (const state of STATES) {
    for (const dispute of DISPUTES) {
      const result = await generateOne(state, dispute);
      stats[result.status] = (stats[result.status] || 0) + 1;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Success: ${stats.success}`);
  console.log(`Failed:  ${stats.failed}`);
  console.log(`Skipped: ${stats.skipped}`);
  if (stats.failed > 0) {
    console.log(`\nFailures logged to ${FAILURES_LOG}`);
  }
}

main().catch(console.error);
