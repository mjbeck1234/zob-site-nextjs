import 'server-only';

import { sql } from '@/lib/db';

export type PointRow = { id: string; lat: number; lon: number };

export type PfrRow = {
  origin: string;
  dest: string;
  route_string: string;
  route_type: string | null;
  area: string | null;
};

export async function ensureIdsCoreTables(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ids_fixes (
      fix_id VARCHAR(16) PRIMARY KEY,
      lat DOUBLE NOT NULL,
      lon DOUBLE NOT NULL
    );
  `;
  try { await sql`CREATE INDEX ids_fixes_latlon_idx ON ids_fixes (lat, lon);`; } catch {}

  await sql`
    CREATE TABLE IF NOT EXISTS ids_nav (
      nav_id VARCHAR(16) PRIMARY KEY,
      name VARCHAR(255),
      lat DOUBLE NOT NULL,
      lon DOUBLE NOT NULL
    );
  `;
  try { await sql`CREATE INDEX ids_nav_latlon_idx ON ids_nav (lat, lon);`; } catch {}

  await sql`
    CREATE TABLE IF NOT EXISTS ids_airports (
      arpt_id VARCHAR(16) PRIMARY KEY,
      lat DOUBLE NOT NULL,
      lon DOUBLE NOT NULL
    );
  `;
  try { await sql`CREATE INDEX ids_airports_latlon_idx ON ids_airports (lat, lon);`; } catch {}

  await sql`
    CREATE TABLE IF NOT EXISTS ids_airways (
      awy_id VARCHAR(16) PRIMARY KEY,
      airway_string TEXT NOT NULL
    );
  `;

  await sql`
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
    );
  `;
}

export async function resetIdsCoreTables(): Promise<void> {
  await ensureIdsCoreTables();
  // Order matters due to potential FKs in the future; keep simple for now.
  await sql`TRUNCATE TABLE ids_pfr_routes;`;
  await sql`TRUNCATE TABLE ids_airways;`;
  await sql`TRUNCATE TABLE ids_airports;`;
  await sql`TRUNCATE TABLE ids_nav;`;
  await sql`TRUNCATE TABLE ids_fixes;`;
}

export async function insertFixes(rows: Array<{ fix_id: string; lat: number; lon: number }>): Promise<void> {
  if (!rows.length) return;
  await ensureIdsCoreTables();
  await sql`
    INSERT INTO ids_fixes ${sql(rows, 'fix_id', 'lat', 'lon')}
    ON DUPLICATE KEY UPDATE lat = VALUES(lat), lon = VALUES(lon);
  `;
}

export async function insertNav(rows: Array<{ nav_id: string; name: string | null; lat: number; lon: number }>): Promise<void> {
  if (!rows.length) return;
  await ensureIdsCoreTables();
  await sql`
    INSERT INTO ids_nav ${sql(rows, 'nav_id', 'name', 'lat', 'lon')}
    ON DUPLICATE KEY UPDATE name = VALUES(name), lat = VALUES(lat), lon = VALUES(lon);
  `;
}

export async function insertAirports(rows: Array<{ arpt_id: string; lat: number; lon: number }>): Promise<void> {
  if (!rows.length) return;
  await ensureIdsCoreTables();
  await sql`
    INSERT INTO ids_airports ${sql(rows, 'arpt_id', 'lat', 'lon')}
    ON DUPLICATE KEY UPDATE lat = VALUES(lat), lon = VALUES(lon);
  `;
}

export async function insertAirways(rows: Array<{ awy_id: string; airway_string: string }>): Promise<void> {
  if (!rows.length) return;
  await ensureIdsCoreTables();
  await sql`
    INSERT INTO ids_airways ${sql(rows, 'awy_id', 'airway_string')}
    ON DUPLICATE KEY UPDATE airway_string = VALUES(airway_string);
  `;
}

export async function insertPfrRoutes(rows: PfrRow[]): Promise<void> {
  if (!rows.length) return;
  await ensureIdsCoreTables();
  await sql`
    INSERT IGNORE INTO ids_pfr_routes ${sql(rows, 'origin', 'dest', 'route_string', 'route_type', 'area')};
  `;
}

export async function getAirwayString(awy_id: string): Promise<string | null> {
  await ensureIdsCoreTables();
  const id = String(awy_id ?? '').trim().toUpperCase();
  if (!id) return null;
  const rows = await sql<Array<{ airway_string: string }>>`
    SELECT airway_string
    FROM ids_airways
    WHERE awy_id = ${id}
    LIMIT 1;
  `;
  return rows?.[0]?.airway_string ?? null;
}

export async function getPfrRoutes(origin: string, dest: string): Promise<Array<{ route_string: string; route_type: string | null }>> {
  await ensureIdsCoreTables();
  const o = String(origin ?? '').trim().toUpperCase().replace(/^K/, '');
  const d = String(dest ?? '').trim().toUpperCase().replace(/^K/, '');
  if (!o || !d) return [];
  const rows = await sql<Array<{ route_string: string; route_type: string | null }>>`
    SELECT route_string, route_type
    FROM ids_pfr_routes
    WHERE origin = ${o} AND dest = ${d}
    ORDER BY (route_type IS NULL) ASC, route_type ASC, route_string ASC
    LIMIT 200;
  `;
  return rows ?? [];
}

export async function getPointsByIds(ids: string[]): Promise<PointRow[]> {
  await ensureIdsCoreTables();
  const uniq = Array.from(
    new Set(ids.map((x) => String(x ?? '').trim().toUpperCase()).filter(Boolean))
  );
  if (!uniq.length) return [];

  // Query each table separately to keep things simple and indexed.
  const [fixes, nav, apt] = await Promise.all([
    sql<Array<{ fix_id: string; lat: number; lon: number }>>`
      SELECT fix_id, lat, lon
      FROM ids_fixes
      WHERE fix_id IN ${sql.in(uniq)};
    `,
    sql<Array<{ nav_id: string; lat: number; lon: number }>>`
      SELECT nav_id, lat, lon
      FROM ids_nav
      WHERE nav_id IN ${sql.in(uniq)};
    `,
    sql<Array<{ arpt_id: string; lat: number; lon: number }>>`
      SELECT arpt_id, lat, lon
      FROM ids_airports
      WHERE arpt_id IN ${sql.in(uniq)};
    `,
  ]);

  const out: PointRow[] = [];
  for (const r of fixes ?? []) out.push({ id: r.fix_id, lat: Number(r.lat), lon: Number(r.lon) });
  for (const r of nav ?? []) out.push({ id: r.nav_id, lat: Number(r.lat), lon: Number(r.lon) });
  for (const r of apt ?? []) out.push({ id: r.arpt_id, lat: Number(r.lat), lon: Number(r.lon) });
  return out;
}
