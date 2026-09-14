# Contributing

BallotScope is an evidence and reproducibility project. Keep the following constraints in mind:

- Do not add live forecast values, candidate rankings, or source claims without an archived, licensed input and provenance link.
- Do not use prediction-market prices as hidden model inputs.
- Do not let AI-generated prose write or mutate probabilities.
- Keep forecast and public-ledger records append-only; use a correction/new run.
- Add a test for every new invariant or parser rule.
- Never commit API keys, database URLs, access tokens, or `.dev.vars`.

Before opening a pull request:

```bash
npm ci
npx wrangler types --check
npm test
npm run typecheck
npx tsc -p web/tsconfig.json --noEmit
npm run web:build
npx wrangler deploy --dry-run
```
