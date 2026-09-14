# BallotScope

BallotScope is a transparent election-intelligence platform scaffold for the 2026 U.S. federal-election MVP described in the planning specification.

This repository currently provides the auditable data spine, a read-only API shell, deterministic forecast utilities, source-health checks, raw-payload archiving primitives, and a React interface. It intentionally does not ship live political forecasts, model coefficients, candidate rankings, or fabricated source data. Forecast outputs must be produced only by a separately validated model run with stored inputs, version, timestamp, and provenance.

## Repository layout

- `src/index.ts` — Cloudflare Worker API and static asset fallback
- `src/domain.ts` — API contracts, source registry, and constitutional rules
- `src/forecast.ts` — deterministic simulation summaries, intervals, and attribution checks
- `src/reliability.ts` — stale-source evaluation
- `src/archive.ts` — content hashing and R2 raw-payload archive primitive
- `web/` — React MVP interface and build configuration
- `model/` — dependency-light correlated simulation and cycle-held-out validation core
- `db/schema.sql` — PostgreSQL/PostGIS append-only schema for the canonical, provenance, evidence, forecast, and ledger layers
- `db/seed.sql` — non-political development metadata only
- `tests/` — API, forecast-math, reliability, and archive tests
- `wrangler.jsonc` — isolated BallotScope Worker configuration; add real binding IDs per environment

## Local development

```bash
npm install
npm test
npm run typecheck
npm run web:typecheck
npm run web:build
python -m unittest discover -s model/tests -v
npm run dev
```

The Worker exposes:

- `GET /health`
- `GET /api/v1/meta`
- `GET /api/v1/sources`
- `GET /api/v1/adapters`
- `GET /api/v1/races`
- `GET /api/v1/ledger`
- `GET /api/v1/forecasts` — explicit not-ready response until an audited model run is configured

## Next implementation steps

1. Provision isolated BallotScope Supabase PostgreSQL + PostGIS, R2, Queues, and Hyperdrive resources outside this repository.
2. Add source-specific ingestion adapters with raw payload archiving and provenance links.
3. Implement canonical race/entity resolution and source audits for 2026 district boundaries.
4. Build historical cycle-held-out backtests before publishing any probability.
5. Add append-only forecast runs, attribution packets, and numeric verification.

No credentials belong in source control. Use `.dev.vars` locally and Wrangler secrets for deployed environments.
