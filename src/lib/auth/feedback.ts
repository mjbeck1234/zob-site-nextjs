import type { SessionUser } from '@/lib/auth/session';
import { deriveRoles, isLoggedIn } from '@/lib/auth/permissions';

/**
 * Feedback moderation permissions
 *
 * Facility requirement: ONLY admins can approve/reject/move to pending.
 * (Web/events/training staff should NOT be able to moderate feedback.)
 */
export function canModerateFeedback(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  // Facility requirement: ONLY admins (ATM/WM) can moderate feedback.
  return d.tier === 'admin';
}
