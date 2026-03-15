import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/getUser';
import { canManageEvents, canAccessAdmin, isZobMember, canManageRoster, canEditRosterCerts, canIssueSoloCert, canManageFlightDataPractice, canModerateLoa, canManageTrainingTickets, canViewLessonPlans, canManageLessonPlans, deriveRoles } from '@/lib/auth/permissions';
import { canGradeExams, canManageExams } from '@/lib/auth/exams';
import { canModerateFeedback } from '@/lib/auth/feedback';

export async function requireLogin() {
  const user = await getUser();
  if (!user) redirect('/?auth=required');
  return user;
}

export async function requireZobMember() {
  const user = await requireLogin();
  if (!isZobMember(user)) redirect('/?auth=forbidden');
  return user;
}
// IDS is only for ZOB controllers (home/visiting) and Admin.
export async function requireIdsAccess() {
  const user = await requireLogin();
  const roles = deriveRoles(user);
  if (!isZobMember(user) && roles.tier !== "admin") redirect("/?auth=forbidden");
  return user;
}


export async function requireStaff() {
  const user = await requireLogin();
  if (!canAccessAdmin(user)) redirect('/?auth=forbidden');
  return user;
}

export async function requireEventsManager() {
  const user = await requireLogin();
  if (!canManageEvents(user)) redirect('/?auth=forbidden');
  return user;
}


export async function requireExamsManager() {
  const user = await requireLogin();
  if (!canManageExams(user)) redirect('/?auth=forbidden');
  return user;
}

export async function requireExamsGrader() {
  const user = await requireLogin();
  if (!canGradeExams(user)) redirect('/?auth=forbidden');
  return user;
}

export async function requireFeedbackModerator() {
  const user = await requireLogin();
  if (!canModerateFeedback(user)) redirect('/?auth=forbidden');
  return user;
}

export async function requireRosterManager() {
  const user = await requireLogin();
  if (!canManageRoster(user)) redirect('/?auth=forbidden');
  return user;
}

// Staff+ can edit controller certifications in the roster manager.
export async function requireRosterCertEditor() {
  const user = await requireLogin();
  if (!canEditRosterCerts(user)) redirect('/?auth=forbidden');
  return user;
}

// Mentors/Instructors/TA/Admin can issue solo certs.
export async function requireSoloCertIssuer() {
  const user = await requireLogin();
  if (!canIssueSoloCert(user)) redirect('/?auth=forbidden');
  return user;
}

// Training Administrator (or admin) can manage Flight Data Practice cases.
export async function requireFlightDataPracticeManager() {
  const user = await requireLogin();
  if (!canManageFlightDataPractice(user)) redirect('/?auth=forbidden');
  return user;
}

// LOA requests are approved/rejected by Senior Staff (and Admin).

export async function requireLoaModerator() {
  const user = await requireLogin();
  if (!canModerateLoa(user)) redirect('/?auth=forbidden');
  return user;
}

// Training tickets can be created/viewed by all staff+ (mentors/instructors/etc.).
export async function requireTrainingTicketsManager() {
  const user = await requireLogin();
  if (!canManageTrainingTickets(user)) redirect('/?auth=forbidden');
  return user;
}

// Staff+ can record training tickets.
export async function requireTrainingTicketWriter() {
  const user = await requireLogin();
  if (!canManageTrainingTickets(user)) redirect('/?auth=forbidden');
  return user;
}

// Lesson plans can be viewed by all staff+ (mentors/instructors/etc.).
export async function requireLessonPlansViewer() {
  const user = await requireLogin();
  if (!canViewLessonPlans(user)) redirect('/?auth=forbidden');
  return user;
}

// Lesson plans can be created/modified by Training Administrator and Admin.
export async function requireLessonPlansEditor() {
  const user = await requireLogin();
  if (!canManageLessonPlans(user)) redirect('/?auth=forbidden');
  return user;
}
