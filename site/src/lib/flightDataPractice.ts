import { sql } from '@/lib/db';
import { getTableColumns, tableExists } from '@/lib/schema';

export type FlightDataPracticeCase = {
  id: number;
  title: string | null;
  callsign: string;
  ac_type: string;
  flight_rules: string;
  dep: string;
  arr: string;
  bad_cruise_alt: number | null;
  bad_route: string | null;
  bad_remarks: string | null;
  good_cruise_alt: number | null;
  good_route: string | null;
  good_remarks: string | null;
  published: boolean;
  created_by: string | number | null;
  created_at: string;
  updated_at: string;
};

type FDPMode = 'new' | 'existing' | 'none';

export async function getFDPMode(): Promise<FDPMode> {
  // Prefer the existing `fdp` table whenever it exists.
  // Student practice already uses it cleanly, and the admin should stay on the same source.
  const hasStored = await tableExists('fdp').catch(() => false);
  if (hasStored) return 'existing';

  // Fall back to the newer cases table only when existing is not installed.
  const hasNew = await tableExists('flight_data_practice_cases').catch(() => false);
  if (hasNew) return 'new';

  return 'none';
}


function hasCol(columns: Set<string>, ...names: string[]): string | null {
  for (const name of names) {
    if (columns.has(name)) return name;
  }
  return null;
}

async function getStoredFdpColumns(): Promise<Set<string>> {
  return new Set(await getTableColumns('fdp').catch(() => []));
}

async function insertStoredFdpRow(input: {
  callsign: string;
  ac_type: string;
  flight_rules: string;
  dep: string;
  arr: string;
  good_cruise_alt?: number | null;
  good_route?: string | null;
  title?: string | null;
}): Promise<number> {
  const cols = await getStoredFdpColumns();
  const pairs: Array<[string, any]> = [];

  const callsignCol = hasCol(cols, 'callsign');
  if (callsignCol) pairs.push([callsignCol, input.callsign]);

  const aircraftCol = hasCol(cols, 'aircraft', 'ac_type');
  if (aircraftCol) pairs.push([aircraftCol, input.ac_type]);

  const depCol = hasCol(cols, 'dep', 'departure');
  if (depCol) pairs.push([depCol, input.dep]);

  const arrCol = hasCol(cols, 'arr', 'arrival');
  if (arrCol) pairs.push([arrCol, input.arr]);

  const altitudeCol = hasCol(cols, 'altitude', 'cruise_alt', 'cruise_altitude');
  if (altitudeCol) pairs.push([altitudeCol, input.good_cruise_alt ?? null]);

  const routeCol = hasCol(cols, 'route', 'good_route');
  if (routeCol) pairs.push([routeCol, input.good_route ?? null]);

  const flightRulesCol = hasCol(cols, 'flight_rules', 'rules');
  if (flightRulesCol) pairs.push([flightRulesCol, input.flight_rules]);

  const titleCol = hasCol(cols, 'title', 'name');
  if (titleCol) pairs.push([titleCol, input.title ?? null]);

  if (!pairs.length) {
    throw new Error('Stored fdp table is missing expected columns.');
  }

  const colSql = pairs.map(([col]) => `\`${col}\``).join(', ');
  const placeholderSql = pairs.map(() => '?').join(', ');
  const values = pairs.map(([, value]) => value);

  const res = await sql.unsafe<any>(`INSERT INTO \`fdp\` (${colSql}) VALUES (${placeholderSql})`, values);
  const insertId = Number((res as any)?.insertId ?? 0);
  if (!Number.isFinite(insertId) || insertId <= 0) {
    const rows = await sql<any[]>`SELECT id FROM fdp ORDER BY id DESC LIMIT 1`;
    return Number(rows?.[0]?.id ?? 0);
  }
  return insertId;
}

