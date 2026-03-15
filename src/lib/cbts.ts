import 'server-only';

import { sql } from '@/lib/db';

export type CbtSection = {
  id: string | number;
  title: string;
};

export type CbtItem = {
  id: string | number;
  section_id: string | number;
  title: string;
  description?: string | null;
  url: string;
  published?: any;
};

export async function listPublishedCbtSectionsWithCbts(): Promise<{
  dbOk: boolean;
  sections: CbtSection[];
  cbts: CbtItem[];
}> {
  try {
    // Sections
    const secRows: any[] = await sql`SELECT id, title FROM sections WHERE published > 0 ORDER BY title ASC`;
    const sections: CbtSection[] = Array.isArray(secRows)
      ? secRows.map((r) => ({ id: r.id, title: String(r.title ?? '').trim() || `Section ${r.id}` }))
      : [];

    // Always include Uncategorized as a catch-all (existing behavior)
    sections.push({ id: 'u', title: 'Uncategorized' });

    const cbtRows: any[] = await sql`SELECT id, section_id, title, description, url FROM cbts WHERE published > 0 ORDER BY section_id ASC, title ASC`;
    const cbts: CbtItem[] = Array.isArray(cbtRows)
      ? cbtRows.map((r) => ({
          id: r.id,
          section_id: r.section_id ?? 'u',
          title: String(r.title ?? '').trim() || `CBT ${r.id}`,
          description: r.description ?? null,
          url: String(r.url ?? '').trim(),
        }))
      : [];

    return { dbOk: true, sections, cbts };
  } catch {
    // Most likely: current tables not present yet.
    return { dbOk: false, sections: [], cbts: [] };
  }
}

export async function listViewedCbtIdsForUser(cid: number): Promise<number[]> {
  try {
    const rows: any[] = await sql`SELECT cbt_id FROM cbt_results WHERE controller_cid = ${Number(cid)} ORDER BY cbt_id ASC`;
    if (!Array.isArray(rows)) return [];
    const out: number[] = [];
    for (const r of rows) {
      const n = Number(r.cbt_id);
      if (Number.isFinite(n)) out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}
