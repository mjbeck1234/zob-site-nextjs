import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { deleteById, insertDynamic, normalizeText, updateDynamic } from '@/lib/admin/crud';
import { tableHasColumn } from '@/lib/schema';

export async function createRouteAction(formData: FormData) {
  'use server';
  await requireAdmin();

  const payload: Record<string, any> = {
    dep: normalizeText(formData.get('dep'))?.toUpperCase(),
    arr: normalizeText(formData.get('arr'))?.toUpperCase(),
    route: normalizeText(formData.get('route')),
    remarks: normalizeText(formData.get('remarks')),
  };

  // Validate required fields based on the actual DB schema.
  // Many installs have NOT NULL dep/arr.
  const hasDep = await tableHasColumn('routes', 'dep').catch(() => false);
  const hasArr = await tableHasColumn('routes', 'arr').catch(() => false);
  if (hasDep && !payload.dep) redirect('/admin/routing/new?error=missing_dep');
  if (hasArr && !payload.arr) redirect('/admin/routing/new?error=missing_arr');
  if (!payload.route) redirect('/admin/routing/new?error=missing');

  const row = await insertDynamic('routes', payload);

  revalidatePath('/admin/routing');
  // Public LOA/Routes pages may exist; revalidate broadly.
  revalidatePath('/');

  redirect(`/admin/routing/${row.id}`);
}

export async function updateRouteAction(id: string, formData: FormData) {
  'use server';
  await requireAdmin();

  const payload: Record<string, any> = {
    dep: normalizeText(formData.get('dep'))?.toUpperCase(),
    arr: normalizeText(formData.get('arr'))?.toUpperCase(),
    route: normalizeText(formData.get('route')),
    remarks: normalizeText(formData.get('remarks')),
  };

  await updateDynamic('routes', id, payload);

  revalidatePath('/admin/routing');
  revalidatePath(`/admin/routing/${id}`);

  redirect(`/admin/routing/${id}?saved=1`);
}

export async function deleteRouteAction(id: string) {
  'use server';
  await requireAdmin();
  await deleteById('routes', id);

  revalidatePath('/admin/routing');
  revalidatePath('/');

  redirect('/admin/routing?deleted=1');
}
