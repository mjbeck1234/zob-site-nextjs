import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { deleteById, insertDynamic, normalizeBool, normalizeText, updateDynamic } from '@/lib/admin/crud';
import { tableHasColumn } from '@/lib/schema';

export async function createNoticeAction(formData: FormData) {
  'use server';
  const user = await requireAdmin();

  const title = (formData.get('title') ?? '').toString().trim();
  const body = (formData.get('body') ?? '').toString().trim();
  const published = await normalizeBool(formData.get('published'));
  const archived = await normalizeBool(formData.get('archived'));

  if (!title && !body) {
    redirect('/admin/notices/new?error=missing');
  }

  const payload: Record<string, any> = {
    title: title || undefined,
    body: body || undefined,
    author: user.fullName || `CID ${user.cid}`,
    published,
    archived,
  };

  // If the schema uses published_date/date, populate it with today's date.
  const hasPublishedDate = await tableHasColumn('notices', 'published_date').catch(() => false);
  const hasDate = await tableHasColumn('notices', 'date').catch(() => false);
  const today = new Date().toISOString().slice(0, 10);
  if (hasPublishedDate) payload.published_date = today;
  if (hasDate) payload.date = today;

  const row = await insertDynamic('notices', payload);

  revalidatePath('/');
  revalidatePath('/briefing');
  revalidatePath('/admin/notices');

  redirect(`/admin/notices/${row.id}`);
}

export async function updateNoticeAction(id: string, formData: FormData) {
  'use server';
  await requireAdmin();

  const title = normalizeText(formData.get('title'));
  const body = normalizeText(formData.get('body'));
  const published = await normalizeBool(formData.get('published'));
  const archived = await normalizeBool(formData.get('archived'));

  await updateDynamic('notices', id, { title, body, published, archived });

  revalidatePath('/');
  revalidatePath('/briefing');
  revalidatePath('/admin/notices');
  revalidatePath(`/admin/notices/${id}`);

  redirect(`/admin/notices/${id}?saved=1`);
}

export async function deleteNoticeAction(id: string) {
  'use server';
  await requireAdmin();
  await deleteById('notices', id);

  revalidatePath('/');
  revalidatePath('/briefing');
  revalidatePath('/admin/notices');

  redirect('/admin/notices?deleted=1');
}
