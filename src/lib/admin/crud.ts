import { sql } from '@/lib/db';
import { getTableColumns } from '@/lib/schema';

type Row = Record<string, any>;

function isNil(v: any) {
  return v === null || v === undefined;
}

/**
 * Best-effort insert that only includes columns that exist in the current DB.
 */
export async function insertDynamic(table: string, data: Record<string, any>): Promise<Row> {
  const available = new Set(await getTableColumns(table));
  const cols: string[] = [];
  const values: any[] = [];

  for (const [col, val] of Object.entries(data)) {
    if (typeof col !== 'string' || !col.trim()) continue;
    if (!available.has(col)) continue;
    // Allow nulls through, but ignore undefined.
    if (val === undefined) continue;
    cols.push(col);
    values.push(val);
  }

  if (cols.length === 0) {
    throw new Error(`No matching columns found for ${table}.`);
  }

  const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(',');
  const q = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`;
  const rows = await sql.unsafe<Row[]>(q, values);
  return rows[0] ?? {};
}

/**
 * Best-effort update by id that only updates columns that exist.
 */
export async function updateDynamic(table: string, id: string | number, data: Record<string, any>): Promise<Row> {
  const available = new Set(await getTableColumns(table));
  const sets: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [col, val] of Object.entries(data)) {
    if (typeof col !== 'string' || !col.trim()) continue;
    if (val === undefined) continue;
    if (!available.has(col)) continue;
    sets.push(`${col} = $${idx}`);
    values.push(val);
    idx += 1;
  }

  if (sets.length === 0) {
    // Nothing to update.
    const rows = await sql.unsafe<Row[]>(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ?? {};
  }

  values.push(id);
  const q = `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
  const rows = await sql.unsafe<Row[]>(q, values);
  return rows[0] ?? {};
}

export async function deleteById(table: string, id: string | number): Promise<void> {
  await sql.unsafe(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

export async function getById(table: string, id: string | number): Promise<Row | null> {
  const rows = await sql.unsafe<Row[]>(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function listTableColumns(table: string) {
  // Wrapped so admin pages can build UI based on actual DB.
  return getTableColumns(table);
}

// Normalizers are intentionally synchronous so callers don't accidentally
// store Promise objects ("[object Promise]") in the database.
export function normalizeBool(v: FormDataEntryValue | null) {
  if (v === null) return undefined;
  const s = String(v).toLowerCase();
  return s === 'on' || s === 'true' || s === '1' ? true : false;
}

export function normalizeDate(v: FormDataEntryValue | null) {
  if (v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  // Let Postgres parse (DATE/TIMESTAMP) when possible.
  return s;
}

export function normalizeInt(v: FormDataEntryValue | null) {
  if (v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  if (Number.isNaN(n)) return undefined;
  return n;
}

export function normalizeText(
  v: FormDataEntryValue | null,
  opts?: {
    /** Maximum length (characters) after trimming. */
    maxLen?: number;
  },
) {
  if (v === null) return undefined;
  let s = String(v).trim();
  if (!s) return undefined;

  const maxLen = opts?.maxLen;
  if (typeof maxLen === 'number' && Number.isFinite(maxLen) && maxLen > 0 && s.length > maxLen) {
    s = s.slice(0, maxLen);
  }

  return s;
}
