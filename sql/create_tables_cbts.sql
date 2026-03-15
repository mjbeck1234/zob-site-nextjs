-- CBT tables for Learning Center
--
-- This is intentionally small and compatible with the app's expectations:
-- - sections: id, title, published
-- - cbts: section_id (existing: 'u' = uncategorized), title, description, url, published
-- - cbt_results: (controller_cid, cbt_id) unique

CREATE TABLE IF NOT EXISTS sections (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  published TINYINT NOT NULL DEFAULT 1,
  created_at_ms BIGINT NULL,
  updated_at_ms BIGINT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cbts (
  id INT NOT NULL AUTO_INCREMENT,
  section_id VARCHAR(8) NOT NULL DEFAULT 'u',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  url TEXT NOT NULL,
  published TINYINT NOT NULL DEFAULT 1,
  created_at_ms BIGINT NULL,
  updated_at_ms BIGINT NULL,
  PRIMARY KEY (id),
  KEY idx_cbts_section_id (section_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cbt_results (
  id INT NOT NULL AUTO_INCREMENT,
  controller_cid BIGINT NOT NULL,
  cbt_id INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_cbt_results_controller_cbt (controller_cid, cbt_id),
  KEY idx_cbt_results_controller_cid (controller_cid),
  KEY idx_cbt_results_cbt (cbt_id),
  CONSTRAINT fk_cbt_results_cbt FOREIGN KEY (cbt_id) REFERENCES cbts(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
