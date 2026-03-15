import { sql } from '@/lib/db';
import { tableHasColumn, tableExists } from '@/lib/schema';
import { ensureVatusaRolesFresh, getFacilityCode, getVatusaRoleCodesForCid } from '@/lib/vatusa';

function rosterTokenize(v: unknown): string[] {
  return String(v ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function isLimitedRosterRow(r: any): boolean {
  // Many existing installs use roster.type = 'LIM' for limited/non-member accounts.
  // We treat these as *not* members, even though a row exists.
  const blob = `${String((r as any)?.status ?? '')} ${String((r as any)?.type ?? '')} ${String((r as any)?.member_type ?? '')} ${String(
    (r as any)?.member_status ?? ''
  )}`;
  const tokens = rosterTokenize(blob);
  return tokens.includes('lim') || tokens.includes('limited');
}

function vatusaSyncMode(): 'cron' | 'lazy' {
  const v = String(process.env.VATUSA_SYNC_MODE ?? 'cron').trim().toLowerCase();
  return v === 'lazy' ? 'lazy' : 'cron';
}

function norm(r: unknown): string {
  return String(r ?? '').trim().toLowerCase();
}

export async function resolveRolesFromUserRoles(cid: number): Promise<string[]> {
  const exists = await tableExists('user_roles').catch(() => false);
  if (!exists) return [];
  const hasCid = await tableHasColumn('user_roles', 'cid').catch(() => false);
  const hasRole = await tableHasColumn('user_roles', 'role').catch(() => false);
  if (!hasCid || !hasRole) return [];

  const rows = await sql`SELECT role FROM user_roles WHERE cid = ${cid}`;
  return Array.from(
    new Set(
      rows
        .map((r: any) => norm(r.role))
        .filter(Boolean)
    )
  );
}

export async function resolveRolesFromVatusa(cid: number): Promise<string[]> {
  // IMPORTANT (performance):
  // Do NOT fetch/sync VATUSA during normal page renders.
  // On a single VPS this can add seconds to *every* request.
  // Instead, run /api/cron/vatusa-sync on a schedule.
  //
  // If you *really* want opportunistic syncing, set:
  //   VATUSA_SYNC_MODE=lazy
  if (vatusaSyncMode() === 'lazy') {
    try {
      await ensureVatusaRolesFresh(getFacilityCode());
    } catch {
      // ignore sync failures; we will use whatever DB has
    }
  }
  const codes = await getVatusaRoleCodesForCid(cid, getFacilityCode()).catch(() => []);
  return codes.map((c) => norm(c));
}

/**
 * Determine whether a user exists on the local roster table.
 *
 * Different installs use different key columns. Prefer CID when available,
 * but fall back to name-based matching if the roster table doesn't expose a CID.
 */
export async function isUserOnRoster(params: {
  cid?: number;
  firstName: string;
  lastName: string;
}): Promise<boolean> {
  // Prefer authoritative VATUSA roster cache when present.
  const fac = getFacilityCode();
  const hasVatusaRoster = await tableExists('vatusa_roster_members').catch(() => false);
  if (hasVatusaRoster) {
    // Defensive: schemas can drift; if the VATUSA roster cache is present but not compatible,
    // we should fall back to the local roster table instead of failing membership resolution.
    try {
      if (typeof params.cid === 'number') {
        const rows = await sql`
          SELECT 1 FROM vatusa_roster_members
          WHERE facility = ${fac} AND cid = ${params.cid}
          LIMIT 1
        `;
        if (rows.length > 0) return true;
      }
      // Name fallback (best-effort)
      const rows = await sql`
        SELECT 1
        FROM vatusa_roster_members
        WHERE facility = ${fac}
          AND lower(coalesce(first_name,'')) = lower(${params.firstName})
          AND lower(coalesce(last_name,'')) = lower(${params.lastName})
        LIMIT 1
      `;
      if (rows.length > 0) return true;
    } catch {
      // ignore and fall back to local roster table
    }
  }

  const hasRosterTable = await tableExists('roster').catch(() => false);
  if (!hasRosterTable) return false;

  const hasCid = await tableHasColumn('roster', 'cid').catch(() => false);
  const hasControllerCid = await tableHasColumn('roster', 'controller_cid').catch(() => false);
  const hasUserCid = await tableHasColumn('roster', 'user_cid').catch(() => false);

  const hasType = await tableHasColumn('roster', 'type').catch(() => false);
  const hasStatus = await tableHasColumn('roster', 'status').catch(() => false);
  const hasMemberType = await tableHasColumn('roster', 'member_type').catch(() => false);
  const hasMemberStatus = await tableHasColumn('roster', 'member_status').catch(() => false);

  const canInspect = hasType || hasStatus || hasMemberType || hasMemberStatus;

  async function fetchRowBy(whereSql: string, v: string) {
    if (!canInspect) {
      const rows = await sql.unsafe<any[]>(`SELECT 1 FROM roster WHERE ${whereSql} = $1 LIMIT 1`, [v]);
      return rows?.[0] ?? null;
    }
    // Only select columns that exist on this install.
    const cols = [
      hasType ? 'type' : null,
      hasStatus ? 'status' : null,
      hasMemberType ? 'member_type' : null,
      hasMemberStatus ? 'member_status' : null,
    ].filter(Boolean);
    const select = cols.length ? cols.join(',') : '1';
    const rows = await sql.unsafe<any[]>(`SELECT ${select} FROM roster WHERE ${whereSql} = $1 LIMIT 1`, [v]);
    return rows?.[0] ?? null;
  }

  if (typeof params.cid === 'number') {
    const cidStr = String(params.cid);
    let r: any = null;
    if (hasCid) r = await fetchRowBy('cid', cidStr);
    else if (hasControllerCid) r = await fetchRowBy('controller_cid', cidStr);
    else if (hasUserCid) r = await fetchRowBy('user_cid', cidStr);

    if (r) {
      if (canInspect && isLimitedRosterRow(r)) return false;
      return true;
    }
  }

  // Fall back to name matching.
  const hasFirst = await tableHasColumn('roster', 'first_name').catch(() => false);
  const hasLast = await tableHasColumn('roster', 'last_name').catch(() => false);
  if (!hasFirst || !hasLast) return false;

  if (!canInspect) {
    const rows = await sql`
      SELECT 1
      FROM roster
      WHERE lower(first_name) = lower(${params.firstName})
        AND lower(last_name) = lower(${params.lastName})
      LIMIT 1
    `;
    return rows.length > 0;
  }

  const cols = [
    hasType ? 'type' : null,
    hasStatus ? 'status' : null,
    hasMemberType ? 'member_type' : null,
    hasMemberStatus ? 'member_status' : null,
  ].filter(Boolean);
  const select = cols.length ? cols.join(',') : '1';
  const rows = await sql.unsafe<any[]>(
    `SELECT ${select} FROM roster WHERE lower(first_name) = lower($1) AND lower(last_name) = lower($2) LIMIT 1`,
    [params.firstName, params.lastName]
  );
  const r = rows?.[0];
  if (!r) return false;
  return !isLimitedRosterRow(r);
}

export async function resolveRosterMemberType(params: {
  cid?: number;
  firstName: string;
  lastName: string;
}): Promise<'home' | 'visiting' | null> {
  // Prefer authoritative VATUSA roster cache when present.
  const fac = getFacilityCode();
  const hasVatusaRoster = await tableExists('vatusa_roster_members').catch(() => false);
  if (hasVatusaRoster) {
    try {
      if (typeof params.cid === 'number') {
        const rows = await sql<any[]>`
          SELECT member_type
          FROM vatusa_roster_members
          WHERE facility = ${fac} AND cid = ${params.cid}
          LIMIT 1
        `;
        const t = String(rows?.[0]?.member_type ?? '').toLowerCase();
        if (t === 'home' || t === 'visiting') return t as any;
      }

      const rows = await sql<any[]>`
        SELECT member_type
        FROM vatusa_roster_members
        WHERE facility = ${fac}
          AND lower(coalesce(first_name,'')) = lower(${params.firstName})
          AND lower(coalesce(last_name,'')) = lower(${params.lastName})
        LIMIT 1
      `;
      const t = String(rows?.[0]?.member_type ?? '').toLowerCase();
      if (t === 'home' || t === 'visiting') return t as any;
    } catch {
      // ignore and fall back to local roster table
    }
  }

  const hasRosterTable = await tableExists('roster').catch(() => false);
  if (!hasRosterTable) return null;

  const hasCid = await tableHasColumn('roster', 'cid').catch(() => false);
  const hasControllerCid = await tableHasColumn('roster', 'controller_cid').catch(() => false);
  const hasUserCid = await tableHasColumn('roster', 'user_cid').catch(() => false);
  const hasFirst = await tableHasColumn('roster', 'first_name').catch(() => false);
  const hasLast = await tableHasColumn('roster', 'last_name').catch(() => false);

  // Different installs vary; just grab the roster row and interpret flexibly.
  let rows: any[] = [];
  if (typeof params.cid === 'number') {
    if (hasCid) rows = await sql<any[]>`SELECT * FROM roster WHERE cid = ${String(params.cid)} LIMIT 1`;
    else if (hasControllerCid) rows = await sql<any[]>`SELECT * FROM roster WHERE controller_cid = ${String(params.cid)} LIMIT 1`;
    else if (hasUserCid) rows = await sql<any[]>`SELECT * FROM roster WHERE user_cid = ${String(params.cid)} LIMIT 1`;
  }

  if (!rows.length && hasFirst && hasLast) {
    rows = await sql<any[]>`
      SELECT * FROM roster
      WHERE lower(first_name) = lower(${params.firstName})
        AND lower(last_name) = lower(${params.lastName})
      LIMIT 1
    `;
  }

  const r = rows?.[0];
  if (!r) return null;

  // Limited/non-member rows should not be treated as home members.
  if (isLimitedRosterRow(r)) return null;

  // Hard visitor flags first.
  const visitorVal = (r as any).visitor ?? (r as any).is_visitor;
  if (visitorVal === true || visitorVal === 1 || visitorVal === '1') return 'visiting';

  // Heuristic based on status/type strings.
  const blob = `${String((r as any).status ?? '')} ${String((r as any).type ?? '')}`.toLowerCase();
  if (blob.includes('visit')) return 'visiting';

  // Default for members.
  return 'home';
}

export async function resolveRolesFromRoster(params: {
  cid?: number;
  firstName: string;
  lastName: string;
}): Promise<string[]> {
  // NOTE: The historical PHP repo keyed roster by `cid`. Your Postgres schema may be a view without it.
  const hasRoster = await tableHasColumn('roster', 'first_name').catch(() => false);
  if (!hasRoster) return [];

  const cols = await Promise.all([
    tableHasColumn('roster', 'cid'),
    tableHasColumn('roster', 'staff'),
    tableHasColumn('roster', 'mentor'),
    tableHasColumn('roster', 'ins'),
  ]);
  const [hasCid, hasStaff, hasMentor, hasIns] = cols;

  let rows: any[] = [];
  if (hasCid && typeof params.cid === 'number') {
    rows = await sql`SELECT * FROM roster WHERE cid = ${String(params.cid)} LIMIT 1`;
  } else {
    // Fall back to matching by name (case-insensitive)
    rows = await sql`
      SELECT * FROM roster
      WHERE lower(first_name) = lower(${params.firstName})
        AND lower(last_name) = lower(${params.lastName})
      LIMIT 1
    `;
  }

  const r = rows[0];
  if (!r) return [];

  const roles: string[] = [];

  if (hasStaff) {
    const staffVal = r.staff;
    if (typeof staffVal === 'string' && staffVal.trim()) roles.push(staffVal.trim());
    if (staffVal === true) roles.push('staff');
  }
  if (hasMentor && r.mentor === true) roles.push('mentor');
  if (hasIns && r.ins === true) roles.push('ins');

  // Deduplicate
  return Array.from(new Set(roles.map(norm).filter(Boolean)));
}

export async function resolveEffectiveRoles(params: { cid?: number; firstName: string; lastName: string }): Promise<string[]> {
  const rosterRoles = await resolveRolesFromRoster(params);
  const extra = typeof params.cid === 'number' ? await resolveRolesFromUserRoles(params.cid).catch(() => []) : [];
  const vatusa = typeof params.cid === 'number' ? await resolveRolesFromVatusa(params.cid).catch(() => []) : [];
  return Array.from(new Set([...rosterRoles, ...extra, ...vatusa].map(norm).filter(Boolean)));
}
