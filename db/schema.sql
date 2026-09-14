CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE sources (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, license TEXT, source_type TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE ingest_runs (id BIGSERIAL PRIMARY KEY, source_id BIGINT NOT NULL REFERENCES sources(id), started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ, status TEXT NOT NULL, parser_version TEXT NOT NULL);
CREATE TABLE raw_documents (id BIGSERIAL PRIMARY KEY, ingest_run_id BIGINT NOT NULL REFERENCES ingest_runs(id), retrieved_at TIMESTAMPTZ NOT NULL, content_sha256 TEXT NOT NULL, r2_key TEXT NOT NULL UNIQUE);
CREATE TABLE elections (id BIGSERIAL PRIMARY KEY, cycle INTEGER NOT NULL, election_type TEXT NOT NULL, election_date DATE NOT NULL, status TEXT NOT NULL);
CREATE TABLE jurisdictions (id BIGSERIAL PRIMARY KEY, geoid TEXT NOT NULL, state TEXT NOT NULL, district TEXT, type TEXT NOT NULL, name TEXT NOT NULL, geom geometry(MultiPolygon, 4326), boundary_version TEXT NOT NULL);
CREATE INDEX jurisdictions_geom_gist ON jurisdictions USING GIST (geom);
CREATE TABLE races (id BIGSERIAL PRIMARY KEY, election_id BIGINT NOT NULL REFERENCES elections(id), jurisdiction_id BIGINT NOT NULL REFERENCES jurisdictions(id), office TEXT NOT NULL, seat_class TEXT, is_special BOOLEAN NOT NULL DEFAULT false, status TEXT NOT NULL);
CREATE TABLE parties (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, abbreviation TEXT NOT NULL);
CREATE TABLE candidates (id BIGSERIAL PRIMARY KEY, canonical_name TEXT NOT NULL, party_id BIGINT REFERENCES parties(id));
CREATE TABLE race_candidates (race_id BIGINT NOT NULL REFERENCES races(id), candidate_id BIGINT NOT NULL REFERENCES candidates(id), incumbent BOOLEAN NOT NULL DEFAULT false, nominee BOOLEAN NOT NULL DEFAULT false, ballot_status TEXT, PRIMARY KEY (race_id, candidate_id));
CREATE TABLE external_ids (entity_type TEXT NOT NULL, entity_id BIGINT NOT NULL, source_id BIGINT NOT NULL REFERENCES sources(id), external_id TEXT NOT NULL, PRIMARY KEY (entity_type, source_id, external_id));
CREATE TABLE provenance_links (entity_type TEXT NOT NULL, entity_id BIGINT NOT NULL, raw_document_id BIGINT NOT NULL REFERENCES raw_documents(id), PRIMARY KEY (entity_type, entity_id, raw_document_id));
CREATE TABLE data_quality_flags (id BIGSERIAL PRIMARY KEY, entity_type TEXT NOT NULL, entity_id BIGINT NOT NULL, severity TEXT NOT NULL, rule TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE model_versions (id BIGSERIAL PRIMARY KEY, semantic_version TEXT NOT NULL UNIQUE, git_commit TEXT NOT NULL, methodology_hash TEXT NOT NULL, released_at TIMESTAMPTZ NOT NULL);
CREATE TABLE model_runs (id BIGSERIAL PRIMARY KEY, model_version_id BIGINT NOT NULL REFERENCES model_versions(id), started_at TIMESTAMPTZ NOT NULL, input_bundle_hash TEXT NOT NULL);
CREATE TABLE race_forecasts (id BIGSERIAL PRIMARY KEY, model_run_id BIGINT NOT NULL REFERENCES model_runs(id), race_id BIGINT NOT NULL REFERENCES races(id), expected_margin NUMERIC, win_probability JSONB NOT NULL, intervals JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE chamber_forecasts (id BIGSERIAL PRIMARY KEY, model_run_id BIGINT NOT NULL REFERENCES model_runs(id), chamber TEXT NOT NULL, control_probability JSONB NOT NULL, expected_seats JSONB NOT NULL, seat_distribution JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE forecast_attributions (id BIGSERIAL PRIMARY KEY, old_run BIGINT NOT NULL REFERENCES model_runs(id), new_run BIGINT NOT NULL REFERENCES model_runs(id), race_id BIGINT NOT NULL REFERENCES races(id), factor TEXT NOT NULL, contribution_pp NUMERIC NOT NULL);
CREATE TABLE events (id BIGSERIAL PRIMARY KEY, race_id BIGINT REFERENCES races(id), event_type TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, source_id BIGINT REFERENCES sources(id), structured_payload JSONB NOT NULL, significance_score NUMERIC);

CREATE INDEX races_election_idx ON races(election_id);
CREATE INDEX race_forecasts_race_created_idx ON race_forecasts(race_id, created_at);
CREATE INDEX events_occurred_idx ON events(occurred_at DESC);

CREATE OR REPLACE FUNCTION prevent_forecast_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only forecast tables cannot be mutated'; END; $$;
CREATE TRIGGER race_forecasts_append_only BEFORE UPDATE OR DELETE ON race_forecasts FOR EACH ROW EXECUTE FUNCTION prevent_forecast_mutation();
CREATE TRIGGER chamber_forecasts_append_only BEFORE UPDATE OR DELETE ON chamber_forecasts FOR EACH ROW EXECUTE FUNCTION prevent_forecast_mutation();
