import { sql } from '@/lib/db';

type Row = Record<string, any>;

export async function selectAll(table: string, opts?: {
  whereSql?: string;
  orderBySql?: string;
  limit?: number;
  params?: any[];
}): Promise<Row[]> {
  const where = opts?.whereSql ? ` WHERE ${opts.whereSql}` : '';
  const orderBy = opts?.orderBySql ? ` ORDER BY ${opts.orderBySql}` : '';
  const limit = typeof opts?.limit === 'number' ? ` LIMIT ${Math.max(0, opts.limit)}` : '';
  const q = `SELECT * FROM ${table}${where}${orderBy}${limit}`;
  return sql.unsafe<Row[]>(q, opts?.params ?? []);
}
