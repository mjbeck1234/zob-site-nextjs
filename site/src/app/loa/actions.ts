import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireZobMember } from '@/lib/auth/guards';
import { tableExists } from '@/lib/schema';

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function submitLoaRequestAction(formData: FormData) {
  'use server';
  const user = await requireZobMember();

  const ok = await tableExists('loa_requests').catch(() => false);
  if (!ok) redirect('/loa?error=missing_table');

  const est = parseDate(String(formData.get('estimated_date') ?? '').trim());
  const reason = String(formData.get('reason') ?? '').trim();

  if (!est || !reason) redirect('/loa?error=missing');

  const now = new Date();
  const msDay = 24 * 60 * 60 * 1000;
  const days = Math.round((est.getTime() - now.getTime()) / msDay);

  // Enforce standard policy: 30-90 days.
  // Military LOA (up to 24 months) can be handled later via a separate flag/field.
  if (days < 30 || days > 90) redirect('/loa?error=range');

  await sql`
    INSERT INTO loa_requests (controller_cid, controller_name, controller_email, estimated_date, reason, approved, created_at, updated_at)
    -- approved is tri-state; new requests start Pending (NULL)
    VALUES (${user.cid}, ${user.fullName ?? ''}, ${user.email ?? ''}, ${est.toISOString().slice(0, 10)}, ${reason}, NULL, NOW(), NOW())
  `;

  revalidatePath('/profile');
  revalidatePath('/loa');
  redirect('/loa?sent=1');
}

export async function deleteMyLoaRequestAction(id: string) {
  'use server';
  const user = await requireZobMember();
  const ok = await tableExists('loa_requests').catch(() => false);
  if (!ok) redirect('/loa?error=missing_table');

  // Only allow deleting your own request, and not if it has been approved.
  await sql`DELETE FROM loa_requests WHERE id = ${id} AND controller_cid = ${user.cid} AND approved IS DISTINCT FROM TRUE`;
  revalidatePath('/profile');
  revalidatePath('/loa');
  redirect('/loa?deleted=1');
}
