import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireLogin } from '@/lib/auth/guards';
import { canEditSyllabus } from '@/lib/auth/permissions';
import { allSyllabusItemIds } from '@/lib/syllabusTemplate';
import { getSyllabusDoc, upsertSyllabusDoc } from '@/lib/syllabus';

export async function saveSyllabusAction(formData: FormData) {
  'use server';
  const user = await requireLogin();
  if (!canEditSyllabus(user)) {
    redirect('/learning/syllabus?forbidden=1');
  }

  const studentCid = Number(formData.get('studentCid') ?? 0);
  if (!studentCid) {
    redirect('/learning/syllabus?missing=1');
  }

  const { doc } = await getSyllabusDoc(studentCid);
  const next = { ...doc, statuses: { ...doc.statuses } };

  // General notes (student-visible)
  next.generalNotes = String(formData.get('generalNotes') ?? '').slice(0, 8000);

  const nowIso = new Date().toISOString();
  for (const id of allSyllabusItemIds()) {
    const doneRaw = String(formData.get(`done_${id}`) ?? '0');
    const done = doneRaw === '1' || doneRaw === 'true' || doneRaw === 'on';
    const notes = String(formData.get(`notes_${id}`) ?? '').slice(0, 4000);

    const prev = next.statuses[id] ?? { done: false, doneAt: null, notes: '' };
    const doneAt = done ? (prev.done && prev.doneAt ? prev.doneAt : nowIso) : null;
    next.statuses[id] = { done, doneAt, notes };
  }

  await upsertSyllabusDoc(studentCid, next as any, user.cid);

  revalidatePath('/learning/syllabus');
  revalidatePath(`/learning/syllabus/${studentCid}`);
  revalidatePath('/profile');
  redirect(`/learning/syllabus/${studentCid}?saved=1`);
}
