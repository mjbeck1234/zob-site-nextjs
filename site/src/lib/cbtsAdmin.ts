import 'server-only';

import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';

export type AdminCbtSection = {
  id: string | number;
  title: string;
  published: number;
};

export type AdminCbtItem = {
  id: string | number;
  section_id: string | number | null;
  title: string;
  description?: string | null;
  url: string;
  published: number;
};

export async function listAllCbtSectionsWithCbts(): Promise<{
  dbOk: boolean;
  sections: AdminCbtSection[];
  cbts: AdminCbtItem[];
}> {
  const hasSections = await tableExists('sections');
  const hasCbts = await tableExists('cbts');
  if (!hasSections || !hasCbts) return { dbOk: false, sections: [], cbts: [] };

  const secRows: any[] = await sql`SELECT id, title, published FROM sections ORDER BY title ASC`;
  const sections: AdminCbtSection[] = Array.isArray(secRows)
    ? secRows.map((r) => ({
        id: r.id,
        title: String(r.title ?? '').trim() || `Section ${r.id}`,
        published: Number(r.published ?? 0) || 0,
      }))
    : [];

  const cbtRows: any[] = await sql`SELECT id, section_id, title, description, url, published FROM cbts ORDER BY section_id ASC, title ASC`;
  const cbts: AdminCbtItem[] = Array.isArray(cbtRows)
    ? cbtRows.map((r) => ({
        id: r.id,
        section_id: r.section_id ?? null,
        title: String(r.title ?? '').trim() || `CBT ${r.id}`,
        description: r.description ?? null,
        url: String(r.url ?? '').trim(),
        published: Number(r.published ?? 0) || 0,
      }))
    : [];

  return { dbOk: true, sections, cbts };
}
