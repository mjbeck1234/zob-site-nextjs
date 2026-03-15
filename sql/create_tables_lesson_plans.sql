-- Lesson plans used by mentors during training.
-- MySQL version

CREATE TABLE IF NOT EXISTS lesson_plans (
  id BIGINT NOT NULL AUTO_INCREMENT,
  type VARCHAR(16) NOT NULL,
  title VARCHAR(255) NOT NULL,
  workload TEXT NULL,

  default_session_type VARCHAR(32) NOT NULL DEFAULT 'on_the_job',
  scenario_summary TEXT NULL,

  overview_md MEDIUMTEXT NULL,
  objectives_md MEDIUMTEXT NULL,
  clearances_md MEDIUMTEXT NULL,
  comms_md MEDIUMTEXT NULL,
  sep_md MEDIUMTEXT NULL,
  coord_md MEDIUMTEXT NULL,
  mnp_md MEDIUMTEXT NULL,
  notes_md MEDIUMTEXT NULL,
  sweatbox_md MEDIUMTEXT NULL,

  published TINYINT(1) NOT NULL DEFAULT 1,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY lesson_plans_type_idx (type),
  KEY lesson_plans_published_idx (published)
) ENGINE=InnoDB;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND COLUMN_NAME = 'lesson_plan_id'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE training_tickets ADD COLUMN lesson_plan_id BIGINT NULL;',
  'SELECT "training_tickets.lesson_plan_id already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND CONSTRAINT_NAME = 'fk_training_tickets_lesson_plan'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @stmt := IF(
  @fk_exists = 0,
  'ALTER TABLE training_tickets ADD CONSTRAINT fk_training_tickets_lesson_plan FOREIGN KEY (lesson_plan_id) REFERENCES lesson_plans(id) ON DELETE SET NULL',
  'SELECT "training_tickets.fk_training_tickets_lesson_plan already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'training_tickets'
    AND INDEX_NAME = 'training_tickets_lesson_plan_id_idx'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX training_tickets_lesson_plan_id_idx ON training_tickets (lesson_plan_id)',
  'SELECT "training_tickets.training_tickets_lesson_plan_id_idx already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