async function updateStoredFdpRow(id: number, patch: Partial<Omit<FlightDataPracticeCase, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const current = await getFDPCaseById(id);
  if (!current) throw new Error('Case not found');

  const next = { ...current, ...patch };
  const cols = await getStoredFdpColumns();
  const sets: string[] = [];
  const values: any[] = [];

  const callsignCol = hasCol(cols, 'callsign');
  if (callsignCol) {
    sets.push(`\`${callsignCol}\` = ?`);
    values.push(String(next.callsign ?? '').trim().toUpperCase() || 'DCM104');
  }

  const aircraftCol = hasCol(cols, 'aircraft', 'ac_type');
  if (aircraftCol) {
    sets.push(`\`${aircraftCol}\` = ?`);
    values.push(String(next.ac_type ?? '').trim().toUpperCase() || 'B738/W');
  }

  const depCol = hasCol(cols, 'dep', 'departure');
  if (depCol) {
    sets.push(`\`${depCol}\` = ?`);
    values.push(normIcao(next.dep));
  }

  const arrCol = hasCol(cols, 'arr', 'arrival');
  if (arrCol) {
    sets.push(`\`${arrCol}\` = ?`);
    values.push(normIcao(next.arr));
  }

  const altitudeCol = hasCol(cols, 'altitude', 'cruise_alt', 'cruise_altitude');
  if (altitudeCol) {
    sets.push(`\`${altitudeCol}\` = ?`);
    values.push(next.good_cruise_alt ?? null);
  }

  const routeCol = hasCol(cols, 'route', 'good_route');
  if (routeCol) {
    sets.push(`\`${routeCol}\` = ?`);
    values.push(next.good_route == null ? null : normRoute(next.good_route));
  }

  const flightRulesCol = hasCol(cols, 'flight_rules', 'rules');
  if (flightRulesCol) {
    sets.push(`\`${flightRulesCol}\` = ?`);
    values.push(String(next.flight_rules ?? '').trim().toUpperCase() || 'IFR');
  }

  const titleCol = hasCol(cols, 'title', 'name');
  if (titleCol) {
    sets.push(`\`${titleCol}\` = ?`);
    values.push(next.title ?? null);
  }

  const updatedAtCol = hasCol(cols, 'updated_at');
  if (updatedAtCol) {
    sets.push(`\`${updatedAtCol}\` = NOW()`);
  }

  if (!sets.length) {
    throw new Error('Stored fdp table is missing expected columns.');
  }

  values.push(id);
  await sql.unsafe(`UPDATE \`fdp\` SET ${sets.join(', ')} WHERE id = ?`, values);
}

function storedFdpToCase(r: any): FlightDataPracticeCase {
  const id = Number(r?.id);
  const callsign = String(r?.callsign ?? '').trim().toUpperCase() || 'DCM104';
  const ac_type = String(r?.aircraft ?? '').trim().toUpperCase() || 'B738/W';
  const dep = normIcao(r?.dep);
  const arr = normIcao(r?.arr);
  const altRaw = String(r?.altitude ?? '').trim();
  const goodAlt = altRaw && /^[0-9]+$/.test(altRaw) ? Number(altRaw) : null;
  const goodRoute = r?.route == null ? null : normRoute(r.route);

  // Create a deterministic “bad” version so the exercise still makes sense.
  const badAlt = goodAlt == null ? null : (id % 2 === 0 ? goodAlt + 1000 : Math.max(0, goodAlt - 1000));
  const badRoute = (() => {
    if (!goodRoute) return null;
    const toks = String(goodRoute).split(/\s+/g).filter(Boolean);
    if (toks.length >= 3 && id % 3 === 0) return toks.slice(0, toks.length - 1).join(' ');
    if (toks.length >= 2 && id % 5 === 0) return toks.slice(1).join(' ');
    return goodRoute;
  })();

  return {
    id: Number.isFinite(id) ? id : 0,
    title: null,
    callsign,
    ac_type,
    flight_rules: 'IFR',
    dep,
    arr,
    bad_cruise_alt: badAlt,
    bad_route: badRoute,
    bad_remarks: null,
    good_cruise_alt: goodAlt,
    good_route: goodRoute,
    good_remarks: null,
    published: true,
    created_by: null,
    created_at: String(r?.created_at ?? ''),
    updated_at: String(r?.updated_at ?? ''),
  };
}

export type FDPCheckResult = {
  ok: boolean;
  altitudeOk: boolean;
  routeOk: boolean;
  remarksOk: boolean;
};

function normIcao(s: unknown): string {
  return String(s ?? '').trim().toUpperCase();
}

function normRoute(s: unknown): string {
  // Normalize route strings for comparison/display.
  // - Uppercase
  // - Collapse whitespace
  // - Strip common punctuation around tokens
  // - Ignore DCT/DIRECT tokens
  const raw = String(s ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!raw) return '';

  // Treat most punctuation as separators to avoid false negatives
  // (e.g., "ACO..BUCKO" or "ANTHM4," etc.).
  const cleaned = raw.replace(/[^A-Z0-9\s]/g, ' ');

  const tokens = cleaned
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t !== 'DCT' && t !== 'DIRECT');

  return tokens.join(' ');
}

