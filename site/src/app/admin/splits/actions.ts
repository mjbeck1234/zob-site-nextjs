'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { deleteById, insertDynamic, normalizeText, updateDynamic } from '@/lib/admin/crud';

function splitsToString(input: any) {
  const s = typeof input === 'string' ? input.trim() : '';

  if (!s) return '';

  // Accept JSON array strings produced by the checkbox UI.
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join(',');
      }
    } catch {}
  }

  // Also accept comma-separated or newline-separated strings.
  return s
    .split(/[\r\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .join(',');
}


export async function createSplitAction(formData: FormData) {
  await requireAdmin();

  const payload: Record<string, any> = {
    callsign: normalizeText(formData.get('callsign')),
    frequency: normalizeText(formData.get('frequency')),
    type: normalizeText(formData.get('type')),
    splits: splitsToString(formData.get('splits')),
  };

  if (!payload.callsign || !payload.frequency) {
    redirect('/admin/splits/new?error=missing');
  }

  const row = await insertDynamic('splits', payload);
  revalidatePath('/admin/splits');
  revalidatePath('/');
  redirect(`/admin/splits/${row.id}`);
}

export async function updateSplitAction(id: string, formData: FormData) {
  await requireAdmin();

  const payload: Record<string, any> = {
    callsign: normalizeText(formData.get('callsign')),
    frequency: normalizeText(formData.get('frequency')),
    type: normalizeText(formData.get('type')),
    splits: splitsToString(formData.get('splits')),
  };

  await updateDynamic('splits', id, payload);
  revalidatePath('/admin/splits');
  revalidatePath(`/admin/splits/${id}`);
  redirect(`/admin/splits/${id}?saved=1`);
}

export async function deleteSplitAction(id: string) {
  await requireAdmin();
  await deleteById('splits', id);
  revalidatePath('/admin/splits');
  revalidatePath('/');
  redirect('/admin/splits?deleted=1');
}
