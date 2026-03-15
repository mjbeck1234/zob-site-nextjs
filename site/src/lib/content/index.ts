import { tableHasColumn, tableExists } from '@/lib/schema';
import { selectAll } from '@/lib/query';
import { getUpcomingPublishedEvents } from '@/lib/events';
import { sql } from '@/lib/db';
import { insertDynamic } from '@/lib/admin/crud';

export async function getNotices(limit = 5) {
  const hasPublished = await tableHasColumn('notices', 'published').catch(() => false);
  const hasArchived = await tableHasColumn('notices', 'archived').catch(() => false);
  const hasCreatedAt = await tableHasColumn('notices', 'created_at').catch(() => false);
  const hasDate = await tableHasColumn('notices', 'date').catch(() => false);

  const where: string[] = [];
  if (hasPublished) where.push(`published = TRUE`);
  if (hasArchived) where.push(`archived = FALSE`);

  const orderBy = hasCreatedAt ? `created_at DESC` : hasDate ? `date DESC` : `id DESC`;

  return selectAll('notices', {
    whereSql: where.length ? where.join(' AND ') : undefined,
    orderBySql: orderBy,
    limit,
  });
}

export async function getUpcomingEvents(limit = 6) {
  // Prefer the ui-aware events library so ordering and date filtering match the old site.
  const exists = await tableExists('events').catch(() => false);
  if (!exists) return [];

  // getUpcomingPublishedEvents already filters to published, non-archived, from today onward (when existing columns exist)
  const rows = await getUpcomingPublishedEvents(Math.min(Math.max(limit, 1), 50)).catch(() => [] as any[]);
  return rows.slice(0, limit);
}

export async function getDownloadsByCategory(category?: string) {
  const hasCategory = await tableHasColumn('downloads', 'category').catch(() => false);
  const hasUploadDate = await tableHasColumn('downloads', 'upload_date').catch(() => false);

  return selectAll('downloads', {
    whereSql: hasCategory && category ? `category = ?` : undefined,
    params: hasCategory && category ? [category] : undefined,
    orderBySql: hasUploadDate ? 'upload_date DESC' : 'id DESC',
    limit: 200,
  });
}

export async function getRoster() {
  const hasLastName = await tableHasColumn('roster', 'last_name').catch(() => false);
  const orderBy = hasLastName ? 'last_name ASC' : 'id ASC';
  return selectAll('roster', { orderBySql: orderBy, limit: 2000 });
}

/**
 * Fetch a single roster entry by CID.
 * Used by widgets that need to resolve CID -> name.
 */
export async function getRosterEntryByCid(cid: number) {
  const rows = await selectAll('roster', {
    whereSql: 'cid = ?',
    params: [Number(cid)],
    limit: 1,
  }).catch(() => [] as any[]);
  return rows?.[0] ?? null;
}

export async function getStaff() {
  const exists = await tableExists('staff').catch(() => false);
  if (!exists) return [];

  const hasRole = await tableHasColumn('staff', 'role').catch(() => false);
  const orderBy = hasRole ? 'role ASC' : 'id ASC';
  return selectAll('staff', { orderBySql: orderBy, limit: 2000 }).catch(() => [] as any[]);
}

export async function getRoutes(arrival?: string) {
  const hasArr = await tableHasColumn('routes', 'arr').catch(() => false);
  if (hasArr && arrival) {
    return selectAll('routes', {
      whereSql: 'arr = ?',
      params: [arrival.toUpperCase()],
      orderBySql: 'id DESC',
      limit: 200,
    });
  }
  return selectAll('routes', { orderBySql: 'id DESC', limit: 200 });
}

export async function getSplits() {
  const hasCreatedAt = await tableHasColumn('splits', 'created_at').catch(() => false);
  // Return all splits rows (each callsign/frequency/type row describes the sectors it covers).
  // The public map page groups these into High/Low maps.
  return selectAll('splits', { orderBySql: hasCreatedAt ? 'created_at DESC' : 'id DESC', limit: 500 });
}

