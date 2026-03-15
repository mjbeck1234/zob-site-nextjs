import 'server-only';

import { sql } from '@/lib/db';
import { tableExists, tableHasColumn } from '@/lib/schema';
import { insertDynamic } from '@/lib/admin/crud';
import { resolveRosterMemberType } from './roles';

/**
 * If a user successfully logs in via VATSIM but is not a HOME or VISITING roster member,
 * ensure they exist in the local roster table as a limited (LIM) record.
 *
 * This is useful for auditing, admin workflows, and whitelisting later.
 */
export async function ensureLimitedRosterEntryOnLogin(params: {
  cid: number;
  firstName: string;
  lastName: string;
  email?: string | null;
}) {
  const cidNum = Number(params.cid);
  if (!Number.isFinite(cidNum) || cidNum <= 0) return;

  // If they are already a home/visiting member (via VATUSA roster cache or local roster), do nothing.
  const memberType = await resolveRosterMemberType({
    cid: cidNum,
    firstName: params.firstName,
    lastName: params.lastName,
  }).catch(() => null);
  if (memberType === 'home' || memberType === 'visiting') return;

  const hasRoster = await tableExists('roster').catch(() => false);
  if (!hasRoster) return;

  const [hasCid, hasControllerCid, hasUserCid, hasFirst, hasLast] = await Promise.all([
    tableHasColumn('roster', 'cid').catch(() => false),
    tableHasColumn('roster', 'controller_cid').catch(() => false),
    tableHasColumn('roster', 'user_cid').catch(() => false),
    tableHasColumn('roster', 'first_name').catch(() => false),
    tableHasColumn('roster', 'last_name').catch(() => false),
  ]);

  const cidStr = String(cidNum);

  // If a record already exists (any type), don't insert a duplicate.
  try {
    if (hasCid) {
      const rows = await sql.unsafe<any[]>(`SELECT 1 FROM roster WHERE cid = $1 LIMIT 1`, [cidStr]);
      if (rows.length) return;
    } else if (hasControllerCid) {
      const rows = await sql.unsafe<any[]>(`SELECT 1 FROM roster WHERE controller_cid = $1 LIMIT 1`, [cidStr]);
      if (rows.length) return;
    } else if (hasUserCid) {
      const rows = await sql.unsafe<any[]>(`SELECT 1 FROM roster WHERE user_cid = $1 LIMIT 1`, [cidStr]);
      if (rows.length) return;
    } else if (hasFirst && hasLast) {
      const rows = await sql.unsafe<any[]>(
        `SELECT 1 FROM roster WHERE lower(first_name) = lower($1) AND lower(last_name) = lower($2) LIMIT 1`,
        [params.firstName, params.lastName]
      );
      if (rows.length) return;
    } else {
      // No reliable key columns to insert into.
      return;
    }
  } catch {
    // If the check query fails, don't block login.
    return;
  }

  // MySQL-friendly DATETIME string.
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Best-effort insert: only columns that exist will be included.
  // Use both `type` and `status` when available; some existing schemas key off one or the other.
  try {
    await insertDynamic('roster', {
      cid: cidStr,
      controller_cid: cidStr,
      user_cid: cidStr,

      first_name: params.firstName,
      last_name: params.lastName,
      pref_name: params.firstName,
      email: params.email ?? undefined,

      type: 'LIM',
      status: 'LIM',
      visitor: false,
      is_visitor: false,

      created_at: now,
      updated_at: now,
    });
  } catch {
    // Never block login on roster provisioning failures.
  }
}
