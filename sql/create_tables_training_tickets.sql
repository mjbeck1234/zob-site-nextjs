-- Training tickets (session records) submitted by mentors.
-- MySQL version

CREATE TABLE IF NOT EXISTS training_tickets (
  id BIGINT NOT NULL AUTO_INCREMENT,
  student_cid BIGINT NOT NULL,
  mentor_cid BIGINT NOT NULL,
  session_type VARCHAR(32) NOT NULL,
  session_start DATETIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 0,

  no_show TINYINT(1) NOT NULL DEFAULT 0,
  scenario_summary TEXT NULL,

  notes TEXT NULL,
  notes_student TEXT NULL,
  notes_future TEXT NULL,

  rubric_ratings JSON NOT NULL DEFAULT (JSON_OBJECT()),
  rubric_checks  JSON NOT NULL DEFAULT (JSON_OBJECT()),

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY training_tickets_session_start_idx (session_start),
  KEY training_tickets_student_idx (student_cid),
  KEY training_tickets_mentor_idx (mentor_cid)
) ENGINE=InnoDB;
