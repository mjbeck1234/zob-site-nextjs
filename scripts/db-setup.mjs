#!/usr/bin/env node
import 'dotenv/config';
import mysql from 'mysql2/promise';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Set it in your shell or in .env`);
    process.exit(1);
  }
  return v;
}

function parseDb(urlStr) {
  const u = new URL(urlStr);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, ''),
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  };
}

const argv = process.argv.slice(2);
const applySchemaFixes = argv.includes('--apply-ui-fixes');

const DATABASE_URL = requireEnv('DATABASE_URL');
const cfg = parseDb(DATABASE_URL);

const conn = await mysql.createConnection({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  timezone: 'Z',
  dateStrings: true,
  ssl: cfg.ssl,
});

async function exec(sql, params = []) {
  try {
    await conn.execute(sql, params);
  } catch (err) {
    // Make index creation idempotent-ish
    if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(sql) && (err?.errno === 1061 || err?.code === 'ER_DUP_KEYNAME')) {
      return;
    }
    throw err;
  }
}

async function tableExists(name) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [name]
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function columnExists(table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

console.log(`DB setup for ${cfg.database} @ ${cfg.host}:${cfg.port}`);
console.log(`Stored fixes: ${applySchemaFixes ? 'ON' : 'OFF'}`);

await exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(190) NOT NULL PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;
`);

async function applied(name) {
  const [rows] = await conn.execute(`SELECT name FROM schema_migrations WHERE name = ? LIMIT 1`, [name]);
  return rows.length > 0;
}

async function mark(name) {
  await exec(`INSERT INTO schema_migrations (name) VALUES (?)`, [name]);
}

async function runMigration(name, fn) {
  if (await applied(name)) return;
  console.log(`- applying ${name}`);
  await fn();
  await mark(name);
}

/**
 * Migrations below are conservative: they only CREATE missing tables/indexes and add a couple
 * of compatibility constraints (optional existing fixes).
 */

await runMigration('010_ids_tables', async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS ids_datasets (
      dataset VARCHAR(16) NOT NULL PRIMARY KEY,
      cycle VARCHAR(16) NOT NULL,
      data JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
  await exec(`CREATE INDEX ids_datasets_cycle_idx ON ids_datasets (cycle)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS ids_procedures (
      proc VARCHAR(64) NOT NULL PRIMARY KEY,
      proc_type VARCHAR(8) NOT NULL,
      proc_name VARCHAR(32) NOT NULL,
      transition VARCHAR(32) NULL
    ) ENGINE=InnoDB;
  `);
  await exec(`CREATE INDEX ids_procedures_type_idx ON ids_procedures (proc_type)`);
  await exec(`CREATE INDEX ids_procedures_name_idx ON ids_procedures (proc_name)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS ids_procedure_fixes (
      proc VARCHAR(64) NOT NULL,
      ord INT NOT NULL,
      fix VARCHAR(16) NOT NULL,
      PRIMARY KEY (proc, ord),
      KEY ids_procedure_fixes_fix_idx (fix)
    ) ENGINE=InnoDB;
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS ids_procedure_airports (
      proc VARCHAR(64) NOT NULL,
      airport VARCHAR(16) NOT NULL,
      PRIMARY KEY (proc, airport),
      KEY ids_procedure_airports_airport_idx (airport)
    ) ENGINE=InnoDB;
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS ids_fixes (
      fix_id VARCHAR(16) NOT NULL PRIMARY KEY,
      lat DOUBLE NOT NULL,
      lon DOUBLE NOT NULL
    ) ENGINE=InnoDB;
  `);
  await exec(`CREATE INDEX ids_fixes_latlon_idx ON ids_fixes (lat, lon)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS ids_nav (
      nav_id VARCHAR(16) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NULL,
      lat DOUBLE NOT NULL,
      lon DOUBLE NOT NULL
    ) ENGINE=InnoDB;
  `);
  await exec(`CREATE INDEX ids_nav_latlon_idx ON ids_nav (lat, lon)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS ids_airports (
      arpt_id VARCHAR(16) NOT NULL PRIMARY KEY,
      lat DOUBLE NOT NULL,
      lon DOUBLE NOT NULL
    ) ENGINE=InnoDB;
  `);
  await exec(`CREATE INDEX ids_airports_latlon_idx ON ids_airports (lat, lon)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS ids_airways (
      awy_id VARCHAR(16) NOT NULL PRIMARY KEY,
      airway_string TEXT NOT NULL
    ) ENGINE=InnoDB;
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS ids_pfr_routes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      origin VARCHAR(16) NOT NULL,
      dest VARCHAR(16) NOT NULL,
      route_string TEXT NOT NULL,
      route_type VARCHAR(32) NULL,
      area VARCHAR(32) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY ids_pfr_routes_odr_unq (origin, dest, route_string(255)),
      KEY ids_pfr_routes_od_idx (origin, dest)
    ) ENGINE=InnoDB;
  `);
});

