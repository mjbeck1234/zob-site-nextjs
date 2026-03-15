import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireLogin } from '@/lib/auth/guards';
import { canEditSyllabus } from '@/lib/auth/permissions';
import { deleteStoredProgress, upsertStoredProgress } from '@/lib/syllabusStore';

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function setStoredProgressAction(formData: FormData) {
  'use server';
  const user = await requireLogin();
  if (!canEditSyllabus(user)) {
    redirect('/learning/syllabus?forbidden=1');
  }

  const studentCid = toNum(formData.get('studentCid'));
  const contentId = toNum(formData.get('contentId'));
  const progress = toNum(formData.get('progress'));

  if (!studentCid || !contentId) return;

  await upsertStoredProgress(studentCid, contentId, progress, user.cid);

  revalidatePath('/learning/syllabus');
  revalidatePath(`/learning/syllabus/${studentCid}`);
  revalidatePath('/profile');
}

export async function clearStoredProgressAction(formData: FormData) {
  'use server';
  const user = await requireLogin();
  if (!canEditSyllabus(user)) {
    redirect('/learning/syllabus?forbidden=1');
  }

  const studentCid = toNum(formData.get('studentCid'));
  const contentId = toNum(formData.get('contentId'));
  if (!studentCid || !contentId) return;

  await deleteStoredProgress(studentCid, contentId);

  revalidatePath('/learning/syllabus');
  revalidatePath(`/learning/syllabus/${studentCid}`);
  revalidatePath('/profile');
}
