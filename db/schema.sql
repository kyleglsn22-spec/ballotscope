-- BallotScope system of record.
-- Apply to PostgreSQL with PostGIS enabled. Forecast and public-ledger records
-- are append-only; corrections create new rows and remain visible.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Source and provenance layer -------------------------------------------------

CREATE TABLE sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  license TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('polling', 'campaign_finance', 'geography', 'historical_results', 'prediction_market')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ingest_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES sources(id),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  parser_version TEXT NOT NULL,
  rows_received INTEGER,
  error_summary TEXT
);

CREATE TABLE raw_documents (
  id BIGSERIAL PRIMARY KEY,
  ingest_run_id BIGINT NOT NULL REFERENCES ingest_runs(id),
  retrieved_at TIMESTAMPTZ NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  content_type TEXT,
  byte_length BIGINT,
  r2_key TEXT NOT NULL UNIQUE
);

CREATE TABLE provenance_links (
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  raw_document_id BIGINT NOT NULL REFERENCES raw_documents(id),
  PRIMARY KEY (entity_type, entity_id, raw_document_id)
);

CREATE TABLE data_quality_flags (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  rule TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'accepted', 'resolved')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE source_health (
  source_id BIGINT PRIMARY KEY REFERENCES sources(id),
  expected_cadence_seconds INTEGER NOT NULL CHECK (expected_cadence_seconds > 0),
  last_successful_fetch TIMESTAMPTZ,
  last_attempted_fetch TIMESTAMPTZ,
  rows_received INTEGER,
  parser_version TEXT,
  schema_anomalies JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('unconfigured', 'current', 'stale', 'error')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Canonical election layer ----------------------------------------------------

CREATE TABLE elections (
  id BIGSERIAL PRIMARY KEY,
  cycle INTEGER NOT NULL,
  election_type TEXT NOT NULL,
  election_date DATE NOT NULL,
  status TEXT NOT NULL,
  UNIQUE (cycle, election_type)
);

CREATE TABLE jurisdictions (
  id BIGSERIAL PRIMARY KEY,
  geoid TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT,
  type TEXT NOT NULL CHECK (type IN ('congressional_district', 'statewide')),
  name TEXT NOT NULL,
  geom geometry(MultiPolygon, 4326),
  boundary_version TEXT NOT NULL,
  UNIQUE (geoid, boundary_version)
);

CREATE INDEX jurisdictions_geom_gist ON jurisdictions USING GIST (geom);

CREATE TABLE races (
  id BIGSERIAL PRIMARY KEY,
  election_id BIGINT NOT NULL REFERENCES elections(id),
  jurisdiction_id BIGINT NOT NULL REFERENCES jurisdictions(id),
  office TEXT NOT NULL CHECK (office IN ('House', 'Senate')),
  seat_class TEXT,
  is_special BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL,
  UNIQUE (election_id, jurisdiction_id, office)
);

CREATE TABLE parties (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL UNIQUE
);

CREATE TABLE candidates (
  id BIGSERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  party_id BIGINT REFERENCES parties(id)
);

CREATE TABLE race_candidates (
  race_id BIGINT NOT NULL REFERENCES races(id),
  candidate_id BIGINT NOT NULL REFERENCES candidates(id),
  incumbent BOOLEAN NOT NULL DEFAULT false,
  nominee BOOLEAN NOT NULL DEFAULT false,
  ballot_status TEXT,
  PRIMARY KEY (race_id, candidate_id)
);

CREATE TABLE external_ids (
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  source_id BIGINT NOT NULL REFERENCES sources(id),
  external_id TEXT NOT NULL,
  PRIMARY KEY (entity_type, source_id, external_id)
);

-- Polling evidence ------------------------------------------------------------

CREATE TABLE pollsters (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  canonical_slug TEXT NOT NULL UNIQUE
);

CREATE TABLE polls (
  id BIGSERIAL PRIMARY KEY,
  race_id BIGINT REFERENCES races(id),
  pollster_id BIGINT NOT NULL REFERENCES pollsters(id),
  sponsor TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  population TEXT NOT NULL,
  sample_size INTEGER,
  mode TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL,
  raw_document_id BIGINT REFERENCES raw_documents(id),
  CHECK (end_date >= start_date)
);

CREATE TABLE poll_results (
  poll_id BIGINT NOT NULL REFERENCES polls(id),
  candidate_id BIGINT NOT NULL REFERENCES candidates(id),
  pct NUMERIC NOT NULL CHECK (pct >= 0 AND pct <= 100),
  undecided_pct NUMERIC CHECK (undecided_pct >= 0 AND undecided_pct <= 100),
  PRIMARY KEY (poll_id, candidate_id)
);

-- Campaign finance evidence ---------------------------------------------------

CREATE TABLE committees (
  id BIGSERIAL PRIMARY KEY,
  fec_committee_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE candidate_committees (
  candidate_id BIGINT NOT NULL REFERENCES candidates(id),
  committee_id BIGINT NOT NULL REFERENCES committees(id),
  relationship_type TEXT NOT NULL,
  PRIMARY KEY (candidate_id, committee_id, relationship_type)
);

CREATE TABLE finance_snapshots (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidates(id),
  report_date DATE NOT NULL,
  receipts NUMERIC,
  disbursements NUMERIC,
  cash_on_hand NUMERIC,
  debts NUMERIC,
  outside_spending NUMERIC,
  reporting_period_start DATE,
  reporting_period_end DATE,
  raw_document_id BIGINT REFERENCES raw_documents(id),
  UNIQUE (candidate_id, report_date)
);

-- Prediction markets ----------------------------------------------------------

CREATE TABLE market_venues (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE prediction_markets (
  id BIGSERIAL PRIMARY KEY,
  venue_id BIGINT NOT NULL REFERENCES market_venues(id),
  external_id TEXT NOT NULL,
  race_id BIGINT REFERENCES races(id),
  rules TEXT NOT NULL,
  resolution_source TEXT,
  UNIQUE (venue_id, external_id)
);

CREATE TABLE market_snapshots (
  id BIGSERIAL PRIMARY KEY,
  market_id BIGINT NOT NULL REFERENCES prediction_markets(id),
  observed_at TIMESTAMPTZ NOT NULL,
  yes_price NUMERIC NOT NULL CHECK (yes_price >= 0 AND yes_price <= 1),
  bid NUMERIC CHECK (bid >= 0 AND bid <= 1),
  ask NUMERIC CHECK (ask >= 0 AND ask <= 1),
  spread NUMERIC CHECK (spread >= 0),
  liquidity NUMERIC CHECK (liquidity >= 0),
  volume NUMERIC CHECK (volume >= 0),
  raw_document_id BIGINT REFERENCES raw_documents(id)
);

-- Forecast ledger -------------------------------------------------------------

CREATE TABLE model_versions (
  id BIGSERIAL PRIMARY KEY,
  semantic_version TEXT NOT NULL UNIQUE,
  git_commit TEXT NOT NULL,
  methodology_hash TEXT NOT NULL,
  released_at TIMESTAMPTZ NOT NULL,
  training_cycles INTEGER[] NOT NULL,
  changelog TEXT NOT NULL
);

CREATE TABLE model_runs (
  id BIGSERIAL PRIMARY KEY,
  model_version_id BIGINT NOT NULL REFERENCES model_versions(id),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  input_bundle_hash TEXT NOT NULL CHECK (input_bundle_hash ~ '^[0-9a-f]{64}$'),
  deterministic_seed BIGINT,
  error_summary TEXT
);

CREATE TABLE poll_adjustments (
  id BIGSERIAL PRIMARY KEY,
  model_version_id BIGINT NOT NULL REFERENCES model_versions(id),
  poll_id BIGINT NOT NULL REFERENCES polls(id),
  house_effect NUMERIC NOT NULL DEFAULT 0,
  sponsor_effect NUMERIC NOT NULL DEFAULT 0,
  effective_weight NUMERIC NOT NULL CHECK (effective_weight >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE race_forecasts (
  id BIGSERIAL PRIMARY KEY,
  model_run_id BIGINT NOT NULL REFERENCES model_runs(id),
  race_id BIGINT NOT NULL REFERENCES races(id),
  observed_at TIMESTAMPTZ NOT NULL,
  expected_margin NUMERIC,
  win_probability JSONB NOT NULL,
  intervals JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_run_id, race_id)
);

CREATE TABLE chamber_forecasts (
  id BIGSERIAL PRIMARY KEY,
  model_run_id BIGINT NOT NULL REFERENCES model_runs(id),
  chamber TEXT NOT NULL CHECK (chamber IN ('House', 'Senate')),
  observed_at TIMESTAMPTZ NOT NULL,
  control_probability JSONB NOT NULL,
  expected_seats JSONB NOT NULL,
  seat_distribution JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_run_id, chamber)
);

CREATE TABLE simulation_artifacts (
  id BIGSERIAL PRIMARY KEY,
  model_run_id BIGINT NOT NULL REFERENCES model_runs(id),
  r2_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE forecast_changes (
  id BIGSERIAL PRIMARY KEY,
  race_id BIGINT NOT NULL REFERENCES races(id),
  old_run BIGINT NOT NULL REFERENCES model_runs(id),
  new_run BIGINT NOT NULL REFERENCES model_runs(id),
  probability_delta NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (race_id, old_run, new_run)
);

CREATE TABLE forecast_attributions (
  id BIGSERIAL PRIMARY KEY,
  change_id BIGINT NOT NULL REFERENCES forecast_changes(id),
  factor TEXT NOT NULL,
  contribution_pp NUMERIC NOT NULL,
  UNIQUE (change_id, factor)
);

CREATE TABLE explanations (
  id BIGSERIAL PRIMARY KEY,
  change_id BIGINT NOT NULL REFERENCES forecast_changes(id),
  template_version TEXT NOT NULL,
  ai_model TEXT,
  input_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public tape and evaluation --------------------------------------------------

CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  race_id BIGINT REFERENCES races(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('POLL_ADDED', 'MARKET_MOVE', 'FINANCE_REPORT', 'FORECAST_MOVE', 'CANDIDATE_STATUS', 'MODEL_VERSION', 'SOURCE_CORRECTION')),
  occurred_at TIMESTAMPTZ NOT NULL,
  source_id BIGINT REFERENCES sources(id),
  structured_payload JSONB NOT NULL,
  significance_score NUMERIC,
  link TEXT
);

CREATE TABLE result_snapshots (
  id BIGSERIAL PRIMARY KEY,
  race_id BIGINT NOT NULL REFERENCES races(id),
  observed_at TIMESTAMPTZ NOT NULL,
  votes JSONB NOT NULL,
  reporting_pct NUMERIC CHECK (reporting_pct >= 0 AND reporting_pct <= 100),
  raw_document_id BIGINT REFERENCES raw_documents(id)
);

CREATE TABLE model_evaluations (
  id BIGSERIAL PRIMARY KEY,
  model_version_id BIGINT NOT NULL REFERENCES model_versions(id),
  election_cycle INTEGER NOT NULL,
  brier NUMERIC,
  mae NUMERIC,
  log_loss NUMERIC,
  coverage_50 NUMERIC,
  coverage_80 NUMERIC,
  coverage_95 NUMERIC,
  chamber_seat_mae NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_version_id, election_cycle)
);

-- Indexes ---------------------------------------------------------------------

CREATE INDEX races_election_idx ON races(election_id);
CREATE INDEX race_candidates_candidate_idx ON race_candidates(candidate_id);
CREATE INDEX external_ids_entity_idx ON external_ids(entity_type, entity_id);
CREATE INDEX polls_race_end_date_idx ON polls(race_id, end_date DESC);
CREATE INDEX polls_retrieved_idx ON polls(retrieved_at DESC);
CREATE INDEX finance_snapshots_candidate_date_idx ON finance_snapshots(candidate_id, report_date DESC);
CREATE INDEX market_snapshots_market_observed_idx ON market_snapshots(market_id, observed_at DESC);
CREATE INDEX race_forecasts_race_observed_idx ON race_forecasts(race_id, observed_at DESC);
CREATE INDEX chamber_forecasts_chamber_observed_idx ON chamber_forecasts(chamber, observed_at DESC);
CREATE INDEX forecast_changes_race_created_idx ON forecast_changes(race_id, created_at DESC);
CREATE INDEX events_occurred_idx ON events(occurred_at DESC);
CREATE INDEX result_snapshots_race_observed_idx ON result_snapshots(race_id, observed_at DESC);

-- Append-only safeguards ------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table % cannot be mutated; insert a correction/new run instead', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER race_forecasts_append_only BEFORE UPDATE OR DELETE ON race_forecasts FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER chamber_forecasts_append_only BEFORE UPDATE OR DELETE ON chamber_forecasts FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER forecast_changes_append_only BEFORE UPDATE OR DELETE ON forecast_changes FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER forecast_attributions_append_only BEFORE UPDATE OR DELETE ON forecast_attributions FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER explanations_append_only BEFORE UPDATE OR DELETE ON explanations FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