export async function getSplitsForActiveSelection(): Promise<{ rows: any[]; selection: ActiveSplitSelection }> {
  const selection = await getActiveSplitSelection();

  // If a preset is active and the split_presets table exists, use preset rows JSON.
  if (selection.mode === 'preset' && selection.presetId) {
    let hasPresets = false;
    try {
      hasPresets = await tableExists('split_presets');
    } catch {
      hasPresets = false;
    }

    if (hasPresets) {
      try {
        const pres = await selectAll('split_presets', { whereSql: 'id = ?', params: [selection.presetId], limit: 1 });
        const presetRows = pres?.[0]?.rows;
        const rows = coerceJsonArray(presetRows);
        if (rows && rows.length) {
          return { rows, selection };
        }
      } catch {
        // fall through to live rows
      }
    }
  }

  // Default: live rows from splits table
  const rows = await getSplits();
  return { rows, selection };
}



export type ActiveSplitMode = 'live' | 'preset';

export type ActiveSplitSelection = {
  mode: ActiveSplitMode;
  presetId: number | null;
  presetName?: string | null;
};

export type SplitPreset = {
  id: number;
  name: string;
  rows: any[];
  createdAt?: string | null;
  createdBy?: string | null;
};

function coerceJsonArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  // postgres.js usually decodes JSONB automatically, but keep this defensive
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  // Some adapters return { rows: [...] }
  if (typeof v === 'object' && Array.isArray((v as any).rows)) return (v as any).rows;
  return [];
}

export async function getActiveSplitSelection(): Promise<ActiveSplitSelection> {
  const hasActive = await tableExists('split_active').catch(() => false);
  const hasPresets = await tableExists('split_presets').catch(() => false);

  if (!hasActive) return { mode: 'live', presetId: null };

  const rows = await selectAll('split_active', { orderBySql: 'id ASC', limit: 1 }).catch(() => []);
  const r: any = rows?.[0] ?? {};

  const mode: ActiveSplitMode = String(r?.mode ?? 'live').toLowerCase() === 'preset' ? 'preset' : 'live';
  const presetIdRaw = r?.preset_id;
  const presetId = presetIdRaw === null || presetIdRaw === undefined ? null : Number(presetIdRaw);

  let presetName: string | null = null;
  if (mode === 'preset' && presetId && hasPresets) {
    const pres = await selectAll('split_presets', { whereSql: 'id = ?', params: [presetId], limit: 1 }).catch(() => []);
    presetName = pres?.[0]?.name ? String(pres[0].name) : null;
  }

  return { mode, presetId, presetName };
}

export type NoticeRow = {
  id: number;
  title: string;
  body: string;
  created_at?: any;
  updated_at?: any;
  published?: any;
  archived?: any;
};

export async function getNoticeById(id: number) {
  const hasPublished = await tableHasColumn('notices', 'published').catch(() => false);
  const hasArchived = await tableHasColumn('notices', 'archived').catch(() => false);

  const where = ['id = ?'];
  const params: any[] = [Number(id)];
  if (hasPublished) where.push('published = TRUE');
  if (hasArchived) where.push('archived = FALSE');

  const rows = await selectAll('notices', {
    whereSql: where.join(' AND '),
    params,
    limit: 1,
  }).catch(() => [] as any[]);

  return (rows?.[0] ?? null) as NoticeRow | null;
}

export async function getSplitPresets(): Promise<SplitPreset[]> {
  const hasPresets = await tableExists('split_presets').catch(() => false);
  if (!hasPresets) return [];

  const rows = await selectAll('split_presets', { orderBySql: 'id DESC', limit: 200 }).catch(() => []);
  return (rows ?? []).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name ?? `Preset ${r.id}`),
    rows: coerceJsonArray(r.rows),
    createdAt: r.created_at ? String(r.created_at) : null,
    createdBy: r.created_by ? String(r.created_by) : null,
  }));
}

// -----------------------------
// Feedback / Visit Requests
// -----------------------------

