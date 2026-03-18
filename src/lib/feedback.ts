import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';

export type FeedbackStatus = 'pending' | 'approved' | 'rejected';
export type FeedbackRow = Record<string, any> & { status?: FeedbackStatus };

export async function feedbackEnabled(): Promise<boolean> {
  return (await tableExists('feedback').catch(() => false)) === true;
}

function statusFromApprovedVal(v: any): FeedbackStatus {
  // Supports both modern tri-state booleans and existing Yes/No strings.
  if (v === true) return 'approved';
  if (v === false) return 'rejected';
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'yes' || s === 'y' || s === 'approved' || s === 'true' || s === '1') return 'approved';
  if (s === 'no' || s === 'n' || s === 'rejected' || s === 'false' || s === '0') return 'rejected';
  return 'pending';
}

function approvedValFromStatus(s: FeedbackStatus): boolean | null {
  if (s === 'approved') return true;
  if (s === 'rejected') return false;
  return null;
}

async function approvedMode(): Promise<'boolean' | 'yesno' | 'none'> {
  return 'yesno';
}

function normalizeCreatedAt(r: FeedbackRow, hasCreatedAt: boolean, hasTimeAdded: boolean): FeedbackRow {
  if (hasCreatedAt) return r;
  if (hasTimeAdded && (r as any).time_added && !(r as any).created_at) {
    return { ...(r as any), created_at: (r as any).time_added } as FeedbackRow;
  }
  return r;
}

export async function getFeedbackById(id: number): Promise<FeedbackRow | null> {
  const ok = await feedbackEnabled();
  if (!ok) return null;

  const hasApproved = true;
  const hasCreatedAt = false;
  const hasTimeAdded = true;
  const rows = await sql<FeedbackRow[]>`SELECT * FROM feedback WHERE id = ${id} LIMIT 1`;
  const row = rows[0] as FeedbackRow | undefined;
  if (!row) return null;

  const normalized = normalizeCreatedAt(row, hasCreatedAt, hasTimeAdded);

  return {
    ...normalized,
    status: hasApproved ? statusFromApprovedVal((row as any).approved) : 'pending',
  };
}

export async function listFeedback(params?: {
  status?: FeedbackStatus | 'all';
  controllerCid?: number;
  limit?: number;
}): Promise<FeedbackRow[]> {
  const ok = await feedbackEnabled();
  if (!ok) return [];

  const status = params?.status ?? 'all';
  const controllerCid = params?.controllerCid;
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);

  const hasApproved = true;
  const hasControllerCid = true;
  const hasCreatedAt = false;
  const hasTimeAdded = true;
  const mode = hasApproved ? await approvedMode() : 'none';

  const where: string[] = [];
  const values: any[] = [];

  if (hasControllerCid && typeof controllerCid === 'number' && Number.isFinite(controllerCid)) {
    values.push(controllerCid);
    where.push(`controller_cid = $${values.length}`);
  }

  if (hasApproved && status !== 'all') {
    if (mode === 'boolean') {
      if (status === 'pending') where.push('approved IS NULL');
      else if (status === 'approved') where.push('approved = true');
      else where.push('approved = false');
    } else if (mode === 'yesno') {
      if (status === 'approved') where.push("approved = 'Yes'");
      else if (status === 'rejected') where.push("approved = 'No'");
      else where.push("approved NOT IN ('Yes','No')");
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = hasCreatedAt ? 'ORDER BY created_at DESC' : hasTimeAdded ? 'ORDER BY time_added DESC' : 'ORDER BY id DESC';
  const q = `SELECT * FROM feedback ${whereSql} ${orderSql} LIMIT ${limit}`;

  const rows = await sql.unsafe<FeedbackRow[]>(q, values);

  return rows.map((r) => {
    const normalized = normalizeCreatedAt(r, hasCreatedAt, hasTimeAdded);
    return {
      ...normalized,
      status: hasApproved ? statusFromApprovedVal((r as any).approved) : 'pending',
    };
  });
}

export async function listApprovedFeedbackForControllerCid(controllerCid: number): Promise<FeedbackRow[]> {
  const ok = await feedbackEnabled();
  if (!ok) return [];

  const hasApproved = true;
  const hasControllerCid = true;
  const hasCreatedAt = false;
  const hasTimeAdded = true;
  const orderSql = hasCreatedAt ? 'created_at DESC' : hasTimeAdded ? 'time_added DESC' : 'id DESC';

  if (!hasApproved) {
    // If the install lacks moderation columns, don't expose anything in profiles.
    return [];
  }

  const mode = await approvedMode();
  const cidStr = String(controllerCid);
  const q =
    mode === 'yesno'
      ? `SELECT * FROM feedback WHERE controller_cid = $1 AND approved = 'Yes' ORDER BY ${orderSql} LIMIT 200`
      : `SELECT * FROM feedback WHERE controller_cid = $1 AND approved = true ORDER BY ${orderSql} LIMIT 200`;
  const rows = await sql.unsafe<FeedbackRow[]>(q, [cidStr]);
  return rows.map((r) => ({ ...normalizeCreatedAt(r, hasCreatedAt, hasTimeAdded), status: 'approved' }));
}

export async function setFeedbackStatus(id: number, status: FeedbackStatus): Promise<void> {
  const ok = await feedbackEnabled();
  if (!ok) throw new Error('Feedback table is not enabled.');

  const mode = await approvedMode();
  const hasUpdatedAt = false;

  if (mode === 'yesno') {
    const val = status === 'approved' ? 'Yes' : 'No';
    if (hasUpdatedAt) {
      await sql`UPDATE feedback SET approved = ${val}, updated_at = NOW() WHERE id = ${id}`;
    } else {
      await sql`UPDATE feedback SET approved = ${val} WHERE id = ${id}`;
    }
    return;
  }

  const val = approvedValFromStatus(status);
  if (hasUpdatedAt) {
    await sql`UPDATE feedback SET approved = ${val}, updated_at = NOW() WHERE id = ${id}`;
  } else {
    await sql`UPDATE feedback SET approved = ${val} WHERE id = ${id}`;
  }
}

export async function setFeedbackToPendingOnCreate(): Promise<boolean> {
  // Helper for callers: returns whether we can store pending (approved NULL).
  const ok = await feedbackEnabled();
  if (!ok) return false;
  const mode = await approvedMode();
  return mode === 'boolean';
}
