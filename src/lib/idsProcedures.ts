import 'server-only';

import { sql } from '@/lib/db';

export type ProcType = 'SID' | 'STAR';

export type ProcedureRow = {
  proc: string;
  proc_type: ProcType;
  proc_name: string;
  transition: string | null;
};

export type ProcedureFixPoint = {
  fix: string;
  lat: number | null;
  lon: number | null;
};

export type ProcedureAirportRow = ProcedureRow & {
  airport: string;
};

export async function ensureIdsProceduresTables(): Promise<void> {
  // NOTE: keep in sync with sql/create_table_ids_procedures.sql
  await sql`
    CREATE TABLE IF NOT EXISTS ids_procedures (
      proc VARCHAR(64) PRIMARY KEY,
      proc_type VARCHAR(8) NOT NULL,
      proc_name VARCHAR(32) NOT NULL,
      transition VARCHAR(32)
    );
  `;
  try { await sql`CREATE INDEX ids_procedures_proc_name_idx ON ids_procedures (proc_name);`; } catch {}
  try { await sql`CREATE INDEX ids_procedures_proc_type_idx ON ids_procedures (proc_type);`; } catch {}

  await sql`
    CREATE TABLE IF NOT EXISTS ids_procedure_fixes (
      proc VARCHAR(64) NOT NULL,
      ord INT NOT NULL,
      fix VARCHAR(16) NOT NULL,
      lat DOUBLE NULL,
      lon DOUBLE NULL,
      PRIMARY KEY (proc, ord)
    );
  `;
  // Best-effort schema drift support for older installs imported before lat/lon were stored.
  try { await sql`ALTER TABLE ids_procedure_fixes ADD COLUMN lat DOUBLE NULL`; } catch {}
  try { await sql`ALTER TABLE ids_procedure_fixes ADD COLUMN lon DOUBLE NULL`; } catch {}
  try { await sql`CREATE INDEX ids_procedure_fixes_proc_idx ON ids_procedure_fixes (proc);`; } catch {}
  try { await sql`CREATE INDEX ids_procedure_fixes_fix_idx ON ids_procedure_fixes (fix);`; } catch {}

  await sql`
    CREATE TABLE IF NOT EXISTS ids_procedure_airports (
      proc VARCHAR(64) NOT NULL,
      airport VARCHAR(8) NOT NULL,
      PRIMARY KEY (proc, airport)
    );
  `;
  try { await sql`CREATE INDEX ids_procedure_airports_proc_idx ON ids_procedure_airports (proc);`; } catch {}
  try { await sql`CREATE INDEX ids_procedure_airports_airport_idx ON ids_procedure_airports (airport);`; } catch {}
}

export async function resetIdsProcedures(): Promise<void> {
  await ensureIdsProceduresTables();
  await sql`TRUNCATE TABLE ids_procedure_fixes;`;
  await sql`TRUNCATE TABLE ids_procedure_airports;`;
  await sql`TRUNCATE TABLE ids_procedures;`;
}

export async function insertProcedures(rows: ProcedureRow[]): Promise<void> {
  if (!rows.length) return;
  await ensureIdsProceduresTables();
  await sql`
    INSERT IGNORE INTO ids_procedures ${sql(rows, 'proc', 'proc_type', 'proc_name', 'transition')};
  `;
}

export async function insertProcedureFixes(rows: Array<{ proc: string; ord: number; fix: string; lat?: number | null; lon?: number | null }>): Promise<void> {
  if (!rows.length) return;
  await ensureIdsProceduresTables();
  await sql`
    INSERT IGNORE INTO ids_procedure_fixes ${sql(rows, 'proc', 'ord', 'fix', 'lat', 'lon')};
  `;
}

export async function insertProcedureAirports(rows: Array<{ proc: string; airport: string }>): Promise<void> {
  if (!rows.length) return;
  await ensureIdsProceduresTables();
  await sql`
    INSERT IGNORE INTO ids_procedure_airports ${sql(rows, 'proc', 'airport')};
  `;
}

export async function findProceduresByName(procName: string, procType?: ProcType): Promise<ProcedureRow[]> {
  await ensureIdsProceduresTables();
  const name = String(procName).toUpperCase();
  if (procType) {
    return await sql<ProcedureRow[]>`
      SELECT proc, proc_type, proc_name, transition
      FROM ids_procedures
      WHERE proc_name = ${name} AND proc_type = ${procType}
      ORDER BY proc ASC;
    `;
  }
  return await sql<ProcedureRow[]>`
    SELECT proc, proc_type, proc_name, transition
    FROM ids_procedures
    WHERE proc_name = ${name}
    ORDER BY proc_type DESC, proc ASC;
  `;
}

export async function getProcedureFixes(proc: string): Promise<ProcedureFixPoint[]> {
  await ensureIdsProceduresTables();
  const p = String(proc).toUpperCase();
  const rows = await sql<Array<{ fix: string; lat: number | null; lon: number | null }>>`
    SELECT fix, lat, lon
    FROM ids_procedure_fixes
    WHERE proc = ${p}
    ORDER BY ord ASC;
  `;
  return rows.map((r) => ({
    fix: String(r.fix).toUpperCase(),
    lat: r.lat == null ? null : Number(r.lat),
    lon: r.lon == null ? null : Number(r.lon),
  }));
}


export async function findProceduresByAirport(airport: string, procType?: ProcType): Promise<ProcedureAirportRow[]> {
  await ensureIdsProceduresTables();
  const a = String(airport ?? '').trim().toUpperCase();
  if (!a) return [];

  if (procType) {
    return await sql<ProcedureAirportRow[]>`
      SELECT p.proc, p.proc_type, p.proc_name, p.transition, a.airport
      FROM ids_procedure_airports a
      INNER JOIN ids_procedures p ON p.proc = a.proc
      WHERE a.airport = ${a} AND p.proc_type = ${procType}
      ORDER BY p.proc_name ASC, p.transition ASC, p.proc ASC;
    `;
  }

  return await sql<ProcedureAirportRow[]>`
    SELECT p.proc, p.proc_type, p.proc_name, p.transition, a.airport
    FROM ids_procedure_airports a
    INNER JOIN ids_procedures p ON p.proc = a.proc
    WHERE a.airport = ${a}
    ORDER BY p.proc_type ASC, p.proc_name ASC, p.transition ASC, p.proc ASC;
  `;
}

export async function getProcedureAirports(proc: string): Promise<string[]> {
  await ensureIdsProceduresTables();
  const p = String(proc).toUpperCase();
  const rows = await sql<Array<{ airport: string }>>`
    SELECT airport
    FROM ids_procedure_airports
    WHERE proc = ${p}
    ORDER BY airport ASC;
  `;
  return rows.map((r) => String(r.airport).toUpperCase());
}

export async function getProceduresCounts(): Promise<{ sid: number; star: number }> {
  await ensureIdsProceduresTables();
  const rows = await sql<Array<{ proc_type: string; n: number }>>`
    SELECT proc_type, COUNT(*) AS n
    FROM ids_procedures
    GROUP BY proc_type;
  `;
  const out = { sid: 0, star: 0 };
  for (const r of rows) {
    if (r.proc_type === 'SID') out.sid = Number(r.n);
    if (r.proc_type === 'STAR') out.star = Number(r.n);
  }
  return out;
}