await runMigration('020_flight_data_practice', async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS flight_data_practice_completions (
      cid VARCHAR(16) NOT NULL,
      case_id VARCHAR(64) NOT NULL,
      completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (cid, case_id)
    ) ENGINE=InnoDB;
  `);
});

await runMigration('030_user_profiles_and_roles', async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      cid VARCHAR(16) NOT NULL PRIMARY KEY,
      bio TEXT NULL,
      home_airport VARCHAR(16) NULL,
      favorite_positions TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS roster_overrides (
      cid VARCHAR(16) NOT NULL PRIMARY KEY,
      pref_name_override VARCHAR(255) NULL,
      cid_name_override VARCHAR(255) NULL,
      rating_override INT NULL,
      vis_override TINYINT(1) NULL,
      staff_role_override INT NULL,
      s1_override TINYINT(1) NULL,
      s2_override TINYINT(1) NULL,
      s3_override TINYINT(1) NULL,
      c1_override TINYINT(1) NULL,
      i1_override TINYINT(1) NULL,
      active_override TINYINT(1) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by VARCHAR(16) NULL
    ) ENGINE=InnoDB;
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      cid VARCHAR(16) NOT NULL,
      role INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (cid, role)
    ) ENGINE=InnoDB;
  `);
});

await runMigration('040_vatusa_tables', async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS vatusa_facility_roles (
      facility VARCHAR(16) NOT NULL,
      cid VARCHAR(16) NOT NULL,
      role INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (facility, cid, role)
    ) ENGINE=InnoDB;
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS vatusa_facility_data (
      facility VARCHAR(16) NOT NULL PRIMARY KEY,
      data JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS vatusa_roster_cache (
      facility VARCHAR(16) NOT NULL PRIMARY KEY,
      data JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
});


await runMigration('050_exam_attempts', async () => {
  // These tables back the Next.js exam UI without conflicting with existing `exams` / `exam_questions`.
  await exec(`
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      exam_id INT NOT NULL,
      student_cid BIGINT NOT NULL,
      student_name VARCHAR(128) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
      result VARCHAR(16) NULL,
      locked TINYINT(1) NOT NULL DEFAULT 0,
      question_order JSON NULL,
      choice_order JSON NULL,
      earned_points INT NOT NULL DEFAULT 0,
      total_points INT NOT NULL DEFAULT 0,
      score_percent DECIMAL(5,2) NULL,
      submitted_at DATETIME NULL,
      reviewed_at DATETIME NULL,
      reset_by_cid BIGINT NULL,
      reset_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX exam_attempts_exam_id_idx (exam_id),
      INDEX exam_attempts_student_cid_idx (student_cid),
      INDEX exam_attempts_status_idx (status)
    ) ENGINE=InnoDB;
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS exam_answers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      attempt_id BIGINT UNSIGNED NOT NULL,
      question_id INT NOT NULL,
      selected_choice_id BIGINT NULL,
      written_text LONGTEXT NULL,
      points_awarded INT NULL,
      mentor_comment LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY exam_answers_attempt_question_unq (attempt_id, question_id),
      INDEX exam_answers_attempt_idx (attempt_id),
      INDEX exam_answers_question_idx (question_id)
    ) ENGINE=InnoDB;
  `);
});

await runMigration('090_optional_schema_fixes', async () => {
  if (!applySchemaFixes) return;

  // Ensure roster.cid is unique so ON DUPLICATE KEY upserts can work by CID.
  if (await tableExists('roster')) {
    const hasIndex = await indexExists('roster', 'roster_cid_unq');
    if (!hasIndex) {
      console.log('  - adding UNIQUE index roster_cid_unq on roster(cid)');
      await exec(`CREATE UNIQUE INDEX roster_cid_unq ON roster (cid)`);
    }
  }

  // Ensure event_positions uniqueness if the table exists.
  if (await tableExists('event_positions')) {
    const hasIndex = await indexExists('event_positions', 'event_positions_unq');
    if (!hasIndex) {
      console.log('  - adding UNIQUE index event_positions_unq on event_positions(event_id, position_name)');
      await exec(`CREATE UNIQUE INDEX event_positions_unq ON event_positions (event_id, position_name)`);
    }
  }
});

await runMigration('095_events_max_shifts_per_user', async () => {
  if (!(await tableExists('events'))) return;
  if (!(await columnExists('events', 'max_shifts_per_user'))) {
    console.log('  - adding events.max_shifts_per_user');
    await exec(`ALTER TABLE events ADD COLUMN max_shifts_per_user INT NOT NULL DEFAULT 1`);
  }
});

console.log('Done.');
await conn.end();