export async function createFeedback(args: {
  pilotCid: number;
  pilotName?: string | null;
  pilotEmail?: string | null;
  controllerCid?: number | null;
  controllerName?: string | null;
  controllerEmail?: string | null;
  posCategory?: string | null;
  serviceLevel?: string | null;
  // Numeric rating support.
  rating?: number | null;
  comments?: string | null;
}): Promise<any> {
  const ok = await tableExists('feedback');
  if (!ok) throw new Error('feedback table is missing');

  const pilotCid = Number(args.pilotCid);
  if (!Number.isFinite(pilotCid) || pilotCid <= 0) throw new Error('invalid pilotCid');

  const pilotName = args.pilotName != null ? String(args.pilotName) : null;
  const pilotEmail = args.pilotEmail != null ? String(args.pilotEmail) : null;
  const controllerCid = args.controllerCid != null ? Number(args.controllerCid) : null;
  const controllerName = args.controllerName != null ? String(args.controllerName) : null;
  const controllerEmail = args.controllerEmail != null ? String(args.controllerEmail) : null;
  const posCategory = args.posCategory != null ? String(args.posCategory) : null;
  const serviceLevel = args.serviceLevel != null ? String(args.serviceLevel) : null;
  const rating = args.rating != null ? Number(args.rating) : null;
  const comments = args.comments != null ? String(args.comments) : null;

  const record: any = {
    // New schema (see sql/create_tables_feedback.sql)
    pilot_cid: pilotCid,
    pilot_name: pilotName,
    pilot_email: pilotEmail,
    controller_cid: controllerCid,
    controller_name: controllerName,
    controller_email: controllerEmail,
    pos_category: posCategory,
    service_level: serviceLevel,
    comments,

    // Stored schema compatibility
    cid: pilotCid,
    position: posCategory,
    rating,
  };

  return await insertDynamic('feedback', record);
}

export async function createVisitRequest(args: {
  cid: number;
  fullName?: string | null;
  email?: string | null;
  rating?: string | null;
  homeFacility?: string | null;
  reason?: string | null;
}): Promise<{ id: number } | null> {
  // This table is optional and may vary across installs. We'll try a few common names.
  const candidates = ['visit_requests', 'visit_request', 'visiting_requests', 'visits'];
  let table: string | null = null;
  for (const t of candidates) {
    const exists = await tableExists(t).catch(() => false);
    if (exists) {
      table = t;
      break;
    }
  }
  if (!table) {
    // Graceful no-op so the page can still build/deploy without the current table.
    return null;
  }

  const cid = Number(args.cid);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error('Invalid cid');

  const fullName = (args.fullName ?? '').toString().trim() || null;
  const email = (args.email ?? '').toString().trim() || null;
  const rating = (args.rating ?? '').toString().trim() || null;
  const homeFacility = (args.homeFacility ?? '').toString().trim() || null;
  const reason = (args.reason ?? '').toString().trim() || null;

  // Try flexible inserts based on available columns.
  const hasFullName = await tableHasColumn(table, 'full_name').catch(() => false);
  const hasEmail = await tableHasColumn(table, 'email').catch(() => false);
  const hasRating = await tableHasColumn(table, 'rating').catch(() => false);
  const hasHome = await tableHasColumn(table, 'home_facility').catch(() => false);
  const hasReason = await tableHasColumn(table, 'reason').catch(() => false);

  const cols: string[] = ['cid'];
  const vals: any[] = [cid];

  if (hasFullName) {
    cols.push('full_name');
    vals.push(fullName);
  }
  if (hasEmail) {
    cols.push('email');
    vals.push(email);
  }
  if (hasRating) {
    cols.push('rating');
    vals.push(rating);
  }
  if (hasHome) {
    cols.push('home_facility');
    vals.push(homeFacility);
  }
  if (hasReason) {
    cols.push('reason');
    vals.push(reason);
  }

  // Build a parameterized INSERT with postgres.js template tag.
  // Unfortunately, postgres.js doesn't allow dynamic identifiers in the template tag.
  // We'll use a tiny safe escape for the table/column names, and values remain parameterized.
  const safeIdent = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '');
  const tableSql = safeIdent(table);
  const colsSql = cols.map(safeIdent).join(', ');
  const placeholders = cols.map(() => '?').join(', ');

  // Use sql.unsafe for dynamic identifiers; values remain parameterized.
  await sql.unsafe(
    `INSERT INTO ${tableSql} (${colsSql}) VALUES (${placeholders})`,
    vals,
  );

  // Best-effort fetch of the most recent row for this CID.
  const out: any[] = await sql.unsafe(
    `SELECT id FROM ${tableSql} WHERE cid = ? ORDER BY id DESC LIMIT 1`,
    [cid],
  );

  return out?.[0] ?? null;
}

