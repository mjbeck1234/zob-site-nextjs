import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireLogin } from '@/lib/auth/guards';
import { upsertUserProfile } from '@/lib/profile';

export async function updateProfileAction(formData: FormData) {
  'use server';
  const user = await requireLogin();

  const bio = String(formData.get('bio') ?? '').trim() || null;
  const avatar_url = String(formData.get('avatar_url') ?? '').trim() || null;

  await upsertUserProfile(user.cid, bio, avatar_url);

  revalidatePath('/profile');
  redirect('/profile?saved=1');
}
