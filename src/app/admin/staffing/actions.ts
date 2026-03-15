'use server';

import { redirect } from 'next/navigation';
import { requireEventsManager } from '@/lib/auth/guards';
import { setStaffingRequestApproval } from '@/lib/staffing';

export async function approveStaffingRequestAction(formData: FormData) {
  await requireEventsManager();
  const id = Number(formData.get('id'));
  if (!id) redirect('/admin/staffing?error=missing-id');
  await setStaffingRequestApproval(id, '1');
  redirect('/admin/staffing?updated=1');
}

export async function denyStaffingRequestAction(formData: FormData) {
  await requireEventsManager();
  const id = Number(formData.get('id'));
  if (!id) redirect('/admin/staffing?error=missing-id');
  await setStaffingRequestApproval(id, '2');
  redirect('/admin/staffing?updated=1');
}

export async function setPendingStaffingRequestAction(formData: FormData) {
  await requireEventsManager();
  const id = Number(formData.get('id'));
  if (!id) redirect('/admin/staffing?error=missing-id');
  await setStaffingRequestApproval(id, '0');
  redirect('/admin/staffing?updated=1');
}
