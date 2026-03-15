import type { SessionUser } from '@/lib/auth/session';

function norm(r: unknown): string {
  return String(r ?? '').trim().toLowerCase();
}

export type RoleTier = 'non_member' | 'member' | 'staff' | 'senior_staff' | 'admin';
export type MemberType = 'home' | 'visiting' | null;

export type DerivedRoles = {
  tier: RoleTier;
  memberType: MemberType;
  /** Normalized set of subroles (mentor, instructor, events_coordinator, web_team, ...). */
  subRoles: Set<string>;
  /** Normalized raw role codes/labels from DB/session. */
  raw: Set<string>;
};

function bumpTier(current: RoleTier, next: RoleTier): RoleTier {
  const order: Record<RoleTier, number> = {
    non_member: 0,
    member: 1,
    staff: 2,
    senior_staff: 3,
    admin: 4,
  };
  return order[next] > order[current] ? next : current;
}

/**
 * Derive the site's role model from a user's raw role codes.
 *
 * - Non-member: logged-in but not on roster and no staff role.
 * - Member: on roster (home vs visiting)
 * - Staff: mentor/events/FE/web team/instructor
 * - Senior staff: TA/ADATM/DATM
 * - Admin: ATM/WM
 */
export function deriveRoles(u: SessionUser | undefined | null): DerivedRoles {
  const raw = new Set((u?.roles ?? []).map(norm).filter(Boolean));
  const subRoles = new Set<string>();

  // Base tier comes from roster membership.
  let tier: RoleTier = u?.isZobMember ? 'member' : 'non_member';

  // Member type (home vs visiting)
  const memberType: MemberType = (u?.memberType ?? null) as MemberType;

  // Staff/senior/admin roles are only granted to ZOB *home* members.
  // (Visiting controllers and non-members should not inherit facility staff.)
  // If memberType is unknown/null but they are on the roster, treat it as home.
  // This prevents "I am on roster but everything is hidden" when schemas differ.
  const allowStaffRoles = Boolean(u?.isZobMember && memberType !== 'visiting');

  const add = (sub: string, t: RoleTier) => {
    if (t !== 'member' && !allowStaffRoles) return;
    subRoles.add(sub);
    tier = bumpTier(tier, t);
  };

  for (const r of raw) {
    // Backwards-compatible canonical labels
    if (r === 'admin') add('admin', 'admin');
    if (r === 'senior_staff') add('senior_staff', 'senior_staff');
    if (r === 'staff') add('staff', 'staff');
    if (r === 'web') add('web_team', 'staff');
    if (r === 'events') add('events_coordinator', 'staff');
    if (r === 'training_admin') add('training_administrator', 'senior_staff');

    // Accept both VATUSA codes and human labels.
    if (r === 'mtr' || r === 'mentor') add('mentor', 'staff');
    if (r === 'ins' || r === 'instructor') add('instructor', 'staff');

    if (r === 'ec' || r === 'events coordinator' || r === 'events_coordinator') add('events_coordinator', 'staff');
    if (r === 'aec' || r === 'ace' || r === 'assistant events coordinator' || r === 'assistant_events_coordinator') {
      add('assistant_events_coordinator', 'staff');
    }

    if (r === 'fe' || r === 'facility engineer' || r === 'facility_engineer') add('facility_engineer', 'staff');
    if (r === 'afe' || r === 'assistant facility engineer' || r === 'assistant_facility_engineer') {
      add('assistant_facility_engineer', 'staff');
    }

    if (r === 'wt' || r === 'web team' || r === 'web_team') add('web_team', 'staff');
    if (r === 'awm' || r === 'assistant webmaster' || r === 'assistant_webmaster') add('assistant_webmaster', 'staff');

    // Senior staff
    if (r === 'ta' || r === 'training administrator' || r === 'training_admin') add('training_administrator', 'senior_staff');
    if (r === 'adatm' || r === 'assistant deputy air traffic manager' || r === 'assistant_deputy_atm') {
      add('assistant_deputy_atm', 'senior_staff');
    }
    if (r === 'datm' || r === 'deputy air traffic manager' || r === 'deputy_atm') add('deputy_atm', 'senior_staff');

    // Admin
    if (r === 'wm' || r === 'webmaster') add('webmaster', 'admin');
    if (r === 'atm' || r === 'air traffic manager' || r === 'air_traffic_manager') add('atm', 'admin');
  }

  return { tier, memberType, subRoles, raw };
}

/**
 * Map the messy set of historical roster role codes / labels into a small set
 * of canonical roles for access checks.
 */
