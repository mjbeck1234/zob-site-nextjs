import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { ZOB_FACILITIES } from '@/config/zobFacilities';
import { unstable_cache } from 'next/cache';

export type VatusaFacilityRole = {
  cid: number;
  role: string;
  created_at?: string;
};

export type VatusaRosterMember = {
  cid: number;
  member_type: 'home' | 'visiting';
  first_name?: string;
  last_name?: string;
  rating?: string;
  status?: string;
  join_date?: string;
};

function facilityCode(): string {
  return (process.env.NEXT_PUBLIC_FACILITY_CODE || process.env.FACILITY_CODE || 'ZOB').trim().toUpperCase();
}

export function getFacilityCode(): string {
  return facilityCode();
}

function vatusaHeaders(): Record<string, string> {
  // VATUSA endpoints are generally public, but allow an API key if the
  // site owner provides one.
  const key = (process.env.VATUSA_API_KEY || '').trim();
  const h: Record<string, string> = {
    'User-Agent': 'clevelandcenter.org (Next.js) vatusa-sync',
    Accept: 'application/json',
  };
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

export type VatusaSoloCert = {
  cid: number;
  position: string;
  // Expiration date/time as returned by VATUSA. Null/undefined means “no expiration”.
  expDate?: string | null;
};

async function fetchJson(url: string, timeoutMs?: number): Promise<any> {
  const ms = Number(timeoutMs ?? process.env.VATUSA_FETCH_TIMEOUT_MS ?? 8000);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1000, ms));
  const res = await fetch(url, {
    cache: 'no-store',
    headers: vatusaHeaders(),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(t));
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`VATUSA fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return await res.json();
}

function firstArray(...candidates: any[]): any[] {
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

function extractRosterArray(json: any): any[] {
  const d = json?.data;
  // Different endpoints/versions may use different keys.
  return firstArray(
    d?.roster,
    d?.controllers,
    d?.members,
    d?.facility?.roster,
    d?.facility?.controllers,
    d?.facility?.members,
    d?.facility?.data?.roster
  );
}

function extractFacilityRolesArray(json: any): any[] {
  const d = json?.data;
  return firstArray(d?.facility?.roles, d?.roles, d?.facility_roles);
}

function toRosterMember(row: any, member_type: 'home' | 'visiting'): VatusaRosterMember | null {
  const cid = Number(row?.cid ?? row?.controller_cid ?? row?.user_cid ?? 0);
  if (!Number.isFinite(cid) || cid <= 0) return null;
  const first_name = String(row?.fname ?? row?.first_name ?? row?.firstName ?? '').trim() || undefined;
  const last_name = String(row?.lname ?? row?.last_name ?? row?.lastName ?? '').trim() || undefined;
  const rating = String(row?.rating ?? row?.atc_rating ?? row?.controller_rating ?? '').trim() || undefined;
  const status = String(row?.status ?? row?.controller_status ?? '').trim() || undefined;
  const join_date = row?.join_date || row?.joinDate || row?.created_at || row?.createdAt ? String(row.join_date ?? row.joinDate ?? row.created_at ?? row.createdAt) : undefined;
  return { cid, member_type, first_name, last_name, rating, status, join_date };
}

function safeDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Fetches current facility roles from VATUSA.
 */
export async function fetchVatusaFacilityRoles(facility = facilityCode()): Promise<VatusaFacilityRole[]> {
  // IMPORTANT:
  // Staff roles should only be applied to *home* roster members.
  // Use the /roster/home endpoint as the source of truth.
  const url = `https://api.vatusa.net/facility/${encodeURIComponent(facility)}/roster/home`;
  const json = await fetchJson(url);
  const roles = extractFacilityRolesArray(json);
  if (!Array.isArray(roles) || !roles.length) return [];

  return roles
    .map((r: any) => {
      const cid = Number(r?.cid ?? 0);
      const role = String(r?.role ?? '').trim();
      const created_at = r?.created_at ? String(r.created_at) : undefined;
      if (!Number.isFinite(cid) || cid <= 0 || !role) return null;
      return { cid, role, created_at } as VatusaFacilityRole;
    })
    .filter(Boolean) as VatusaFacilityRole[];
}

