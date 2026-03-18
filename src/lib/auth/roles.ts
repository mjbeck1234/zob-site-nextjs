import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
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
  const fac = getFacilityCode();
  const hasVatusaRoster = await tableExists('vatusa_roster_members').catch(() => false);
  if (hasVatusaRoster) {
    try {
      if (typeof params.cid === 'number') {
        const rows = await sql`
          SELECT 1 FROM vatusa_roster_members
          WHERE facility = ${fac} AND cid = ${params.cid}
          LIMIT 1
        `;
        if (rows.length > 0) return true;
      }
      const rows = await sql`
        SELECT 1
        FROM vatusa_roster_members
        WHERE facility = ${fac}
          AND lower(coalesce(first_name,'')) = lower(${params.firstName})
          AND lower(coalesce(last_name,'')) = lower(${params.lastName})
        LIMIT 1
      `;
      if (rows.length > 0) return true;
    } catch {}
  }

  const hasRosterTable = await tableExists('roster').catch(() => false);
  if (!hasRosterTable) return false;

  if (typeof params.cid === 'number') {
    const rows = await sql<any[]>`SELECT type, status FROM roster WHERE cid = ${String(params.cid)} LIMIT 1`;
    const r = rows?.[0];
    if (r) return !isLimitedRosterRow(r);
  }

  const rows = await sql<any[]>`
    SELECT type, status
    FROM roster
    WHERE lower(first_name) = lower(${params.firstName})
      AND lower(last_name) = lower(${params.lastName})
    LIMIT 1
  `;
  const r = rows?.[0];
  if (!r) return false;
  return !isLimitedRosterRow(r);
}

export async function resolveRosterMemberType(params: {
  cid?: number;
  firstName: string;
  lastName: string;
}): Promise<'home' | 'visiting' | null> {
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
    } catch {}
  }

  const hasRosterTable = await tableExists('roster').catch(() => false);
  if (!hasRosterTable) return null;

  let rows: any[] = [];
  if (typeof params.cid === 'number') {
    rows = await sql<any[]>`SELECT * FROM roster WHERE cid = ${String(params.cid)} LIMIT 1`;
  }

  if (!rows.length) {
    rows = await sql<any[]>`
      SELECT * FROM roster
      WHERE lower(first_name) = lower(${params.firstName})
        AND lower(last_name) = lower(${params.lastName})
      LIMIT 1
    `;
  }

  const r = rows?.[0];
  if (!r) return null;
  if (isLimitedRosterRow(r)) return null;
  const blob = `${String((r as any).status ?? '')} ${String((r as any).type ?? '')}`.toLowerCase();
  if (blob.includes('visit')) return 'visiting';
  return 'home';
}

export async function resolveRolesFromRoster(params: {
  cid?: number;
  firstName: string;
  lastName: string;
}): Promise<string[]> {
  const hasRoster = await tableExists('roster').catch(() => false);
  if (!hasRoster) return [];

  let rows: any[] = [];
  if (typeof params.cid === 'number') {
    rows = await sql`SELECT * FROM roster WHERE cid = ${String(params.cid)} LIMIT 1`;
  }
  if (!rows.length) {
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
  const staffVal = r.staff;
  if (typeof staffVal === 'string' && staffVal.trim()) roles.push(staffVal.trim());
  if (staffVal === true || staffVal === 1 || staffVal === '1') roles.push('staff');
  if (r.mentor === true || r.mentor === 1 || r.mentor === '1') roles.push('mentor');
  if (r.ins === true || r.ins === 1 || r.ins === '1') roles.push('ins');
  return Array.from(new Set(roles.map(norm).filter(Boolean)));
}

export async function resolveEffectiveRoles(params: { cid?: number; firstName: string; lastName: string }): Promise<string[]> {
  const rosterRoles = await resolveRolesFromRoster(params);
  const extra = typeof params.cid === 'number' ? await resolveRolesFromUserRoles(params.cid).catch(() => []) : [];
  const vatusa = typeof params.cid === 'number' ? await resolveRolesFromVatusa(params.cid).catch(() => []) : [];
  return Array.from(new Set([...rosterRoles, ...extra, ...vatusa].map(norm).filter(Boolean)));
}
