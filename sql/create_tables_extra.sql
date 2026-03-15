-- Optional tables used by the Next.js app.
-- MySQL version (idempotent where practical)

-- 1) Role overrides (extra roles not derived from roster)
CREATE TABLE IF NOT EXISTS user_roles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  cid BIGINT NOT NULL,
  role VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_roles_cid (cid),
  UNIQUE KEY uq_user_roles_cid_role (cid, role)
) ENGINE=InnoDB;

-- 1b) VATUSA facility role sync (authoritative staff role source)
CREATE TABLE IF NOT EXISTS vatusa_facility_roles (
  facility VARCHAR(16) NOT NULL,
  cid BIGINT NOT NULL,
  role VARCHAR(64) NOT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (facility, cid, role),
  KEY idx_vatusa_facility_roles_cid (cid)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vatusa_facility_sync (
  facility VARCHAR(16) PRIMARY KEY,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 1c) VATUSA roster cache (home/visiting membership)
CREATE TABLE IF NOT EXISTS vatusa_roster_members (
  facility VARCHAR(16) NOT NULL,
  cid BIGINT NOT NULL,
  member_type VARCHAR(16) NOT NULL, -- 'home' | 'visiting'
  first_name VARCHAR(80) NULL,
  last_name  VARCHAR(80) NULL,
  rating     VARCHAR(16) NULL,
  status     VARCHAR(32) NULL,
  join_date  DATE NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (facility, cid),
  KEY idx_vatusa_roster_members_type (facility, member_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vatusa_roster_sync (
  facility VARCHAR(16) PRIMARY KEY,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2) User profiles (bio + avatar)
CREATE TABLE IF NOT EXISTS user_profiles (
  cid BIGINT PRIMARY KEY,
  bio TEXT NULL,
  avatar_url TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3) LOA requests
CREATE TABLE IF NOT EXISTS loa_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  controller_cid BIGINT NOT NULL,
  controller_name VARCHAR(120) NULL,
  controller_email VARCHAR(200) NULL,
  estimated_date DATE NULL,
  reason TEXT NULL,
  approved TINYINT(1) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_loa_requests_cid (controller_cid)
) ENGINE=InnoDB;

-- If an older install used NOT NULL DEFAULT 0, make it tri-state
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'loa_requests'
    AND COLUMN_NAME = 'approved'
);

SET @stmt := IF(
  @col_exists = 1,
  'ALTER TABLE loa_requests MODIFY COLUMN approved TINYINT(1) NULL;',
  'SELECT "loa_requests.approved does not exist" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;



-- 4) Roster admin notes + membership overrides (optional)
CREATE TABLE IF NOT EXISTS roster_overrides (
  cid BIGINT PRIMARY KEY,
  member_status_override VARCHAR(16) NOT NULL DEFAULT 'auto',
  member_type_override   VARCHAR(16) NOT NULL DEFAULT 'auto',
  notes TEXT NULL,
  pref_name_override VARCHAR(120) NULL,
  s1_override VARCHAR(16) NOT NULL DEFAULT 'auto',
  s2_override VARCHAR(16) NOT NULL DEFAULT 'auto',
  s3_override VARCHAR(16) NOT NULL DEFAULT 'auto',
  c1_override VARCHAR(16) NOT NULL DEFAULT 'auto',
  active_override VARCHAR(16) NOT NULL DEFAULT 'auto',
  able_event_signups_override VARCHAR(16) NOT NULL DEFAULT 'auto',
  able_training_sessions_override VARCHAR(16) NOT NULL DEFAULT 'auto',
  operating_initials_override VARCHAR(16) NULL,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_roster_overrides_updated_at (updated_at)
) ENGINE=InnoDB;

-- Safely add missing columns if roster_overrides existed earlier

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 'pref_name_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN pref_name_override VARCHAR(120) NULL;',
  'SELECT "roster_overrides.pref_name_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 's1_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN s1_override VARCHAR(16) NOT NULL DEFAULT ''auto'';',
  'SELECT "roster_overrides.s1_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 's2_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN s2_override VARCHAR(16) NOT NULL DEFAULT ''auto'';',
  'SELECT "roster_overrides.s2_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 's3_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN s3_override VARCHAR(16) NOT NULL DEFAULT ''auto'';',
  'SELECT "roster_overrides.s3_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 'c1_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN c1_override VARCHAR(16) NOT NULL DEFAULT ''auto'';',
  'SELECT "roster_overrides.c1_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 'active_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN active_override VARCHAR(16) NOT NULL DEFAULT ''auto'';',
  'SELECT "roster_overrides.active_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 'able_event_signups_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN able_event_signups_override VARCHAR(16) NOT NULL DEFAULT ''auto'';',
  'SELECT "roster_overrides.able_event_signups_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 'able_training_sessions_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN able_training_sessions_override VARCHAR(16) NOT NULL DEFAULT ''auto'';',
  'SELECT "roster_overrides.able_training_sessions_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roster_overrides'
    AND COLUMN_NAME = 'operating_initials_override'
);

SET @stmt := IF(
  @col_exists = 0,
  'ALTER TABLE roster_overrides ADD COLUMN operating_initials_override VARCHAR(16) NULL;',
  'SELECT "roster_overrides.operating_initials_override already exists" AS message;'
);

PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
