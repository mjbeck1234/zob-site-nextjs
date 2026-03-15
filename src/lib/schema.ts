import { sql } from '@/lib/db';

type CacheEntry = {
  expiresAt: number;
  columnsByTable: Map<string, Set<string>>;
  dataTypeByTable: Map<string, Map<string, string>>;
};

let cache: CacheEntry | null = null;

const TTL_MS = Number(process.env.SCHEMA_CACHE_TTL_MS ?? `${5 * 60 * 1000}`); // 5 min

export async function getColumnsByTable(): Promise<Map<string, Set<string>>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.columnsByTable;

  const rows = await sql<Array<{ table_name: string; column_name: string; data_type: string }>>`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
  `;

  const map = new Map<string, Set<string>>();
  const types = new Map<string, Map<string, string>>();
  for (const r of rows) {
    const t = r.table_name;
    const c = r.column_name;
    if (!map.has(t)) map.set(t, new Set());
    map.get(t)!.add(c);

    if (!types.has(t)) types.set(t, new Map());
    types.get(t)!.set(c, String(r.data_type ?? '').toLowerCase());
  }

  cache = { expiresAt: now + TTL_MS, columnsByTable: map, dataTypeByTable: types };
  return map;
}

export async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const map = await getColumnsByTable();
  return map.get(table)?.has(column) ?? false;
}

/**
 * Convenience helper for admin UIs.
 */
export async function getTableColumns(table: string): Promise<string[]> {
  const map = await getColumnsByTable();
  return Array.from(map.get(table) ?? []);
}

export async function tableExists(table: string): Promise<boolean> {
  const map = await getColumnsByTable();
  return map.has(table);
}

/**
 * Returns the underlying MySQL information_schema data_type for a column.
 * Example: 'varchar', 'int', 'tinyint', 'timestamp', 'json', etc.
 */
export async function getColumnDataType(table: string, column: string): Promise<string | null> {
  const now = Date.now();
  if (!cache || cache.expiresAt <= now) {
    await getColumnsByTable();
  }
  const t = cache?.dataTypeByTable.get(table);
  return t?.get(column) ?? null;
}
