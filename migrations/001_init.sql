-- EdenCode Anchor — hash-only weather anchoring schema
-- Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS weather_records (
  id            BIGSERIAL PRIMARY KEY,
  station_id    BIGINT,
  observed_at   TIMESTAMPTZ,
  data          JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','hashed','error')),
  record_hash   TEXT,
  batch_id      BIGINT,
  leaf_index    INT,
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  hashed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS anchor_batches (
  id            BIGSERIAL PRIMARY KEY,
  merkle_root   TEXT NOT NULL,
  leaf_count    INT NOT NULL,
  algo          TEXT DEFAULT 'sha256',
  anchor_mode   TEXT DEFAULT 'hashonly',
  bsv_txid      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weather_records_status
  ON weather_records (status);
CREATE INDEX IF NOT EXISTS idx_weather_records_station_observed
  ON weather_records (station_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_weather_records_record_hash
  ON weather_records (record_hash);
CREATE INDEX IF NOT EXISTS idx_weather_records_batch_id
  ON weather_records (batch_id);
