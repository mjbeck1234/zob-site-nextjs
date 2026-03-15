import type { SessionUser } from '@/lib/auth/session';
import { deriveRoles, isLoggedIn } from '@/lib/auth/permissions';

/**
 * Exams permissions
 *
 * - Exam Managers: training_admin + web + admin
 * - Graders: mentors/instructors + managers
 */

export function canManageExams(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  // Managers: Training Admin + web team + admins
  if (d.tier === 'admin') return true;
  if (d.subRoles.has('training_administrator')) return true;
  if (d.subRoles.has('web_team') || d.subRoles.has('assistant_webmaster') || d.subRoles.has('webmaster')) return true;
  return false;
}

export function canGradeExams(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  return canManageExams(u) || d.subRoles.has('mentor') || d.subRoles.has('instructor');
}
