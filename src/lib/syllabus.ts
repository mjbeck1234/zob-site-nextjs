import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { SYLLABUS_TEMPLATES, allSyllabusItemIds } from '@/lib/syllabusTemplate';

export type SyllabusItemStatus = {
  done: boolean;
  doneAt: string | null;
  notes: string;
};

export type SyllabusDoc = {
  version: 1;
  statuses: Record<string, SyllabusItemStatus>;
  generalNotes: string;
};

export type SyllabusRow = {
  student_cid: number;
  data_json: string;
  updated_by: number | null;
  updated_at: string | null;
  created_at: string | null;
};

export function defaultSyllabusDoc(): SyllabusDoc {
  const statuses: Record<string, SyllabusItemStatus> = {};
  for (const id of allSyllabusItemIds()) {
    statuses[id] = { done: false, doneAt: null, notes: '' };
  }
  return { version: 1, statuses, generalNotes: '' };
}

function coerceDoc(raw: unknown): SyllabusDoc {
  const base = defaultSyllabusDoc();
  if (!raw || typeof raw !== 'object') return base;

  const v = raw as any;
  const out: SyllabusDoc = {
    version: 1,
    statuses: { ...base.statuses },
    generalNotes: String(v.generalNotes ?? '').slice(0, 8000),
  };

  // Merge known item ids; ignore unknown keys.
  const inStatuses = v.statuses && typeof v.statuses === 'object' ? v.statuses : null;
  if (inStatuses) {
    for (const id of Object.keys(out.statuses)) {
      const s = inStatuses[id];
      if (!s || typeof s !== 'object') continue;
      out.statuses[id] = {
        done: Boolean(s.done),
        doneAt: s.doneAt ? String(s.doneAt) : null,
        notes: String(s.notes ?? '').slice(0, 4000),
      };
    }
  }
  return out;
}

export async function syllabusEnabled(): Promise<boolean> {
  return await tableExists('training_syllabus').catch(() => false);
}

export async function getSyllabusDoc(studentCid: number): Promise<{ doc: SyllabusDoc; meta: Pick<SyllabusRow, 'updated_by' | 'updated_at' | 'created_at'> | null }> {
  const ok = await syllabusEnabled();
  if (!ok) {
    return { doc: defaultSyllabusDoc(), meta: null };
  }

  const rows = await sql<SyllabusRow[]>`
    SELECT student_cid, data_json, updated_by, updated_at, created_at
    FROM training_syllabus
    WHERE student_cid = ${studentCid}
    LIMIT 1
  `;
  const row = rows?.[0] ?? null;
  if (!row) return { doc: defaultSyllabusDoc(), meta: null };

  let parsed: any = null;
  try {
    parsed = JSON.parse(String(row.data_json ?? ''));
  } catch {
    parsed = null;
  }
  return { doc: coerceDoc(parsed), meta: { updated_by: row.updated_by ?? null, updated_at: row.updated_at ?? null, created_at: row.created_at ?? null } };
}

export async function upsertSyllabusDoc(studentCid: number, doc: SyllabusDoc, updatedByCid: number): Promise<void> {
  const ok = await syllabusEnabled();
  if (!ok) return;
  const json = JSON.stringify(doc);
  await sql`
    INSERT INTO training_syllabus (student_cid, data_json, updated_by, updated_at)
    VALUES (${studentCid}, ${json}, ${updatedByCid}, NOW())
    ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_by = VALUES(updated_by), updated_at = NOW()
  `;
}

export { SYLLABUS_TEMPLATES };