export function canonicalizeRoles(roles: string[] | undefined | null): Set<string> {
  // Backwards-compatible canonical set used around the app.
  const raw = (roles ?? []).map(norm).filter(Boolean);
  const out = new Set<string>();

  for (const r of raw) {
    // Allow existing canonical strings to pass through.
    if (['admin', 'web', 'events', 'training_admin', 'mentor', 'instructor', 'staff', 'senior_staff', 'member', 'non_member'].includes(r)) {
      out.add(r);
      continue;
    }

    // VATUSA-ish codes
    if (r === 'atm') out.add('admin');
    if (r === 'wm') {
      out.add('admin');
      out.add('web');
    }
    if (r === 'wt' || r === 'awm') out.add('web');
    if (r === 'ec' || r === 'aec' || r === 'ace') out.add('events');
    if (r === 'ta') out.add('training_admin');
    if (r === 'mtr') out.add('mentor');
    if (r === 'ins') out.add('instructor');
    if (r === 'datm' || r === 'adatm') out.add('senior_staff');
    if (r === 'fe' || r === 'afe') out.add('staff');
  }

  // If they have any of these, they're staff.
  if (['admin', 'web', 'events', 'training_admin', 'mentor', 'instructor', 'senior_staff'].some((x) => out.has(x))) {
    out.add('staff');
  }

  return out;
}

export function isLoggedIn(u: SessionUser | undefined | null): u is SessionUser {
  return Boolean(u && typeof u.cid === 'number' && u.cid > 0);
}

export function isZobMember(u: SessionUser | undefined | null): boolean {
  return Boolean(u?.isZobMember);
}

export function canAccessAdmin(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  return d.tier === 'staff' || d.tier === 'senior_staff' || d.tier === 'admin';
}

export function canManageEvents(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  if (d.tier === 'admin') return true;
  // Web team has broad access.
  if (d.subRoles.has('web_team') || d.subRoles.has('assistant_webmaster') || d.subRoles.has('webmaster')) return true;
  return d.subRoles.has('events_coordinator') || d.subRoles.has('assistant_events_coordinator');
}


export function canManageNotices(u: SessionUser | undefined | null): boolean {
  return canAccessAdmin(u);
}

export function canManageSplits(u: SessionUser | undefined | null): boolean {
  return canAccessAdmin(u);
}

// Training ticket entry + stats (mentors/instructors/staff+)
export function canManageTrainingTickets(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  // Admin + Senior Staff + Training Administrator can view/manage all.
  if (d.tier === 'admin' || d.tier === 'senior_staff' || d.subRoles.has('training_administrator')) return true;
  // Mentors/Instructors can access the training ticket tools, but should be scoped to their own tickets.
  return d.subRoles.has('mentor') || d.subRoles.has('instructor');
}

// Student syllabus (mentor-fillable checklist)
// - Students can view their own syllabus.
// - Mentors/Instructors/Staff+ can view + edit student syllabi.
export function canEditSyllabus(u: SessionUser | undefined | null): boolean {
  return canManageTrainingTickets(u);
}


// Lesson plans
// - Viewable by mentors/staff+.
// - Editable only by Training Administrator and Admin.
export function canViewLessonPlans(u: SessionUser | undefined | null): boolean {
  return canAccessAdmin(u);
}

export function canManageLessonPlans(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  if (d.tier === 'admin') return true;
  return d.subRoles.has('training_administrator');
}

// CBT authoring (Training Administrator + Admin)
export function canManageCbts(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  if (d.tier === 'admin') return true;
  return d.subRoles.has('training_administrator');
}

// Senior staff (TA / DATM / ADATM) + Admin (ATM / WM)
export function canAccessSeniorStaff(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  return d.tier === 'senior_staff' || d.tier === 'admin';
}

// Roster certification editing (staff+)
export function canEditRosterCerts(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  return d.tier === 'staff' || d.tier === 'senior_staff' || d.tier === 'admin';
}

// Solo cert issuing (Mentor / Instructor / Training Admin / Senior Staff / Admin)
export function canIssueSoloCert(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  if (d.tier === 'admin' || d.tier === 'senior_staff') return true;
  if (d.subRoles.has('training_administrator')) return true;
  return d.subRoles.has('mentor') || d.subRoles.has('instructor');
}

// Roster management (manual role overrides + internal notes)
export function canManageRoster(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  return d.tier === 'admin' || d.tier === 'senior_staff';
}

// Flight Data Practice authoring (Training Administrator + admin)
export function canManageFlightDataPractice(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  if (d.tier === 'admin') return true;
  return d.tier === 'senior_staff' || d.subRoles.has('training_administrator');
}

// LOA moderation (Senior Staff + Admin)
export function canModerateLoa(u: SessionUser | undefined | null): boolean {
  if (!isLoggedIn(u)) return false;
  const d = deriveRoles(u);
  return d.tier === 'admin' || d.tier === 'senior_staff';
}

