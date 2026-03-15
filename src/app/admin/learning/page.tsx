import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { canManageFlightDataPractice, canManageTrainingTickets } from '@/lib/auth/permissions';
import { canGradeExams, canManageExams } from '@/lib/auth/exams';

export default async function AdminLearningEntryPage() {
  const user = await requireAdmin();

  const canExamsManage = canManageExams(user);
  const canExamsGrade = canGradeExams(user);
  const canFDP = canManageFlightDataPractice(user);
  const canTickets = canManageTrainingTickets(user);

  // This page used to be a card hub. Keep the route for compatibility, but
  // send users straight to a tool they can use.
  if (canExamsManage) redirect('/admin/exams');
  if (canExamsGrade) redirect('/admin/exams/review');
  if (canTickets) redirect('/admin/training-tickets');
  if (canFDP) redirect('/admin/flight-data-practice');
  // Lesson plans are broadly useful for staff+; if they can reach admin at all,
  // they can view lesson plans.
  redirect('/admin/lesson-plans');
}