export async function fetchVatusaRoster(facility = facilityCode(), member_type: 'home' | 'visiting' = 'home'): Promise<VatusaRosterMember[]> {
  const url = `https://api.vatusa.net/facility/${encodeURIComponent(facility)}/roster/${member_type}`;
  const json = await fetchJson(url);
  const arr = extractRosterArray(json);
  return arr
    .map((r: any) => toRosterMember(r, member_type))
    .filter(Boolean) as VatusaRosterMember[];
}

export async function getVatusaRoleCodesForCid(cid: number, facility = facilityCode()): Promise<string[]> {
  const ok = await tableExists('vatusa_facility_roles').catch(() => false);
  if (!ok) return [];
  const hasRoster = await tableExists('vatusa_roster_members').catch(() => false);
  const rows = hasRoster
    ? await sql<{ role: string }[]>`
        SELECT r.role
        FROM vatusa_facility_roles r
        JOIN vatusa_roster_members m
          ON m.facility = r.facility
         AND m.cid = r.cid
         AND m.member_type = 'home'
        WHERE r.facility = ${facility} AND r.cid = ${cid}
      `
    : await sql<{ role: string }[]>`
        SELECT role
        FROM vatusa_facility_roles
        WHERE facility = ${facility} AND cid = ${cid}
      `;
  return Array.from(
    new Set(
      rows
        .map((r: any) => String(r.role ?? '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

export async function getLastVatusaSyncAt(facility = facilityCode()): Promise<Date | null> {
  const ok = await tableExists('vatusa_facility_sync').catch(() => false);
  if (!ok) return null;
  const rows = await sql<{ synced_at: string }[]>`
    SELECT synced_at
    FROM vatusa_facility_sync
    WHERE facility = ${facility}
    LIMIT 1
  `;
  const v = rows?.[0]?.synced_at;
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function getLastVatusaRosterSyncAt(facility = facilityCode()): Promise<Date | null> {
  const ok = await tableExists('vatusa_roster_sync').catch(() => false);
  if (!ok) return null;
  const rows = await sql<{ synced_at: string }[]>`
    SELECT synced_at
    FROM vatusa_roster_sync
    WHERE facility = ${facility}
    LIMIT 1
  `;
  const v = rows?.[0]?.synced_at;
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Writes the latest VATUSA facility roles into Postgres.
 *
 * Strategy: replace the facility role set in a single transaction.
 */
export async function syncVatusaFacilityRolesToDb(facility = facilityCode()): Promise<{ facility: string; count: number }>{
  const hasRolesTable = await tableExists('vatusa_facility_roles').catch(() => false);
  const hasSyncTable = await tableExists('vatusa_facility_sync').catch(() => false);
  const hasRosterTable = await tableExists('vatusa_roster_members').catch(() => false);
  const hasRosterSync = await tableExists('vatusa_roster_sync').catch(() => false);
  if (!hasRolesTable || !hasSyncTable) {
    // Tables are optional; caller should run sql/create_tables_extra.sql
    return { facility, count: 0 };
  }

  // Pull roster first so we can enforce: staff roles only for home members.
  const [homeRoster, visitingRoster, roles] = await Promise.all([
    hasRosterTable ? fetchVatusaRoster(facility, 'home').catch(() => []) : Promise.resolve([]),
    hasRosterTable ? fetchVatusaRoster(facility, 'visiting').catch(() => []) : Promise.resolve([]),
    fetchVatusaFacilityRoles(facility).catch(() => []),
  ]);

  const homeSet = new Set(homeRoster.map((m) => m.cid));
  const filteredRoles = roles.filter((r) => homeSet.has(r.cid));

  await sql.begin(async (tx) => {
    if (hasRosterTable && hasRosterSync) {
      // Replace facility roster cache.
      await tx`DELETE FROM vatusa_roster_members WHERE facility = ${facility}`;
      for (const m of homeRoster) {
        await tx`
          INSERT INTO vatusa_roster_members (facility, cid, member_type, first_name, last_name, rating, status, join_date, updated_at)
          VALUES (
            ${facility},
            ${m.cid},
            ${m.member_type},
            ${m.first_name ?? null},
            ${m.last_name ?? null},
            ${m.rating ?? null},
            ${m.status ?? null},
            ${safeDate(m.join_date) },
            NOW()
          )
          ON DUPLICATE KEY UPDATE
            member_type = VALUES(member_type),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            rating = VALUES(rating),
            status = VALUES(status),
            join_date = VALUES(join_date),
            updated_at = NOW()
        `;
      }
      for (const m of visitingRoster) {
        await tx`
          INSERT INTO vatusa_roster_members (facility, cid, member_type, first_name, last_name, rating, status, join_date, updated_at)
          VALUES (
            ${facility},
            ${m.cid},
            ${m.member_type},
            ${m.first_name ?? null},
            ${m.last_name ?? null},
            ${m.rating ?? null},
            ${m.status ?? null},
            ${safeDate(m.join_date) },
            NOW()
          )
          ON DUPLICATE KEY UPDATE
            member_type = VALUES(member_type),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            rating = VALUES(rating),
            status = VALUES(status),
            join_date = VALUES(join_date),
            updated_at = NOW()
        `;
      }
      await tx`
        INSERT INTO vatusa_roster_sync (facility, synced_at, updated_at)
        VALUES (${facility}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE synced_at = NOW(), updated_at = NOW()
      `;
    }

    await tx`DELETE FROM vatusa_facility_roles WHERE facility = ${facility}`;
    for (const r of filteredRoles) {
      await tx`
        INSERT INTO vatusa_facility_roles (facility, cid, role, created_at, updated_at)
        VALUES (${facility}, ${r.cid}, ${r.role}, ${safeDate(r.created_at) }, NOW())
        ON DUPLICATE KEY UPDATE updated_at = NOW()
      `;
    }
    await tx`
      INSERT INTO vatusa_facility_sync (facility, synced_at, updated_at)
      VALUES (${facility}, NOW(), NOW())
      ON DUPLICATE KEY UPDATE synced_at = NOW(), updated_at = NOW()
    `;
  });

  return { facility, count: filteredRoles.length };
}

/**
 * Ensures that VATUSA facility roles are synced at most once per day.
 *
 * This runs opportunistically (on login / page load). For a strict daily
 * sync, also schedule /api/cron/vatusa-sync with a cron job.
 */
export async function ensureVatusaRolesFresh(facility = facilityCode(), maxAgeHours = 24): Promise<void> {
  const hasRolesTable = await tableExists('vatusa_facility_roles').catch(() => false);
  const hasSyncTable = await tableExists('vatusa_facility_sync').catch(() => false);
  if (!hasRolesTable || !hasSyncTable) return;

  const hasRoster = await tableExists('vatusa_roster_members').catch(() => false);
  const hasRosterSync = await tableExists('vatusa_roster_sync').catch(() => false);

  const last = await getLastVatusaSyncAt(facility).catch(() => null);
  const lastRoster = hasRoster && hasRosterSync ? await getLastVatusaRosterSyncAt(facility).catch(() => null) : null;
  if (!last) {
    await syncVatusaFacilityRolesToDb(facility).catch(() => undefined);
    return;
  }

  const ageMs = Date.now() - last.getTime();
  const maxMs = maxAgeHours * 60 * 60 * 1000;
  const rosterAgeMs = lastRoster ? Date.now() - lastRoster.getTime() : Number.POSITIVE_INFINITY;
  if (ageMs > maxMs || rosterAgeMs > maxMs) {
    await syncVatusaFacilityRolesToDb(facility).catch(() => undefined);
  }
}

function zobFacilityPrefixes(): Set<string> {
  // Optional override via env var: ZOB_FACILITIES="CLE_,DTW_,..." (comma-separated)
  const facilities = (process.env.ZOB_FACILITIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list = facilities.length ? facilities : ZOB_FACILITIES;
  return new Set(list.map((s) => String(s).toUpperCase()));
}

function extractSoloArray(json: any): any[] {
  // The existing v2 solo endpoint is usually an array at the root.
  if (Array.isArray(json)) return json;
  const d = json?.data;
  return firstArray(d?.solos, d?.solo, d?.records, d?.items, d);
}

function toSolo(row: any): VatusaSoloCert | null {
  const cid = Number(row?.cid ?? row?.controller_cid ?? row?.user_cid ?? 0);
  const position = String(row?.position ?? row?.callsign ?? row?.pos ?? '').trim().toUpperCase();
  const expRaw = row?.expDate ?? row?.exp_date ?? row?.expires_at ?? row?.expiresAt ?? row?.expiration ?? row?.expires ?? null;
  const expDate = expRaw === null || expRaw === undefined ? null : String(expRaw);
  if (!Number.isFinite(cid) || cid <= 0 || !position) return null;
  return { cid, position, expDate };
}

function parseExpiry(expDate?: string | null): Date | null {
  if (!expDate) return null;
  const d = new Date(expDate);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Fetches all solo certs from VATUSA.
 *
 * NOTE: This uses the existing v2 endpoint because that's what the existing ZOB site used.
 */
export const fetchVatusaSoloCerts = unstable_cache(
  async (): Promise<VatusaSoloCert[]> => {
    const json = await fetchJson('https://api.vatusa.net/v2/solo');
    const rows = extractSoloArray(json);
    return rows.map(toSolo).filter(Boolean) as VatusaSoloCert[];
  },
  ['vatusa-v2-solo-all'],
  { revalidate: 300, tags: ['vatusa-solo'] }
);

/**
 * Returns ONLY active solo certs for positions within ZOB's AOR (based on facility prefixes).
 */
export async function getActiveZobSoloCertsByCid(): Promise<Record<string, Array<{ position: string; expDate: string | null }>>> {
  const solos = await fetchVatusaSoloCerts().catch(() => []);
  const prefixes = zobFacilityPrefixes();
  const now = Date.now();

  const out: Record<string, Array<{ position: string; expDate: string | null }>> = {};
  for (const s of solos) {
    const pos = String(s.position || '').toUpperCase();
    if (!pos.includes('_')) continue;
    const prefix4 = pos.slice(0, 4);
    if (!prefixes.has(prefix4)) continue;

    const exp = parseExpiry(s.expDate);
    if (exp && exp.getTime() < now) continue; // expired

    const key = String(s.cid);
    out[key] ??= [];
    out[key].push({ position: pos, expDate: s.expDate ?? null });
  }

  // Keep display stable: sort per-CID list by position.
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.position.localeCompare(b.position));
  }
  return out;
}

function requireVatusaKey(): string {
  const key = String(process.env.VATUSA_API_KEY ?? '').trim();
  if (!key) throw new Error('Missing VATUSA_API_KEY in environment');
  return key;
}

/**
 * Issue a solo cert via VATUSA (existing v2 endpoint).
 * Expects expDate as YYYY-MM-DD.
 */
export async function issueVatusaSoloCert(input: { cid: number; position: string; expDate: string }): Promise<void> {
  const key = requireVatusaKey();
  const body = new URLSearchParams();
  body.set('apikey', key);
  body.set('cid', String(input.cid));
  body.set('position', String(input.position).trim().toUpperCase());
  body.set('expDate', String(input.expDate).trim());

  const res = await fetch('https://api.vatusa.net/v2/solo', {
    method: 'POST',
    headers: {
      ...vatusaHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`VATUSA solo issue failed (${res.status}): ${txt.slice(0, 200)}`);
  }
}
