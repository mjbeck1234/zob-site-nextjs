import { getRoster } from '@/lib/content';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import RosterClient from './RosterClient';

// The roster table varies between installs; keep this flexible.
export type RosterRow = {
  id?: any;
  cid: string;
  first_name?: string;
  last_name?: string;
  pref_name?: string;
  name?: string;
  rating?: string;
  status?: string;
  type?: string;
  staff?: string;
  ins?: any;
  mentor?: any;
  ocn?: any;
  events?: any;
  training?: any;
  active?: boolean;
  roster_exempt?: boolean;
  able_training?: boolean;
  join_date?: string | null;
  joined_at?: string | null;
  last_seen?: string | null;
  s1?: any;
  s2?: any;
  s3?: any;
  c1?: any;
  [key: string]: any;
};

export default async function RosterPage() {
  // Only show primary (home) and visitor rosters on the public roster page.
  // Staff are displayed on /roster/staff.
  const rowsAll = (await getRoster()) as unknown as RosterRow[];
  const rows = rowsAll.filter((r) => {
    const t = String((r as any)?.type ?? '').trim().toLowerCase();
    return t === 'prim' || t === 'vis';
  });
  // Apply roster overrides (preferred name + endorsements) if present.
  const hasOverrides = await tableExists('roster_overrides').catch(() => false);
  if (hasOverrides) {
    const oRows: any[] = await sql<any[]>`SELECT * FROM roster_overrides`;
    const oByCid = new Map<string, any>();
    for (const o of oRows) oByCid.set(String(o.cid), o);

    for (const r of rows) {
      const o = oByCid.get(String(r.cid));
      if (!o) continue;

      const pn = String(o.pref_name_override ?? '').trim();
      if (pn) (r as any).pref_name = pn;

      const applyEndorse = (key: 's1' | 's2' | 's3' | 'c1') => {
        const ov = String((o as any)[`${key}_override`] ?? '').toLowerCase();
        if (ov === 'full') (r as any)[key] = true;
        if (ov === 'none') (r as any)[key] = false;
      };
      applyEndorse('s1');
      applyEndorse('s2');
      applyEndorse('s3');
      applyEndorse('c1');
    }
  }
  const facility = process.env.NEXT_PUBLIC_FACILITY_CODE ?? 'ZOB';
  return <RosterClient facility={facility} rows={rows} />;
}
