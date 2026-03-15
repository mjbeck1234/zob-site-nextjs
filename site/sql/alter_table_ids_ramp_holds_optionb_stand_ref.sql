-- Option B migration: store human stand label (stand_ref) alongside stand_id.
-- Also enforces: pilots may only have ONE active hold per airport (does not affect controller holds).
-- MySQL 8+

ALTER TABLE ids_ramp_holds
  ADD COLUMN stand_ref VARCHAR(16) NULL AFTER stand_id;

-- Generated column used to enforce pilot uniqueness without restricting controllers.
ALTER TABLE ids_ramp_holds
  ADD COLUMN pilot_cid INT GENERATED ALWAYS AS (
    CASE WHEN created_by_mode = 'pilot' THEN created_by_cid ELSE NULL END
  ) STORED;

ALTER TABLE ids_ramp_holds
  ADD UNIQUE KEY ids_ramp_holds_pilot_uq (icao, pilot_cid);