function normRemarks(s: unknown): string {
  // Compare remarks case-insensitively and ignore repeated whitespace.
  // We don't want people failing a scenario because they typed "/v/" vs "/V/".
  return String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function parseCruiseAlt(input: unknown): number | null {
  const raw = String(input ?? '').trim().toUpperCase().replace(/,/g, '');
  if (!raw) return null;

  // Accept FL290, F290, 290 (as FL), 29000.
  const flMatch = raw.match(/^FL?(\d{2,3})$/);
  if (flMatch) {
    const n = Number(flMatch[1]);
    if (!Number.isFinite(n)) return null;
    return n * 100;
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) return null;

  // If they entered a flight level like 290, treat as 29000.
  if (num > 0 && num < 1000) {
    return Math.round(num) * 100;
  }

  return Math.round(num);
}

export async function listFDPCases(opts?: { includeUnpublished?: boolean }): Promise<FlightDataPracticeCase[]> {
  const mode = await getFDPMode();
  if (mode === 'none') return [];

  if (mode === 'existing') {
    const rows = await sql<any[]>`
      SELECT *
      FROM fdp
      ORDER BY id ASC
    `;
    return rows.map(storedFdpToCase);
  }

  const includeUnpublished = Boolean(opts?.includeUnpublished);
  const rows = includeUnpublished
    ? await sql<FlightDataPracticeCase[]>`
        SELECT *
        FROM flight_data_practice_cases
        ORDER BY id ASC
      `
    : await sql<FlightDataPracticeCase[]>`
        SELECT *
        FROM flight_data_practice_cases
        WHERE published = TRUE
        ORDER BY id ASC
      `;
  return rows;
}

export async function getFDPCaseById(id: number): Promise<FlightDataPracticeCase | null> {
  const mode = await getFDPMode();
  if (mode === 'none') return null;

  if (mode === 'existing') {
    const rows = await sql<any[]>`
      SELECT *
      FROM fdp
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ? storedFdpToCase(rows[0]) : null;
  }

  const rows = await sql<FlightDataPracticeCase[]>`
      SELECT *
      FROM flight_data_practice_cases
      WHERE id = ${id}
      LIMIT 1
    `;
  return rows[0] ?? null;
}

export async function createFDPCase(input: {
  title?: string | null;
  callsign: string;
  ac_type: string;
  flight_rules: string;
  dep: string;
  arr: string;
  bad_cruise_alt?: number | null;
  bad_route?: string | null;
  bad_remarks?: string | null;
  good_cruise_alt?: number | null;
  good_route?: string | null;
  good_remarks?: string | null;
  published?: boolean;
  created_by?: number | null;
}): Promise<number> {
  const mode = await getFDPMode();
  if (mode === 'none') {
    throw new Error('Flight Data Practice cases table is missing.');
  }
  const dep = normIcao(input.dep);
  const arr = normIcao(input.arr);
  const callsign = String(input.callsign ?? '').trim().toUpperCase() || 'DCM104';
  const ac_type = String(input.ac_type ?? '').trim().toUpperCase() || 'B738/W';
  const flight_rules = String(input.flight_rules ?? '').trim().toUpperCase() || 'IFR';

  const bad_route = input.bad_route == null ? null : normRoute(input.bad_route);
  const good_route = input.good_route == null ? null : normRoute(input.good_route);

  if (mode === 'existing') {
    return await insertStoredFdpRow({
      title: input.title ?? null,
      callsign,
      ac_type,
      flight_rules,
      dep,
      arr,
      good_cruise_alt: input.good_cruise_alt ?? null,
      good_route,
    });
  }

  const rows = await sql<{ id: number }[]>`
    INSERT INTO flight_data_practice_cases (
      title, callsign, ac_type, flight_rules,
      dep, arr,
      bad_cruise_alt, bad_route, bad_remarks,
      good_cruise_alt, good_route, good_remarks,
      published, created_by
    ) VALUES (
      ${input.title ?? null}, ${callsign}, ${ac_type}, ${flight_rules},
      ${dep}, ${arr},
      ${input.bad_cruise_alt ?? null}, ${bad_route}, ${input.bad_remarks ?? null},
      ${input.good_cruise_alt ?? null}, ${good_route}, ${input.good_remarks ?? null},
      ${input.published ?? true}, ${input.created_by ?? null}
    )
    RETURNING id
  `;
  return rows[0]!.id;
}

export async function updateFDPCase(id: number, patch: Partial<Omit<FlightDataPracticeCase, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const mode = await getFDPMode();
  if (mode === 'none') {
    throw new Error('Flight Data Practice cases table is missing.');
  }
  if (mode === 'existing') {
    await updateStoredFdpRow(id, patch);
    return;
  }
  const current = await getFDPCaseById(id);
  if (!current) throw new Error('Case not found');

  const next = {
    ...current,
    ...patch,
  };

  const dep = normIcao(next.dep);
  const arr = normIcao(next.arr);
  const callsign = String(next.callsign ?? '').trim().toUpperCase() || 'DCM104';
  const ac_type = String(next.ac_type ?? '').trim().toUpperCase() || 'B738/W';
  const flight_rules = String(next.flight_rules ?? '').trim().toUpperCase() || 'IFR';
  const bad_route = next.bad_route == null ? null : normRoute(next.bad_route);
  const good_route = next.good_route == null ? null : normRoute(next.good_route);

  await sql`
    UPDATE flight_data_practice_cases
    SET
      title = ${next.title ?? null},
      callsign = ${callsign},
      ac_type = ${ac_type},
      flight_rules = ${flight_rules},
      dep = ${dep},
      arr = ${arr},
      bad_cruise_alt = ${next.bad_cruise_alt ?? null},
      bad_route = ${bad_route},
      bad_remarks = ${next.bad_remarks ?? null},
      good_cruise_alt = ${next.good_cruise_alt ?? null},
      good_route = ${good_route},
      good_remarks = ${next.good_remarks ?? null},
      published = ${Boolean(next.published)},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteFDPCase(id: number): Promise<void> {
  const mode = await getFDPMode();
  if (mode === 'none') {
    throw new Error('Flight Data Practice cases table is missing.');
  }

  if (mode === 'existing') {
    await sql`DELETE FROM fdp WHERE id = ${id}`;
    return;
  }

  await sql`DELETE FROM flight_data_practice_cases WHERE id = ${id}`;
}

export async function getNextFDPCaseForUser(cid: number): Promise<FlightDataPracticeCase | null> {
  const mode = await getFDPMode();
  if (mode === 'none') return null;

  if (mode === 'existing') {
    // Current mode: pick a random plan from `fdp`.
    const rows = await sql<any[]>`
      SELECT *
      FROM fdp
      ORDER BY RAND()
      LIMIT 1
    `;
    return rows[0] ? storedFdpToCase(rows[0]) : null;
  }

  const hasCompletions = await tableExists('flight_data_practice_completions').catch(() => false);
  if (!hasCompletions) {
    const rows = await sql<FlightDataPracticeCase[]>`
      SELECT *
      FROM flight_data_practice_cases
      WHERE published = TRUE
      ORDER BY id ASC
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  const rows = await sql<FlightDataPracticeCase[]>`
      SELECT c.*
      FROM flight_data_practice_cases c
      LEFT JOIN flight_data_practice_completions done
        ON done.case_id = c.id AND done.cid = ${cid}
      WHERE c.published = TRUE
        AND done.case_id IS NULL
      ORDER BY c.id ASC
      LIMIT 1
    `;

  // If they've completed all cases, restart at the first published one.
  if (!rows[0]) {
    const all = await sql<FlightDataPracticeCase[]>`
        SELECT *
        FROM flight_data_practice_cases
        WHERE published = TRUE
        ORDER BY id ASC
        LIMIT 1
      `;
    return all[0] ?? null;
  }

  return rows[0] ?? null;
}

export async function markFDPComplete(cid: number, caseId: number): Promise<void> {
  const hasCompletions = await tableExists('flight_data_practice_completions').catch(() => false);
  if (!hasCompletions) return;
  await sql`
      INSERT IGNORE INTO flight_data_practice_completions (cid, case_id)
      VALUES (${cid}, ${caseId})
    `;
}

function isAcceptableCruiseAltitude(actual: number | null, expected: number | null): boolean {
  if (expected == null) return true;
  if (actual == null) return false;
  if (actual === expected) return true;

  // Permit higher same-parity IFR altitudes as valid amendments.
  // Example: if 28000 is a valid westbound altitude, 30000 / 32000 should also pass.
  if (actual > expected && (actual - expected) % 2000 === 0) {
    return true;
  }

  return false;
}

export async function checkFDPAnswer(caseRow: FlightDataPracticeCase, input: { cruise_alt?: unknown; route?: unknown; remarks?: unknown }): Promise<FDPCheckResult> {
  const cruise = parseCruiseAlt(input.cruise_alt);
  const route = input.route == null ? '' : normRoute(input.route);
  const remarks = input.remarks == null ? '' : normRemarks(input.remarks);

  const expectedAlt = caseRow.good_cruise_alt == null ? null : Number(caseRow.good_cruise_alt);
  const expectedRoute = caseRow.good_route == null ? '' : normRoute(caseRow.good_route);
  const expectedRemarks = caseRow.good_remarks == null ? '' : normRemarks(caseRow.good_remarks);

  const altitudeOk = isAcceptableCruiseAltitude(cruise, expectedAlt);
  const routeOk = caseRow.good_route == null ? true : route === expectedRoute;
  const remarksOk = caseRow.good_remarks == null ? true : remarks === expectedRemarks;
  return { ok: altitudeOk && routeOk && remarksOk, altitudeOk, routeOk, remarksOk };
}

export const fdpNorm = { normRoute };
