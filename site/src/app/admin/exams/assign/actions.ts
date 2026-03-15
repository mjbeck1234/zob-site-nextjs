'use server';

import { redirect } from 'next/navigation';

import { requireExamsManager } from '@/lib/auth/guards';
import { sql } from '@/lib/db';

function toYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function assignExamAction(formData: FormData) {
  // NOTE: requireExamsManager() is built on getUser(), which supports auth-bypass/dev users.
  // getSessionUser() can be null in bypass mode, so we use the guard return as the actor.
  const me = await requireExamsManager();
  if (!me?.cid) throw new Error('Not authenticated');

  const examId = Number(formData.get('exam_id'));
  const controllerCid = Number(formData.get('controller_cid'));

  // Default expiry: +30 days (user requirement)
  const expiryRaw = String(formData.get('expiry_date') ?? '').trim();
  const expiryDateStr = expiryRaw || toYmd(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  // exam_assignments.expiry_date is DATETIME (NOT NULL) in your schema.
  // Store as end-of-day.
  const expiryDatetime = `${expiryDateStr} 23:59:59`;

  if (!Number.isFinite(examId) || examId <= 0) throw new Error('Invalid exam id');
  if (!Number.isFinite(controllerCid) || controllerCid <= 0) throw new Error('Invalid controller CID');

  // Your schema requires observer_cid and expiry_date (NOT NULL)
  await sql`
    INSERT INTO exam_assignments (exam_id, controller_cid, observer_cid, expiry_date)
    VALUES (${examId}, ${controllerCid}, ${me.cid}, ${expiryDatetime})
  `;

  redirect('/admin/exams?assigned=1');
}
