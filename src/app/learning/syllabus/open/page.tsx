import { redirect } from 'next/navigation';

import { getUser } from '@/lib/auth/getUser';
import { canEditSyllabus, deriveRoles } from '@/lib/auth/permissions';

export default async function OpenSyllabusRedirect({ searchParams }: { searchParams: Promise<{ cid?: string }> }) {
  const sp = await searchParams;
  const cid = Number(sp.cid ?? 0);
  const user = await getUser();

  if (!user) redirect('/learning/syllabus');

  const roles = deriveRoles(user);
  const isMember = roles.tier !== 'non_member';
  const canEdit = canEditSyllabus(user);

  // Non-staff users should never be able to use the picker route to open other
  // students' syllabi. Send them to their own syllabus instead.
  if (!isMember) redirect('/learning/syllabus');
  if (!canEdit) redirect(`/learning/syllabus/${user.cid}`);

  if (!cid) redirect('/learning/syllabus?missing=1');
  redirect(`/learning/syllabus/${cid}`);
}
