import { selectAll } from '@/lib/query';
import { rosterDisplayName } from '@/lib/names';
import { sql } from '@/lib/db';

export type RosterRow = {
  cid?: number | string;
  first_name?: string | null;
  last_name?: string | null;
  pref_name?: string | null;
  [k: string]: any;
};

export type RosterByCid = Record<string, RosterRow>;

/**
 * Build a map of CID -> roster row.
 *
 * Used for fast CID -> Name lookups (e.g. events assignments) without doing N queries.
 */
export async function getRosterMapByCid(): Promise<RosterByCid> {
  const rows = await selectAll('roster', {
    orderBySql: 'id ASC',
    limit: 5000,
  }).catch(() => [] as any[]);

  const out: RosterByCid = {};
  for (const r of rows ?? []) {
    const cid = (r as any)?.cid;
    if (cid === null || cid === undefined) continue;
    const key = String(cid).trim();
    if (!key) continue;
    out[key] = r as any;
  }
  return out;
}

export function getRosterFullNameByCid(
  rosterByCid: RosterByCid,
  cid: string | number,
  opts?: { fallbackToCid?: boolean; includeCid?: boolean }
): string {
  const cidStr = String(cid).trim();
  const r = rosterByCid?.[cidStr];
  if (!r) return opts?.fallbackToCid === false ? '' : cidStr;

  const name = rosterDisplayName(r);
  if (!name || name === '—') return opts?.fallbackToCid === false ? '' : cidStr;

  return opts?.includeCid ? `${name} (#${cidStr})` : name;
}

export async function getRosterDisplayNameByCid(
  cid: string | number,
  opts?: { fallbackToCid?: boolean; includeCid?: boolean }
): Promise<string> {
  const cidStr = String(cid).trim();
  if (!cidStr) return '';

  const rows = await selectAll('roster', {
    whereSql: 'cid = ?',
    params: [cidStr],
    limit: 1,
  }).catch(() => [] as any[]);

  const r = (rows ?? [])[0] as any;
  if (!r) return opts?.fallbackToCid === false ? '' : cidStr;

  const name = rosterDisplayName(r);
  if (!name || name === '—') return opts?.fallbackToCid === false ? '' : cidStr;

  return opts?.includeCid ? `${name} (#${cidStr})` : name;
}

/**
 * Fetch a CID -> display name map for a set of CIDs in a single query.
 */
export async function getRosterDisplayNameMapByCids(
  cids: Array<string | number>,
  opts?: { fallbackToCid?: boolean }
): Promise<Record<string, string>> {
  const uniq = Array.from(
    new Set((cids ?? []).map((c) => String(c ?? '').trim()).filter(Boolean))
  );

  const out: Record<string, string> = {};
  if (!uniq.length) return out;

  // Pull only the name fields we need.
  let rows: any[] = [];
  try {
    rows = await sql`SELECT cid, first_name, last_name, pref_name
                    FROM roster
                    WHERE cid IN ${sql.in(uniq)}`;
  } catch {
    rows = [];
  }

  const seen = new Set<string>();
  for (const r of rows ?? []) {
    const cid = String((r as any)?.cid ?? '').trim();
    if (!cid) continue;
    seen.add(cid);
    const name = rosterDisplayName(r as any);
    out[cid] = name && name !== '—' ? name : (opts?.fallbackToCid === false ? '' : cid);
  }

  // Ensure every requested CID has a key when fallback is enabled.
  if (opts?.fallbackToCid !== false) {
    for (const cid of uniq) {
      if (!seen.has(cid)) out[cid] = cid;
    }
  }

  return out;
}
