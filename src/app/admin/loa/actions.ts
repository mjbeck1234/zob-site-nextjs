import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { requireLoaModerator } from '@/lib/auth/guards';

function normalizeStatus(raw: string): 'pending' | 'approved' | 'rejected' {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'approved') return 'approved';
  if (v === 'rejected') return 'rejected';
  return 'pending';
}

function withQueryParam(url: string, key: string, value: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export async function setLoaRequestStatusAction(formData: FormData) {
  'use server';
  await requireLoaModerator();

  const ok = await tableExists('loa_requests').catch(() => false);
  if (!ok) redirect('/admin/loa?error=missing_table');

  const id = String(formData.get('id') ?? '').trim();
  const status = normalizeStatus(String(formData.get('status') ?? ''));
  const returnToRaw = String(formData.get('return_to') ?? '/admin/loa').trim();
  const returnTo = returnToRaw || '/admin/loa';

  if (!id) redirect(withQueryParam(returnTo, 'error', 'missing_id'));

  const approvedVal: boolean | null = status === 'pending' ? null : status === 'approved';

  await sql`
    UPDATE loa_requests
    SET approved = ${approvedVal}, updated_at = NOW()
    WHERE id = ${id}
  `;

  revalidatePath('/admin/loa');
  revalidatePath('/loa');
  revalidatePath('/profile');

  redirect(withQueryParam(returnTo, 'updated', '1'));
}
