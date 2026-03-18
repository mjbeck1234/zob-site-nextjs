import 'server-only';

import mysql, { Pool, PoolConnection } from 'mysql2/promise';

/**
 * Lightweight MySQL adapter that mimics the subset of postgres.js used in this codebase:
 * - template tag: await sql`SELECT ... WHERE id = ${id}`
 * - sql.unsafe(queryWith$1, params)
 * - sql.json(value)
 * - sql.in(values) for "IN (...)"
 * - sql(rows, 'colA', 'colB') for bulk insert VALUES
 * - sql.begin(async (tx) => { ... }) for transactions
 *
 * It also emulates Postgres-style "RETURNING" by running a follow-up SELECT when possible.
 */

type SQLPrimitive =
  | string
  | number
  | boolean
  | null
  | Date
  | Buffer
  | Uint8Array;

type SQLValue = SQLPrimitive | SQLFragment;

class SQLFragment {
  text: string;
  values: any[];

  constructor(text: string, values: any[] = []) {
    this.text = text;
    this.values = values;
  }
}

class SQLQuery<T = any> extends SQLFragment implements PromiseLike<T> {
  private executor: () => Promise<any>;

  constructor(text: string, values: any[], executor: () => Promise<any>) {
    super(text, values);
    this.executor = executor;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.executor().then(onfulfilled as any, onrejected as any);
  }
}

function getPool(): Pool {
  const globalAny = globalThis as any;
  if (globalAny.__ZOB_MYSQL_POOL__) return globalAny.__ZOB_MYSQL_POOL__ as Pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL. Example: mysql://user:pass@host:3306/dbname');
  }

  const u = new URL(url);
  const database = u.pathname.replace(/^\//, '');
  const pool = mysql.createPool({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? '10'),
    queueLimit: 0,
    // Safer defaults for this app:
    timezone: 'Z',
    dateStrings: true, // return DATETIME/DATE as strings
    supportBigNumbers: true,
    bigNumberStrings: true,
    // NOTE: enable ssl via DATABASE_SSL=true if needed (e.g., managed MySQL)
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  });

  // Reuse across hot reloads in dev:
  globalAny.__ZOB_MYSQL_POOL__ = pool;
  return pool;
}

function isTemplateStringsArray(x: any): x is TemplateStringsArray {
  return Array.isArray(x) && Object.prototype.hasOwnProperty.call(x, 'raw');
}

function buildFromTemplate(strings: TemplateStringsArray, values: any[]): SQLFragment {
  let text = '';
  const outValues: any[] = [];

  for (let i = 0; i < strings.length; i++) {
    text += strings[i];

    if (i >= values.length) continue;
    const v = values[i];

    if (v instanceof SQLFragment) {
      text += v.text;
      outValues.push(...v.values);
    } else {
      text += '?';
      outValues.push(v);
    }
  }

  return new SQLFragment(text, outValues);
}

function buildBulkValues(rows: Array<Record<string, any>>, cols: string[]): SQLFragment {
  if (!rows.length || !cols.length) return new SQLFragment('(NULL)', []);

  // Match postgres.js helper semantics:
  //   sql(rows, 'a', 'b') -> (`a`,`b`) VALUES (?,?), (?,?) ...
  // so callers can write: `INSERT INTO table ${sql(rows, 'a','b')}`.
  const colList = cols.map((c) => `\`${c}\``).join(', ');
  const placeholdersPerRow = `(${cols.map(() => '?').join(', ')})`;
  const valuesList = rows.map(() => placeholdersPerRow).join(', ');
  const text = `(${colList}) VALUES ${valuesList}`;

  const values: any[] = [];
  for (const row of rows) {
    for (const c of cols) values.push((row as any)[c] ?? null);
  }
  return new SQLFragment(text, values);
}

function convertDollarParamsToQMarks(query: string, params: any[]): { text: string; values: any[] } {
  // Replace $1, $2, ... with ? and reorder values in numeric order.
  // This is intentionally simple; it assumes $n are not used inside SQL string literals.
  const used: number[] = [];
  const text = query.replace(/\$(\d+)/g, (_m, nStr) => {
    const n = Number(nStr);
    if (Number.isFinite(n) && n > 0) used.push(n);
    return '?';
  });

  // If the query references params in-order (common), keep as-is.
  // Otherwise, reorder by first occurrence.
  const values =
    used.length && Math.max(...used) <= params.length
      ? used.map((n) => params[n - 1])
      : params;

  return { text, values };
}

function stripCreateIndexIfNotExists(query: string): string {
  return query
    .replace(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+/gi, 'CREATE UNIQUE INDEX ')
    .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+/gi, 'CREATE INDEX ');
}

