-- Exam engine tables (MCQ + written)
-- MySQL version

CREATE TABLE IF NOT EXISTS exams (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title TEXT NOT NULL,
  description TEXT NULL,
  pass_percent INT NOT NULL DEFAULT 80,
  published TINYINT(1) NOT NULL DEFAULT 0,
  archived  TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_questions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  exam_id BIGINT NOT NULL,
  qtype VARCHAR(16) NOT NULL DEFAULT 'mcq',
  prompt TEXT NOT NULL,
  points INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  correct_choice_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exam_questions_exam_id (exam_id),
  CONSTRAINT fk_exam_questions_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_choices (
  id BIGINT NOT NULL AUTO_INCREMENT,
  question_id BIGINT NOT NULL,
  choice_text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exam_choices_question_id (question_id),
  CONSTRAINT fk_exam_choices_question FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  exam_id BIGINT NOT NULL,
  student_cid BIGINT NOT NULL,
  student_name VARCHAR(160) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'in_progress',
  result VARCHAR(16) NULL,
  locked TINYINT(1) NOT NULL DEFAULT 0,
  question_order JSON NULL,
  choice_order JSON NULL,
  earned_points INT NOT NULL DEFAULT 0,
  total_points INT NOT NULL DEFAULT 0,
  score_percent INT NULL,
  submitted_at DATETIME NULL,
  reviewed_at DATETIME NULL,
  reset_by_cid BIGINT NULL,
  reset_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exam_attempts_exam_id (exam_id),
  KEY idx_exam_attempts_student_cid (student_cid),
  KEY idx_exam_attempts_status (status),
  KEY idx_exam_attempts_locked (locked),
  CONSTRAINT fk_exam_attempts_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_answers (
  id BIGINT NOT NULL AUTO_INCREMENT,
  attempt_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  selected_choice_id BIGINT NULL,
  written_text TEXT NULL,
  points_awarded INT NULL,
  mentor_comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_answers_attempt_question (attempt_id, question_id),
  KEY idx_exam_answers_attempt_id (attempt_id),
  CONSTRAINT fk_exam_answers_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_answers_question FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
