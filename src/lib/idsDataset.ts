import 'server-only';

import { sql } from '@/lib/db';

export type IdsDatasetKey = 'apt' | 'nav' | 'fixes' | 'awy' | 'sid' | 'star' | 'faa';

export type IdsDatasetRow = {
  dataset: IdsDatasetKey;
  cycle: string;
  data: unknown;
  created_at: string;
  updated_at: string;
};

// Very small in-process cache to avoid repeatedly pulling large JSON blobs
declare global {
  // eslint-disable-next-line no-var
  var __IDS_DATASET_CACHE__:
    | Map<string, { updatedAt: number; row: IdsDatasetRow }>
    | undefined;
}

const cache = (globalThis.__IDS_DATASET_CACHE__ ??=
  new Map<string, { updatedAt: number; row: IdsDatasetRow }>());

export async function ensureIdsDatasetsTable(): Promise<void> {
  // Create table if missing (keeps deployments simple)
  await sql`
    CREATE TABLE IF NOT EXISTS ids_datasets (
      dataset VARCHAR(16) PRIMARY KEY,
      cycle VARCHAR(16) NOT NULL,
      data JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;

  try { await sql`CREATE INDEX ids_datasets_updated_at_idx ON ids_datasets (updated_at DESC);`; } catch {}
}

export async function upsertIdsDataset(args: {
  dataset: IdsDatasetKey;
  cycle: string;
  data: unknown;
}): Promise<void> {
  const { dataset, cycle, data } = args;
  await ensureIdsDatasetsTable();

  await sql`
    INSERT INTO ids_datasets (dataset, cycle, data)
    VALUES (${dataset}, ${cycle}, ${sql.json(data)})
    ON DUPLICATE KEY UPDATE
      cycle = VALUES(cycle),
      data = VALUES(data),
      updated_at = NOW();
  `;

  // bust cache entry
  cache.delete(dataset);
}

export async function getIdsDataset(dataset: IdsDatasetKey): Promise<IdsDatasetRow | null> {
  // 10 minute TTL
  const cached = cache.get(dataset);
  const now = Date.now();
  if (cached && now - cached.updatedAt < 10 * 60 * 1000) {
    return cached.row;
  }

  await ensureIdsDatasetsTable();

  const rows = await sql<IdsDatasetRow[]>`
    SELECT dataset, cycle, data, created_at, updated_at
    FROM ids_datasets
    WHERE dataset = ${dataset}
    LIMIT 1;
  `;

  const row = rows?.[0] ?? null;
  if (row) {
    cache.set(dataset, { updatedAt: now, row });
  }
  return row;
}

export async function listIdsDatasets(): Promise<Array<Pick<IdsDatasetRow, 'dataset' | 'cycle' | 'updated_at'>>> {
  await ensureIdsDatasetsTable();

  const rows = await sql<Array<Pick<IdsDatasetRow, 'dataset' | 'cycle' | 'updated_at'>>>`
    SELECT dataset, cycle, updated_at
    FROM ids_datasets
    ORDER BY dataset ASC;
  `;

  return rows ?? [];
}
