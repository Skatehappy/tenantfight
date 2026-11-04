// api/_budget.js — per-request time budgets (ms). Vercel Hobby caps a Node function at 60s (maxDuration) and an
// Edge function must start responding within 25s, so every /api request carries a deadline and every model call
// is aborted at it. Nothing here raises maxDuration. TF_BUDGET_SCALE is a TEST hook only (tests scale all of
// these and their mocked delays by the same factor so the proof runs in under a second); unset in production.
const scale = () => { const k = Number(process.env.TF_BUDGET_SCALE); return k > 0 ? k : 1; };
const B = {
  NODE_TOTAL: 50000,            // hard ceiling for a whole /api/generate request (maxDuration is 60000)
  NODE_MODEL_DEADLINE: 42000,   // model work must be finished by t0 + this (license verify <= 8s sits inside it)
  NODE_USAGE_MARK: 5000,        // the Payhip usage-mark call after the letter, hard timeout
  NODE_SECOND_CALL_MIN: 24000,  // lint regeneration / truncation retry only if at least this much budget is left
  EDGE_VERIFY: 4000,            // checklist license verify timeout
  EDGE_MODEL: 18000,            // checklist model time (all attempts together); 4s verify + 18s = 22s < 25s
  EDGE_RETRY_MIN: 9000,         // checklist truncation retry only if at least this much model budget is left
};
export const budget = name => B[name] * scale();
