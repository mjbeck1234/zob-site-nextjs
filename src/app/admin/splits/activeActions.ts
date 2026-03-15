'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth/admin';
import { getUser } from '@/lib/auth/getUser';
import { selectAll } from '@/lib/query';
import { tableExists } from '@/lib/schema';
import { deleteById, insertDynamic, normalizeText, updateDynamic } from '@/lib/admin/crud';

function toSectorArray(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((s) => String(s ?? '').trim().toUpperCase()).filter(Boolean)));
  }
  const raw = String(input ?? '').trim();
  if (!raw) return [];
  const matches = raw.match(/ZOB\d{2}/gi);
  if (matches && matches.length) {
    return Array.from(new Set(matches.map((s) => s.trim().toUpperCase())));
  }
  // Fallback CSV-ish
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/g)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export async function setActiveSplitAction(formData: FormData) {
  await requireAdmin();

  const hasActive = await tableExists('split_active').catch(() => false);
  if (!hasActive) redirect('/admin/splits?active_missing=1');

  const modeRaw = String(formData.get('mode') ?? 'live').trim().toLowerCase();
  const mode = modeRaw === 'preset' ? 'preset' : 'live';

  const presetIdRaw = String(formData.get('preset_id') ?? '').trim();
  const presetId = presetIdRaw ? Number(presetIdRaw) : NaN;

  const payload: Record<string, any> = {
    mode,
    preset_id: mode === 'preset' && Number.isFinite(presetId) && presetId > 0 ? presetId : null,
    updated_at: new Date().toISOString(),
  };

  const existing = await selectAll('split_active', { orderBySql: 'id ASC', limit: 1 }).catch(() => []);
  if (existing.length) {
    const id = String(existing[0]?.id ?? 1);
    await updateDynamic('split_active', id, payload);
  } else {
    await insertDynamic('split_active', { id: 1, ...payload });
  }

  revalidatePath('/splits');
  revalidatePath('/admin/splits');
  redirect('/admin/splits?active_set=1');
}

export async function createPresetFromLiveAction(formData: FormData) {
  await requireAdmin();

  const hasPresets = await tableExists('split_presets').catch(() => false);
  if (!hasPresets) redirect('/admin/splits?presets_missing=1');

  const name = normalizeText(formData.get('name'), { maxLen: 80 }) || '';
  if (!name) redirect('/admin/splits?preset_error=missing_name');

  const splits = await selectAll('splits', { orderBySql: 'id ASC', limit: 500 }).catch(() => []);
  const rows = (splits ?? []).map((r: any) => ({
    callsign: String(r?.callsign ?? ''),
    frequency: String(r?.frequency ?? ''),
    type: String(r?.type ?? ''),
    splits: toSectorArray(r?.splits),
  }));

  const user = await getUser().catch(() => null);
  // SessionUser does not have `name`; it has `fullName` (and first/last).
  const createdBy = user
    ? (String((user as any).fullName ?? '').trim() || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || (user.cid ? `CID ${user.cid}` : ''))
    : null;

  await insertDynamic('split_presets', {
    name,
    rows_json: JSON.stringify(rows),
    created_by: createdBy,
  });

  revalidatePath('/admin/splits');
  redirect('/admin/splits?preset_saved=1');
}

export async function deleteSplitPresetAction(formData: FormData) {
  await requireAdmin();

  const presetId = Number(String(formData.get('preset_id') ?? '').trim());
  if (!Number.isFinite(presetId) || presetId <= 0) redirect('/admin/splits?preset_error=bad_id');

  await deleteById('split_presets', String(presetId));

  // If it was active, fall back to live.
  const hasActive = await tableExists('split_active').catch(() => false);
  if (hasActive) {
    const active = await selectAll('split_active', { orderBySql: 'id ASC', limit: 1 }).catch(() => []);
    const r: any = active?.[0];
    const activePreset = r?.preset_id === null || r?.preset_id === undefined ? null : Number(r?.preset_id);
    if (activePreset === presetId) {
      const id = String(r?.id ?? 1);
      await updateDynamic('split_active', id, { mode: 'live', preset_id: null, updated_at: new Date().toISOString() });
      revalidatePath('/splits');
    }
  }

  revalidatePath('/admin/splits');
  redirect('/admin/splits?preset_deleted=1');
}
