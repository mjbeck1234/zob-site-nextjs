-- Adds sweatbox_md field for lesson plan sweatbox files / resources
-- MySQL-safe / idempotent

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lesson_plans'
    AND COLUMN_NAME = 'sweatbox_md'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE lesson_plans ADD COLUMN sweatbox_md TEXT NULL;',
  'SELECT "lesson_plans.sweatbox_md already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
