-- Stored syllabus tables (from the old PHP site)
-- These power the IC/BKA/IKA/EKA grid syllabus used by mentors & students.

CREATE TABLE IF NOT EXISTS syllabi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rating VARCHAR(16) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_syllabi_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS syllabi_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  syllabi_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sections_syllabi_id (syllabi_id),
  CONSTRAINT fk_syllabi_sections_syllabi
    FOREIGN KEY (syllabi_id) REFERENCES syllabi(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS syllabi_content (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  content VARCHAR(255) NOT NULL,
  fields TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_content_section_id (section_id),
  CONSTRAINT fk_syllabi_content_section
    FOREIGN KEY (section_id) REFERENCES syllabi_sections(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS syllabi_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  controller_cid BIGINT NOT NULL,
  observer_cid BIGINT,
  progress TINYINT NOT NULL DEFAULT 0,
  content_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_entries_controller (controller_cid),
  INDEX idx_entries_content (content_id),
  INDEX idx_entries_observer (observer_cid),
  CONSTRAINT fk_syllabi_entries_content
    FOREIGN KEY (content_id) REFERENCES syllabi_content(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
