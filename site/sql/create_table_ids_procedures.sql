-- IDS procedure index imported from FAA NASR STARDP.txt
-- Stored in normalized tables to avoid loading huge SID/STAR blobs into Node memory.
-- MySQL version

CREATE TABLE IF NOT EXISTS ids_procedures (
  proc       VARCHAR(128) PRIMARY KEY,   -- e.g. PUCKY.PUCKY1
  proc_type  VARCHAR(16)  NOT NULL,      -- 'SID' or 'STAR'
  proc_name  VARCHAR(64)  NOT NULL,      -- e.g. PUCKY1
  transition VARCHAR(64)  NULL
) ENGINE=InnoDB;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_procedures'
    AND INDEX_NAME = 'ids_procedures_proc_name_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX ids_procedures_proc_name_idx ON ids_procedures (proc_name)',
  'SELECT "ids_procedures.ids_procedures_proc_name_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_procedures'
    AND INDEX_NAME = 'ids_procedures_proc_type_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX ids_procedures_proc_type_idx ON ids_procedures (proc_type)',
  'SELECT "ids_procedures.ids_procedures_proc_type_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;


-- Fix sequence for a specific procedure (simple ordinal order as seen in file)
CREATE TABLE IF NOT EXISTS ids_procedure_fixes (
  proc VARCHAR(128) NOT NULL,
  ord  INT NOT NULL,
  fix  VARCHAR(32) NOT NULL,
  lat  DOUBLE NULL,
  lon  DOUBLE NULL,
  PRIMARY KEY (proc, ord)
) ENGINE=InnoDB;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_procedure_fixes'
    AND INDEX_NAME = 'ids_procedure_fixes_proc_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX ids_procedure_fixes_proc_idx ON ids_procedure_fixes (proc)',
  'SELECT "ids_procedure_fixes.ids_procedure_fixes_proc_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_procedure_fixes'
    AND INDEX_NAME = 'ids_procedure_fixes_fix_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX ids_procedure_fixes_fix_idx ON ids_procedure_fixes (fix)',
  'SELECT "ids_procedure_fixes.ids_procedure_fixes_fix_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;


-- Airports served by a procedure (from AA records)
CREATE TABLE IF NOT EXISTS ids_procedure_airports (
  proc    VARCHAR(128) NOT NULL,
  airport VARCHAR(8)   NOT NULL,
  PRIMARY KEY (proc, airport)
) ENGINE=InnoDB;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_procedure_airports'
    AND INDEX_NAME = 'ids_procedure_airports_proc_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX ids_procedure_airports_proc_idx ON ids_procedure_airports (proc)',
  'SELECT "ids_procedure_airports.ids_procedure_airports_proc_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_procedure_airports'
    AND INDEX_NAME = 'ids_procedure_airports_airport_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX ids_procedure_airports_airport_idx ON ids_procedure_airports (airport)',
  'SELECT "ids_procedure_airports.ids_procedure_airports_airport_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
