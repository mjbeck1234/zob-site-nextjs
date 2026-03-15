'use server';

import { redirect } from 'next/navigation';
import { requireFeedbackModerator } from '@/lib/auth/guards';
import { setFeedbackStatus } from '@/lib/feedback';

function normStatus(v: unknown): 'pending' | 'approved' | 'rejected' | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'pending' || s === 'approved' || s === 'rejected') return s;
  return null;
}

export async function setFeedbackStatusAction(formData: FormData) {
  await requireFeedbackModerator();

  const idRaw = formData.get('id')?.toString().trim();
  const status = normStatus(formData.get('status'));
  const returnStatus = normStatus(formData.get('return_status')) ?? 'all';

  const id = Number.parseInt(idRaw ?? '', 10);
  if (!Number.isFinite(id) || !status) {
    redirect(`/admin/feedback?status=${returnStatus}&error=invalid`);
  }

  await setFeedbackStatus(id, status);
  redirect(`/admin/feedback?status=${returnStatus}&saved=1`);
}
