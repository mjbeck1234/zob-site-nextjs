-- IDS datasets imported from FAA NASR Subscription ZIP
-- Stores each dataset as a single JSON blob keyed by dataset name.
-- MySQL version

CREATE TABLE IF NOT EXISTS ids_datasets (
  dataset VARCHAR(128) PRIMARY KEY,
  cycle   VARCHAR(32) NOT NULL,
  data    JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ids_datasets'
    AND INDEX_NAME = 'ids_datasets_updated_at_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX ids_datasets_updated_at_idx ON ids_datasets (updated_at)',
  'SELECT "ids_datasets.ids_datasets_updated_at_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
