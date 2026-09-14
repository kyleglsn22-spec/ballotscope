# BallotScope architecture notes

## Trust boundaries

External providers are untrusted inputs. Adapters retrieve a payload, archive it in R2, calculate a content hash, and only then normalize records into PostgreSQL. A normalized record should have a provenance link and any unresolved mapping or schema concern should become a data-quality flag.

The public API reads published, immutable model runs. It must never calculate a forecast on request, accept a probability from a client, or silently fall back to a stale source.

## Model boundary

The deterministic/statistical model produces margins, probabilities, intervals, and structured attribution packets. Prediction-market observations are comparison data and remain outside the model input bundle. An explanation service may turn a verified packet into prose, but a verifier must reject prose whose numeric claims do not match the packet.

## Deployment boundary

- Cloudflare Worker: public API and static web client.
- Supabase PostgreSQL + PostGIS: canonical and ledger records.
- R2: raw payloads and simulation artifacts.
- Queues/Workflows: ingestion, validation, debounced model runs, and nightly refresh.
- Python service: historical training, simulation, and cycle-held-out evaluation.
- Hyperdrive: Worker-to-PostgreSQL connection path when deployed.

The committed Wrangler file intentionally contains no resource IDs, database URLs, or secrets. Bindings are added per environment after provisioning. BallotScope uses its own Worker configuration and is intentionally separate from the Desk site.

## Promotion gate

A model version can be marked production-ready only when its input bundle is reproducible, its cycle-held-out evaluation is stored, its attribution packet reconciles, and the public ledger entry contains timestamp, semantic version, and hash metadata.
