-- Feedback (pilot -> controller) moderation
-- MySQL version

CREATE TABLE IF NOT EXISTS feedback (
  id BIGINT NOT NULL AUTO_INCREMENT,

  controller_cid BIGINT NULL,
  controller_name VARCHAR(120) NULL,
  controller_email VARCHAR(200) NULL,
  pos_category VARCHAR(3) NULL,
  service_level VARCHAR(60) NULL,

  pilot_cid BIGINT NULL,
  pilot_name VARCHAR(120) NULL,
  pilot_email VARCHAR(200) NULL,

  comments TEXT NULL,

  approved TINYINT(1) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Ensure the moderation column supports Pending state.
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'feedback'
    AND COLUMN_NAME = 'approved'
);

SET @stmt := IF(
  @col_exists = 1,
  'ALTER TABLE feedback MODIFY COLUMN approved TINYINT(1) NULL;',
  'SELECT "feedback.approved does not exist" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'feedback'
    AND INDEX_NAME = 'idx_feedback_controller_approved_created'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_feedback_controller_approved_created ON feedback (controller_cid, approved, created_at)',
  'SELECT "feedback.idx_feedback_controller_approved_created already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
