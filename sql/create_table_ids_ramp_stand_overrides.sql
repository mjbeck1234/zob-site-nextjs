-- Manual ramp stand overrides.
--
-- Use this table to:
--  - ADD custom stands that are missing from OSM/Overpass
--  - HIDE specific OSM stands by stand_id
--
-- Notes:
--  - For ADD rows, set stand_id to something like "manual:<uuid>".
--  - For HIDE rows, set stand_id to the exact stand id returned by the ramp API (e.g. "node:123", "way:456").

CREATE TABLE IF NOT EXISTS ids_ramp_stand_overrides (
  id BIGINT NOT NULL AUTO_INCREMENT,
  icao VARCHAR(8) NOT NULL,
  type ENUM('add','hide') NOT NULL,
  stand_id VARCHAR(64) NOT NULL,
  stand_ref VARCHAR(32) NULL,
  lat DOUBLE NULL,
  lon DOUBLE NULL,
  name VARCHAR(128) NULL,
  airline VARCHAR(64) NULL,
  area_id VARCHAR(32) NULL,
  active TINYINT NOT NULL DEFAULT 1,
  created_by_cid INT NULL,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_override (icao, type, stand_id)
);
