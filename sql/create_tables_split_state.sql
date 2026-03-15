-- Split active selection + presets (server-side)
-- MySQL version

CREATE TABLE IF NOT EXISTS split_active (
  id INT PRIMARY KEY DEFAULT 1,
  mode VARCHAR(16) NOT NULL DEFAULT 'live',
  preset_id INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO split_active (id, mode, preset_id)
VALUES (1, 'live', NULL);

CREATE TABLE IF NOT EXISTS split_presets (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  rows_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'split_presets'
    AND INDEX_NAME = 'split_presets_created_at_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX split_presets_created_at_idx ON split_presets (created_at)',
  'SELECT "split_presets.split_presets_created_at_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
