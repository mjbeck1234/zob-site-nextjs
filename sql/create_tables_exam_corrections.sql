-- Exam corrections (student-submitted correction requests + mentor decision)
-- MySQL version

CREATE TABLE IF NOT EXISTS exam_corrections (
  id BIGINT NOT NULL AUTO_INCREMENT,
  attempt_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,

  student_cid BIGINT NOT NULL,
  student_name VARCHAR(160),

  kind VARCHAR(32) NOT NULL DEFAULT 'grading_error',
  proposed_choice_id BIGINT,
  proposed_text TEXT,

  reasoning TEXT NOT NULL,
  proof_url TEXT,
  proof_text TEXT,

  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  mentor_cid BIGINT,
  mentor_name VARCHAR(160),
  mentor_note TEXT,
  points_awarded INT,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_corrections_attempt_question (attempt_id, question_id),
  CONSTRAINT fk_exam_corrections_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_corrections_question FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'exam_corrections'
    AND INDEX_NAME = 'idx_exam_corrections_attempt_id'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_exam_corrections_attempt_id ON exam_corrections (attempt_id)',
  'SELECT "exam_corrections.idx_exam_corrections_attempt_id already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'exam_corrections'
    AND INDEX_NAME = 'idx_exam_corrections_status'
);

SET @stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_exam_corrections_status ON exam_corrections (status)',
  'SELECT "exam_corrections.idx_exam_corrections_status already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
