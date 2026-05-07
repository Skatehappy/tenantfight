# Deviations from MASTER_SPEC.md

Logged per user instruction to record any out-of-spec changes rather than make them silently.

## 1. `scripts/generate-content.js` — dotenv loading

**Spec section 7** specifies `import 'dotenv/config';`.

**Deviation:** Replaced with:
```js
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
```

**Reason:** The default `dotenv/config` import reads `.env` only. Spec section 14 mandates the API key live in `.env.local`. With the literal spec import, the Anthropic SDK fails with "Could not resolve authentication method" on every call. The replacement loads `.env.local` first then falls back to `.env`.

## 2. `.gitignore` — broader contents than spec

**Spec section 14** lists these additions only:
```
.env.local
scripts/data/generated/_failures.log
```

**Deviation:** Created a full `.gitignore` (no prior file existed) including standard Vite/Node ignores in addition to the spec's lines:
```
node_modules/
dist/
.env
.env.local
.env.*.local
.vercel
.DS_Store
*.log
scripts/data/generated/_failures.log
```

**Reason:** Repo had no existing `.gitignore`. Without `node_modules/` ignored, `npm install` would stage 100+ MB of dependencies. The spec's two lines alone would not produce a working gitignore from scratch.

## 3. Price correction (TenantFight only)

**Packet section 1 / config.js** specifies `price: 49`.

**Deviation:** Changed to `price: 39` and updated all `$49 flat` strings in `scripts/data/disputes.js` to `$39 flat`.

**Reason:** User clarified during the build that TenantFight's actual price is $39, not $49. This is a correction to packet data, not a code change.
