-- Mentor-fillable student training syllabus / checklist
-- MySQL version

CREATE TABLE IF NOT EXISTS training_syllabus (
  student_cid BIGINT NOT NULL,
  data_json MEDIUMTEXT NOT NULL,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_cid),
  KEY idx_training_syllabus_updated_at (updated_at),
  KEY idx_training_syllabus_updated_by (updated_by)
) ENGINE=InnoDB;
