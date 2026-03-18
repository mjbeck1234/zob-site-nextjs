import 'server-only';

import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
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

  const cidStr = String(cidNum);

  try {
    const rows = await sql<any[]>`SELECT 1 FROM roster WHERE cid = ${cidStr} LIMIT 1`;
    if (rows.length) return;
  } catch {
    return;
  }

  try {
    await sql`
      INSERT INTO roster (cid, first_name, last_name, pref_name, type, status)
      VALUES (${cidStr}, ${params.firstName}, ${params.lastName}, ${params.firstName}, ${'LIM'}, ${'LIM'})
    `;
  } catch {
  }
}