function inlinePreparedNumericClauses(text: string, values: any[]): { text: string; values: any[] } {
  if (!/\b(?:LIMIT|OFFSET)\s+\?/i.test(text)) return { text, values };

  let out = '';
  const nextValues: any[] = [];
  let valueIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '?') {
      out += ch;
      continue;
    }

    const value = values[valueIndex++];
    const prefix = out.replace(/\s+$/g, '');
    const isLimitOrOffset = /\b(?:LIMIT|OFFSET)$/i.test(prefix);

    if (isLimitOrOffset) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid numeric SQL clause value: ${value}`);
      }
      out += String(Math.floor(n));
    } else {
      out += '?';
      nextValues.push(value);
    }
  }

  return { text: out, values: nextValues };
}

async function runQuery<T>(conn: Pool | PoolConnection, q: SQLFragment): Promise<any> {
  // Normalize a few Postgres-ish syntaxes that show up in this repo.
  let text = q.text.trim().replace(/;+\s*$/, '');
  text = stripCreateIndexIfNotExists(text);

  // Emulate RETURNING for common cases (id / *). MySQL doesn't support it universally.
  const returningMatch = text.match(/\sRETURNING\s+(.+)$/i);
  if (returningMatch) {
    const returning = returningMatch[1].trim();
    const base = text.replace(/\sRETURNING\s+.+$/i, '').trim();

    const verb = base.split(/\s+/)[0]?.toUpperCase();
    if (verb === 'INSERT') {
      const [res] = await (conn as any).execute(base, q.values);
      const insertId = (res as any)?.insertId;

      if (/^\*$/i.test(returning)) {
        const tm = base.match(/INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?/i);
        if (tm && insertId) {
          const table = tm[1];
          const [rows] = await (conn as any).execute(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [insertId]);
          return rows;
        }
        return [];
      }

      if (/^id$/i.test(returning) || /^`?id`?$/i.test(returning)) {
        return [{ id: insertId }];
      }

      // Fallback
      return [];
    }

    if (verb === 'UPDATE') {
      const [res] = await (conn as any).execute(base, q.values);

      if (/^\*$/i.test(returning)) {
        // Heuristic: if the query uses WHERE id = ?, id is usually the last param in this codebase.
        const hasWhereId = /WHERE\s+`?id`?\s*=\s*\?/i.test(base);
        const id = hasWhereId ? q.values[q.values.length - 1] : null;
        const tm = base.match(/UPDATE\s+`?([a-zA-Z0-9_]+)`?/i);
        if (tm && id != null) {
          const table = tm[1];
          const [rows] = await (conn as any).execute(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [id]);
          return rows;
        }
      }

      // If caller asked for something else, we can't reliably emulate.
      return res;
    }

    // Default: run without RETURNING.
    return (conn as any).execute(base, q.values);
  }

  try {
    const normalized = inlinePreparedNumericClauses(text, q.values);
    const [rows] = await (conn as any).execute(normalized.text, normalized.values);
    return rows;
  } catch (err: any) {
    // Optional server log (enable with DB_DEBUG=true). We keep this quiet by default
    // because dev overlays can be noisy when the DB is intentionally offline.
    if (process.env.DB_DEBUG === 'true') {
      try {
        console.error('DB query failed', { code: err?.code, errno: err?.errno, message: err?.message, sql: text });
      } catch {
        // ignore
      }
    }
    // Make CREATE INDEX idempotent-ish (MySQL lacks IF NOT EXISTS).
    const code = String(err?.code ?? '');
    const errno = Number(err?.errno ?? 0);

    if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(text)) {
      // ER_DUP_KEYNAME (1061) or ER_DUP_ENTRY (1062) etc
      if (errno === 1061 || code === 'ER_DUP_KEYNAME') return [];
    }

    throw err;
  }
}

type SqlTag = {
  <T = any>(strings: TemplateStringsArray, ...values: SQLValue[]): SQLQuery<T>;
  // bulk values helper: sql(rows, 'col1', 'col2')
  (rows: Array<Record<string, any>>, ...cols: string[]): SQLFragment;

  unsafe<T = any>(query: string, params?: any[]): SQLQuery<T>;
  json(value: any): any;
  in(values: any[]): SQLFragment;
  begin<T>(fn: (tx: SqlTag) => Promise<T>): Promise<T>;
};

function createSqlTag(conn?: PoolConnection): SqlTag {
  const pool = getPool();

  const tag: any = (first: any, ...rest: any[]) => {
    // bulk: sql(rows, 'a','b')
    if (Array.isArray(first) && !isTemplateStringsArray(first)) {
      const rows = first as Array<Record<string, any>>;
      const cols = rest as string[];
      return buildBulkValues(rows, cols);
    }

    // template tag usage
    const strings = first as TemplateStringsArray;
    const frag = buildFromTemplate(strings, rest);

    return new SQLQuery<any>(frag.text, frag.values, async () => {
      const runner = conn ?? pool;
      return await runQuery(runner as any, frag);
    });
  };

  tag.unsafe = <T = any>(query: string, params: any[] = []) => {
    const converted = convertDollarParamsToQMarks(query, params);
    const frag = new SQLFragment(converted.text, converted.values);
    return new SQLQuery<any>(frag.text, frag.values, async () => {
      const runner = conn ?? pool;
      return await runQuery(runner as any, frag);
    });
  };

  tag.json = (value: any) => JSON.stringify(value ?? null);

  tag.in = (values: any[]) => {
    const arr = Array.isArray(values) ? values : [];
    if (!arr.length) return new SQLFragment('(NULL)', []);
    return new SQLFragment(`(${arr.map(() => '?').join(', ')})`, arr);
  };

  tag.begin = async <T>(fn: (tx: SqlTag) => Promise<T>): Promise<T> => {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      const tx = createSqlTag(c);
      const out = await fn(tx);
      await c.commit();
      return out;
    } catch (e) {
      try {
        await c.rollback();
      } catch {
        // ignore
      }
      throw e;
    } finally {
      c.release();
    }
  };

  return tag as SqlTag;
}

export const sql: SqlTag = createSqlTag();
