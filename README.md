# BallotScope

BallotScope is a transparent election-intelligence platform scaffold for the 2026 U.S. federal-election MVP described in the planning specification.

This repository currently provides the auditable data spine and a read-only API shell. It intentionally does not ship live political forecasts, model coefficients, candidate rankings, or fabricated source data. Forecast outputs must be produced only by a separately validated model run with stored inputs, version, timestamp, and provenance.

## Repository layout

- `src/index.ts` — Cloudflare Worker API shell and static landing response
- `db/schema.sql` — PostgreSQL/PostGIS append-only schema for the canonical, provenance, evidence, forecast, and ledger layers
- `db/seed.sql` — non-political development metadata only
- `tests/api.test.ts` — contract tests for health and endpoint behavior
- `wrangler.jsonc` — placeholder Worker configuration; add real binding IDs per environment

## Local development

```bash
npm install
npm test
npm run typecheck
npm run dev
```

The Worker exposes:

- `GET /health`
- `GET /api/v1/meta`
- `GET /api/v1/forecasts` (returns an explicit not-ready response until an audited model run is configured)

## Next implementation steps

1. Provision Supabase PostgreSQL + PostGIS, R2, Queues, and Hyperdrive outside this repository.
2. Add source-specific ingestion adapters with raw payload archiving and provenance links.
3. Implement canonical race/entity resolution and source audits for 2026 district boundaries.
4. Build historical cycle-held-out backtests before publishing any probability.
5. Add append-only forecast runs, attribution packets, and numeric verification.

No credentials belong in source control. Use `.dev.vars` locally and Wrangler secrets for deployed environments.
