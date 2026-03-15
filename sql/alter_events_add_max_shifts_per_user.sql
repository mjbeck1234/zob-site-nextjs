-- Adds per-event limit on how many assigned shifts a controller may hold.
-- Safe to run multiple times.

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'events'
    AND COLUMN_NAME = 'max_shifts_per_user'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE events ADD COLUMN max_shifts_per_user INT NOT NULL DEFAULT 1;',
  'SELECT "events.max_shifts_per_user already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
