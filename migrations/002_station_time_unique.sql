-- EdenCode Anchor — dedup live observations by (station, observation time).
-- Idempotent: safe to run repeatedly.
--
-- A unique index on (station_id, observed_at) lets the live poller upsert with
-- ON CONFLICT DO NOTHING so re-polling the same observation never creates a
-- duplicate pending record. Postgres treats NULLs as distinct, so manual
-- ingests without a station/time are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS ux_weather_station_time
  ON weather_records (station_id, observed_at);
