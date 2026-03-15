import 'server-only';

import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { rosterDisplayName } from '@/lib/names';

export type LegacySyllabusListItem = {
  id: number;
  name: string;
  rating: string;
};

export type LegacyEntry = {
  progress: number;
  observerCid: number | null;
  observerName: string | null;
  updatedAt: string | null;
};

export type LegacyContentRow = {
  id: number;
  content: string;
  fields: string;
  entry: LegacyEntry | null;
};

export type LegacySection = {
  id: number;
  name: string;
  rows: LegacyContentRow[];
};

export type LegacySyllabusTree = {
  syllabus: LegacySyllabusListItem;
  sections: LegacySection[];
};

const ORDER_SQL = "ORDER BY FIELD(rating, 'ADM', 'C1', 'S3', 'S2', 'S1') DESC, id ASC";

export async function legacySyllabusEnabled(): Promise<boolean> {
  const needed = ['syllabi', 'syllabi_sections', 'syllabi_content', 'syllabi_entries'];
  const exists = await Promise.all(needed.map((t) => tableExists(t).catch(() => false)));
  return exists.every(Boolean);
}

export async function listLegacySyllabi(opts?: { includeAdmin?: boolean }): Promise<LegacySyllabusListItem[]> {
  const ok = await legacySyllabusEnabled();
  if (!ok) return [];

  const includeAdmin = Boolean(opts?.includeAdmin);
  const where = includeAdmin ? '' : "WHERE rating NOT LIKE 'ADM'";

  const rows = await sql.unsafe<Array<{ id: any; name: any; rating: any }>>(
    `SELECT id, name, rating FROM syllabi ${where} ${ORDER_SQL}`,
    []
  );

  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ''),
    rating: String(r.rating ?? ''),
  }));
}

export async function getLegacySyllabusTree(syllabusId: number, controllerCid: number): Promise<LegacySyllabusTree | null> {
  const ok = await legacySyllabusEnabled();
  if (!ok) return null;

  const sid = Number(syllabusId);
  if (!sid) return null;

  const sRows = await sql<Array<{ id: any; name: any; rating: any }>>`
    SELECT id, name, rating
    FROM syllabi
    WHERE id = ${sid}
    LIMIT 1
  `;

  if (!sRows.length) return null;
  const syllabus: LegacySyllabusListItem = {
    id: Number(sRows[0].id),
    name: String(sRows[0].name ?? ''),
    rating: String(sRows[0].rating ?? ''),
  };

  const sections = await sql<Array<{ id: any; name: any }>>`
    SELECT id, name
    FROM syllabi_sections
    WHERE syllabi_id = ${sid}
    ORDER BY id ASC
  `;

  const sectionIds = sections.map((s) => Number(s.id)).filter((n) => n > 0);
  const contentRows = sectionIds.length
    ? await sql<Array<{ id: any; content: any; fields: any; section_id: any }>>`
        SELECT id, content, fields, section_id
        FROM syllabi_content
        WHERE section_id IN ${sql.in(sectionIds)}
        ORDER BY section_id ASC, id ASC
      `
    : [];

  const contentIds = contentRows.map((c) => Number(c.id)).filter((n) => n > 0);

  const entries = contentIds.length
    ? await sql<Array<{ content_id: any; progress: any; observer_cid: any; updated_at: any; pref_name: any; first_name: any; last_name: any }>>`
        SELECT e.content_id, e.progress, e.observer_cid, e.updated_at,
               r.pref_name, r.first_name, r.last_name
        FROM syllabi_entries e
        LEFT JOIN roster r ON r.cid = e.observer_cid
        WHERE e.controller_cid = ${Number(controllerCid)}
          AND e.content_id IN ${sql.in(contentIds)}
        ORDER BY e.id DESC
      `
    : [];

  const entryByContent = new Map<number, LegacyEntry>();
  for (const e of entries) {
    const cid = Number(e.content_id);
    if (!cid || entryByContent.has(cid)) continue;
    const observerCid = e.observer_cid != null ? Number(e.observer_cid) : null;
    const observerName = observerCid ? rosterDisplayName(e) : null;
    entryByContent.set(cid, {
      progress: Number(e.progress ?? 0),
      observerCid,
      observerName,
      updatedAt: e.updated_at ? String(e.updated_at) : null,
    });
  }

  const bySection = new Map<number, LegacyContentRow[]>();
  for (const c of contentRows) {
    const sectionId = Number(c.section_id);
    if (!bySection.has(sectionId)) bySection.set(sectionId, []);
    bySection.get(sectionId)!.push({
      id: Number(c.id),
      content: String(c.content ?? ''),
      fields: String(c.fields ?? ''),
      entry: entryByContent.get(Number(c.id)) ?? null,
    });
  }

  const outSections: LegacySection[] = sections.map((s) => ({
    id: Number(s.id),
    name: String(s.name ?? ''),
    rows: bySection.get(Number(s.id)) ?? [],
  }));

  return { syllabus, sections: outSections };
}

function clampProgress(p: any): number {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.trunc(n)));
}

export async function upsertLegacyProgress(controllerCid: number, contentId: number, progress: number, observerCid: number): Promise<void> {
  const ok = await legacySyllabusEnabled();
  if (!ok) return;

  const cCid = Number(controllerCid);
  const cId = Number(contentId);
  if (!cCid || !cId) return;

  const prog = clampProgress(progress);

  const existing = await sql<Array<{ id: any }>>`
    SELECT id
    FROM syllabi_entries
    WHERE controller_cid = ${cCid} AND content_id = ${cId}
    ORDER BY id DESC
    LIMIT 1
  `;

  if (existing.length) {
    await sql`
      UPDATE syllabi_entries
      SET progress = ${prog}, observer_cid = ${Number(observerCid)}
      WHERE id = ${Number(existing[0].id)}
    `;
  } else {
    await sql`
      INSERT INTO syllabi_entries (controller_cid, observer_cid, progress, content_id)
      VALUES (${cCid}, ${Number(observerCid)}, ${prog}, ${cId})
    `;
  }
}

export async function deleteLegacyProgress(controllerCid: number, contentId: number): Promise<void> {
  const ok = await legacySyllabusEnabled();
  if (!ok) return;
  const cCid = Number(controllerCid);
  const cId = Number(contentId);
  if (!cCid || !cId) return;

  await sql`
    DELETE FROM syllabi_entries
    WHERE controller_cid = ${cCid} AND content_id = ${cId}
  `;
}
