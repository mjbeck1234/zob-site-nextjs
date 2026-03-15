-- Fix schema for IDS Ramp Holds: ensure *_at_ms columns are BIGINT so epoch milliseconds fit.
-- Run this if your table was created with INT columns (rows will overflow and be deleted immediately).

ALTER TABLE ids_ramp_holds
  MODIFY created_at_ms BIGINT NOT NULL,
  MODIFY expires_at_ms BIGINT NOT NULL,
  MODIFY updated_at_ms BIGINT NOT NULL;
