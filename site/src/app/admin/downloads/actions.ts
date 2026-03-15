import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { deleteById, insertDynamic, normalizeDate, normalizeText, updateDynamic } from '@/lib/admin/crud';

export async function createDownloadAction(formData: FormData) {
  'use server';
  await requireAdmin();

  const payload: Record<string, any> = {
    name: normalizeText(formData.get('name')),
    title: normalizeText(formData.get('name')),
    description: normalizeText(formData.get('description')),
    category: normalizeText(formData.get('category')),
    upload_date: await normalizeDate(formData.get('upload_date')),
    file_path: normalizeText(formData.get('file_path')),
    url: normalizeText(formData.get('file_path')),
  };

  if (!payload.file_path && !payload.url) {
    redirect('/admin/downloads/new?error=missing');
  }

  const row = await insertDynamic('downloads', payload);

  revalidatePath('/downloads');
  revalidatePath('/admin/downloads');

  redirect(`/admin/downloads/${row.id}`);
}

export async function updateDownloadAction(id: string, formData: FormData) {
  'use server';
  await requireAdmin();

  const payload: Record<string, any> = {
    name: normalizeText(formData.get('name')),
    title: normalizeText(formData.get('name')),
    description: normalizeText(formData.get('description')),
    category: normalizeText(formData.get('category')),
    upload_date: await normalizeDate(formData.get('upload_date')),
    file_path: normalizeText(formData.get('file_path')),
    url: normalizeText(formData.get('file_path')),
  };

  await updateDynamic('downloads', id, payload);

  revalidatePath('/downloads');
  revalidatePath('/admin/downloads');
  revalidatePath(`/admin/downloads/${id}`);

  redirect(`/admin/downloads/${id}?saved=1`);
}

export async function deleteDownloadAction(id: string) {
  'use server';
  await requireAdmin();
  await deleteById('downloads', id);

  revalidatePath('/downloads');
  revalidatePath('/admin/downloads');

  redirect('/admin/downloads?deleted=1');
}
