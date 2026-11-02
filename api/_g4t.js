// api/_g4t.js — Gate 4 test code, shared by generate.js and checklist.js. Inert unless
// G4_TEST_CODE_SECRET is set in the Vercel env (no default, never in the repo). The accepted code is
// "G4T-" + that secret. It skips the Payhip verify and the usage-mark. Each endpoint keeps its own
// per-day call counter in this function instance's memory, so it is best-effort: a cold start or a
// second warm instance starts its own count. Every use is logged without the code.
import { timingSafeEqual } from 'node:crypto';

const TEST_PREFIX = 'G4T-';

export function isTestCode(code) {
  const secret = process.env.G4_TEST_CODE_SECRET;
  const c = (code || '').trim();
  if (!secret || !c.startsWith(TEST_PREFIX)) return false;
  const a = Buffer.from(c);
  const b = Buffer.from(TEST_PREFIX + secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createQuota(cap) {
  const state = { day: '', calls: 0, cap };
  return {
    state,
    take() {
      const day = new Date().toISOString().slice(0, 10);
      if (state.day !== day) { state.day = day; state.calls = 0; }
      if (state.calls >= cap) return false;
      state.calls += 1;
      return true;
    },
  };
}
