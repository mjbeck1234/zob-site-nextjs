-- Flight Data Practice tables
-- MySQL version

CREATE TABLE IF NOT EXISTS flight_data_practice_cases (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NULL,
  callsign VARCHAR(32) NOT NULL DEFAULT 'DCM104',
  ac_type VARCHAR(16) NOT NULL DEFAULT 'B738/W',
  flight_rules VARCHAR(8) NOT NULL DEFAULT 'IFR',
  dep VARCHAR(8) NOT NULL,
  arr VARCHAR(8) NOT NULL,
  bad_cruise_alt INT NULL,
  bad_route TEXT NULL,
  bad_remarks TEXT NULL,
  good_cruise_alt INT NULL,
  good_route TEXT NULL,
  good_remarks TEXT NULL,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fdp_cases_published (published),
  KEY idx_fdp_cases_dep_arr (dep, arr)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS flight_data_practice_completions (
  cid BIGINT NOT NULL,
  case_id BIGINT NOT NULL,
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cid, case_id),
  KEY idx_fdp_completions_cid (cid),
  CONSTRAINT fk_fdp_completions_case FOREIGN KEY (case_id) REFERENCES flight_data_practice_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;
