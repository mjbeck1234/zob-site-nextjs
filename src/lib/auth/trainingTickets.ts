import type { SessionUser } from '@/lib/auth/session';
import { deriveRoles, isLoggedIn } from '@/lib/auth/permissions';

export type TrainingTicketRow = {
  id?: number | string;
  student_cid?: number | string | null;
  mentor_cid?: number | string | null;
};

function toInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Whether the user can view *all* training tickets.
 *
 * Policy:
 * - Admin (ATM/WM) and Senior Staff (TA/DATM/ADATM) can view all.
 * - Everyone else can only view tickets where they are the mentor.
 */
export function canViewAllTrainingTickets(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  return d.tier === 'admin' || d.tier === 'senior_staff' || d.subRoles.has('training_administrator');
}

/**
 * Whether the user is allowed to access the training-tickets admin area at all.
 *
 * Policy:
 * - Admin/Senior Staff/Training Administrator: yes
 * - Mentors/Instructors: yes (but limited to their own tickets)
 */
export function canAccessTrainingTickets(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  if (d.tier === 'admin' || d.tier === 'senior_staff' || d.subRoles.has('training_administrator')) return true;
  return d.subRoles.has('mentor') || d.subRoles.has('instructor');
}

export function canViewTrainingTicket(u: SessionUser | undefined | null, ticket: TrainingTicketRow | null | undefined): boolean {
  if (!isLoggedIn(u) || !ticket) return false;
  if (canViewAllTrainingTickets(u)) return true;
  const mentorCid = toInt(ticket.mentor_cid);
  return Boolean(mentorCid && mentorCid === u.cid);
}

/**
 * Editing is restricted to:
 * - Admin/Senior Staff/Training Administrator
 * - The mentor who authored the ticket (mentor_cid)
 */
export function canEditTrainingTicket(u: SessionUser | undefined | null, ticket: TrainingTicketRow | null | undefined): boolean {
  return canViewTrainingTicket(u, ticket);
}
