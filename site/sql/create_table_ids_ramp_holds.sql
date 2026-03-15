-- IDS Ramp Gate Reservations (Holds)
-- Stores temporary "HELD" stands (pilot reserve + controller holds) with an expiry.
-- MySQL version

CREATE TABLE IF NOT EXISTS ids_ramp_holds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  icao VARCHAR(8) NOT NULL,
  stand_id VARCHAR(64) NOT NULL,
  -- Human label for display (e.g., C27 / A56). Optional but preferred.
  stand_ref VARCHAR(16) NULL,
  note VARCHAR(128) NULL,
  created_by_cid INT NULL,
  created_by_mode VARCHAR(16) NULL,
  -- Enforce: pilots can only have ONE active hold per airport.
  -- Unique indexes allow multiple NULLs, so this won't affect controller holds.
  pilot_cid INT GENERATED ALWAYS AS (
    CASE WHEN created_by_mode = 'pilot' THEN created_by_cid ELSE NULL END
  ) STORED,
  created_at_ms BIGINT NOT NULL,
  expires_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  UNIQUE KEY ids_ramp_holds_icao_stand_uq (icao, stand_id),
  UNIQUE KEY ids_ramp_holds_pilot_uq (icao, pilot_cid)
) ENGINE=InnoDB;

-- Index used for cleanup / filtering active holds.
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_ramp_holds'
    AND INDEX_NAME = 'ids_ramp_holds_expires_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX ids_ramp_holds_expires_idx ON ids_ramp_holds (expires_at_ms)',
  'SELECT "ids_ramp_holds.ids_ramp_holds_expires_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

-- Optional helper index for airport-scoped queries.
SET @idx_exists2 := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_ramp_holds'
    AND INDEX_NAME = 'ids_ramp_holds_icao_idx'
);

SET @stmt2 := IF(
  @idx_exists2 = 0,
  'CREATE INDEX ids_ramp_holds_icao_idx ON ids_ramp_holds (icao)',
  'SELECT "ids_ramp_holds.ids_ramp_holds_icao_idx already exists" AS message;'
);

PREPARE s2 FROM @stmt2;
EXECUTE s2;
DEALLOCATE PREPARE s2;
