'use server';

import { redirect } from 'next/navigation';
import { requireFlightDataPracticeManager } from '@/lib/auth/guards';
import { createFDPCase, updateFDPCase, deleteFDPCase } from '@/lib/flightDataPractice';

function s(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim();
}

function n(v: FormDataEntryValue | null): number | null {
  const raw = s(v);
  if (!raw) return null;
  const num = Number.parseInt(raw, 10);
  if (!Number.isFinite(num)) return null;
  return num;
}

function b(v: FormDataEntryValue | null): boolean {
  const raw = s(v).toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

export async function createFDPCaseAction(formData: FormData) {
  const user = await requireFlightDataPracticeManager();

  const dep = s(formData.get('dep'));
  const arr = s(formData.get('arr'));
  if (!dep || !arr) {
    redirect('/admin/flight-data-practice?error=missing');
  }

  const id = await createFDPCase({
    title: s(formData.get('title')) || null,
    callsign: s(formData.get('callsign')) || 'DCM104',
    ac_type: s(formData.get('ac_type')) || 'B738/W',
    flight_rules: s(formData.get('flight_rules')) || 'IFR',
    dep,
    arr,
    bad_cruise_alt: formData.has('bad_cruise_alt') ? n(formData.get('bad_cruise_alt')) : null,
    bad_route: formData.has('bad_route') ? (s(formData.get('bad_route')) || null) : null,
    bad_remarks: formData.has('bad_remarks') ? (s(formData.get('bad_remarks')) || null) : null,
    good_cruise_alt: n(formData.get('good_cruise_alt')),
    good_route: s(formData.get('good_route')) || null,
    good_remarks: formData.has('good_remarks') ? (s(formData.get('good_remarks')) || null) : null,
    published: formData.has('published') ? b(formData.get('published')) : true,
    created_by: user.cid,
  });

  redirect(`/admin/flight-data-practice/${id}?saved=1`);
}

export async function updateFDPCaseAction(formData: FormData) {
  await requireFlightDataPracticeManager();

  const id = Number.parseInt(s(formData.get('id')), 10);
  if (!Number.isFinite(id)) {
    redirect('/admin/flight-data-practice?error=invalid');
  }

  const patch: Parameters<typeof updateFDPCase>[1] = {
    title: s(formData.get('title')) || null,
    callsign: s(formData.get('callsign')) || 'DCM104',
    ac_type: s(formData.get('ac_type')) || 'B738/W',
    flight_rules: s(formData.get('flight_rules')) || 'IFR',
    dep: s(formData.get('dep')),
    arr: s(formData.get('arr')),
    good_cruise_alt: n(formData.get('good_cruise_alt')),
    good_route: s(formData.get('good_route')) || null,
  };

  if (formData.has('bad_cruise_alt')) patch.bad_cruise_alt = n(formData.get('bad_cruise_alt'));
  if (formData.has('bad_route')) patch.bad_route = s(formData.get('bad_route')) || null;
  if (formData.has('bad_remarks')) patch.bad_remarks = s(formData.get('bad_remarks')) || null;
  if (formData.has('good_remarks')) patch.good_remarks = s(formData.get('good_remarks')) || null;
  if (formData.has('published')) patch.published = b(formData.get('published'));

  await updateFDPCase(id, patch);

  redirect(`/admin/flight-data-practice/${id}?saved=1`);
}

export async function deleteFDPCaseAction(formData: FormData) {
  await requireFlightDataPracticeManager();
  const id = Number.parseInt(s(formData.get('id')), 10);
  if (!Number.isFinite(id)) {
    redirect('/admin/flight-data-practice?error=invalid');
  }
  await deleteFDPCase(id);
  redirect('/admin/flight-data-practice?deleted=1');
}