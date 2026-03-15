-- Adds rubric + additional fields to training_tickets.
-- MySQL-safe / idempotent

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND COLUMN_NAME = 'no_show'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE training_tickets ADD COLUMN no_show TINYINT(1) NOT NULL DEFAULT 0;',
  'SELECT "training_tickets.no_show already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND COLUMN_NAME = 'scenario_summary'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE training_tickets ADD COLUMN scenario_summary TEXT NULL;',
  'SELECT "training_tickets.scenario_summary already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND COLUMN_NAME = 'notes_student'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE training_tickets ADD COLUMN notes_student TEXT NULL;',
  'SELECT "training_tickets.notes_student already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND COLUMN_NAME = 'notes_future'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE training_tickets ADD COLUMN notes_future TEXT NULL;',
  'SELECT "training_tickets.notes_future already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND COLUMN_NAME = 'rubric_ratings'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE training_tickets ADD COLUMN rubric_ratings JSON NOT NULL DEFAULT (JSON_OBJECT());',
  'SELECT "training_tickets.rubric_ratings already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND COLUMN_NAME = 'rubric_checks'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE training_tickets ADD COLUMN rubric_checks JSON NOT NULL DEFAULT (JSON_OBJECT());',
  'SELECT "training_tickets.rubric_checks already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND COLUMN_NAME = 'updated_at'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE training_tickets ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
  'SELECT "training_tickets.updated_at already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
