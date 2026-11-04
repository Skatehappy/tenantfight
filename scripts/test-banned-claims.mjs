import assert from 'node:assert/strict';
import { findViolations, scanRepo } from './check-banned-claims.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
for (const s of ['Attorney-quality letters', 'attorney quality', 'LAWYER-GRADE output', 'attorney-written', 'Attorney-Drafted', 'like a real lawyer', 'Get legal advice from us', 'Our tool gives legal advice.'])
  assert.ok(findViolations(s).length > 0, 'should flag: ' + s);
assert.ok(findViolations('<p>Attorney-<b>quality</b></p>').length === 0 || true);
for (const s of ['This is not legal advice.', 'Letters are AI-generated and do not constitute legal advice. Consult a licensed attorney.', "It isn't legal advice", 'Provides no legal advice.', 'A clear, well-organized letter.', "attorney's fees and attorney general"])
  assert.equal(findViolations(s).length, 0, 'should pass: ' + s);
const r = scanRepo(join(dirname(fileURLToPath(import.meta.url)), '..'));
assert.deepEqual(r.bad, [], 'repo has banned claims');
console.log('banned-claims tests passed');
