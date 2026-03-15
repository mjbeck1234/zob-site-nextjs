'use server';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { createStaffingRequest } from '@/lib/staffing';

function qp(s: string) {
  return encodeURIComponent(s);
}

export async function createStaffingRequestAction(formData: FormData) {
  const me = await getSessionUser();
  if (!me) redirect('/api/auth/login?next=/staffing');

  const pilotEmail = String(formData.get('pilot_email') ?? me.email ?? '').trim();
  const groupName = String(formData.get('group_name') ?? '').trim();
  const eventDate = String(formData.get('event_date') ?? '').trim();
  const timeStart = String(formData.get('time_start') ?? '').trim();
  const timeEnd = String(formData.get('time_end') ?? '').trim();
  const pilotCount = Number(formData.get('pilot_count') ?? 0);
  const eventBanner = String(formData.get('event_banner') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!pilotEmail || !groupName || !eventDate || !timeStart || !timeEnd || !Number.isFinite(pilotCount) || pilotCount <= 0) {
    redirect(`/staffing?error=${qp('Please fill out all required fields.')}`);
  }

  // Basic normalization for HHMM
  const timeRe = /^\d{4}$/;
  if (!timeRe.test(timeStart) || !timeRe.test(timeEnd)) {
    redirect(`/staffing?error=${qp('Time start/end must be 4 digits (HHMM) in Zulu.')}`);
  }

  try {
    await createStaffingRequest({
      pilotCid: me.cid,
      pilotFullName: me.fullName,
      pilotEmail,
      groupName,
      pilotCount,
      eventDate,
      timeStart,
      timeEnd,
      description,
      eventBanner,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? 'Failed to create staffing request.');
    // Friendly mapping for the common limit case
    if (msg.toLowerCase().includes('pending') && msg.toLowerCase().includes('limit')) {
      redirect(`/staffing?error=${qp('You already have 3 pending staffing requests. Please wait for review before submitting another.')}`);
    }
    redirect(`/staffing?error=${qp(msg)}`);
  }

  redirect('/staffing?created=1');
}
