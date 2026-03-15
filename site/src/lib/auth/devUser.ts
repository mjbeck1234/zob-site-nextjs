import type { SessionUser } from './session';

function parseRoles(raw: string | undefined): string[] {
  const parts = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  // Support existing/dev-friendly aliases.
  const mapped = parts.map((r) => {
    if (r === 'webadmin') return 'wm';
    if (r === 'webmaster') return 'wm';
    if (r === 'training') return 'ta';
    if (r === 'trainingadmin') return 'ta';
    if (r === 'events') return 'ec';
    if (r === 'assistant_events') return 'aec';
    return r;
  });

  // Default to a "webmaster" dev so admin pages render.
  return mapped.length ? mapped : ['wm'];
}

function parseMemberType(
  raw: string | undefined,
  parsedRoles: string[]
): { isZobMember: boolean; memberType: 'prim' | 'vis' | null } {
  const explicit = String(raw ?? '').trim().toLowerCase();
  if (explicit) {
    if (explicit === 'non_member' || explicit === 'non-member' || explicit === 'visitor' || explicit === 'pilot') {
      return { isZobMember: false, memberType: null };
    }
    if (explicit === 'visiting' || explicit === 'visitor_controller') {
      return { isZobMember: true, memberType: 'vis' };
    }
    return { isZobMember: true, memberType: 'prim' };
  }

  const roleSet = new Set(parsedRoles.map((r) => String(r).trim().toLowerCase()).filter(Boolean));
  const hasPilotRole = roleSet.has('pilot');
  const hasControllerOrStaffRole = [
    'atm', 'wm', 'wt', 'awm', 'ta', 'datm', 'adatm', 'ec', 'aec', 'ace', 'fe', 'afe',
    'mentor', 'mtr', 'ins', 'staff', 'senior_staff', 'admin', 'member'
  ].some((r) => roleSet.has(r));

  // In dev auth bypass, a plain `pilot` role should behave like a pilot/non-member by default.
  // This avoids showing controller/home-member UI when testing with a CID that is not on the roster.
  if (hasPilotRole && !hasControllerOrStaffRole) {
    return { isZobMember: false, memberType: null };
  }

  // Default to home member for controller-oriented bypass sessions.
  return { isZobMember: true, memberType: 'prim' };
}

export function buildDevUser(): SessionUser {
  const cid = Number(process.env.AUTH_BYPASS_CID ?? '1234567');
  const firstName = process.env.AUTH_BYPASS_FIRST_NAME ?? 'Dev';
  const lastName = process.env.AUTH_BYPASS_LAST_NAME ?? 'User';
  const fullName = `${firstName} ${lastName}`.trim();
  const roles = parseRoles(process.env.AUTH_BYPASS_ROLES);

  const mt = parseMemberType(process.env.AUTH_BYPASS_MEMBER_TYPE, roles);

  return {
    cid: Number.isFinite(cid) ? cid : 1234567,
    firstName,
    lastName,
    fullName,
    email: process.env.AUTH_BYPASS_EMAIL ?? undefined,
    ratingShort: process.env.AUTH_BYPASS_RATING ?? 'S3',
    roles,
    // In bypass mode, assume membership unless explicitly overridden or testing a pilot-only session.
    isZobMember: mt.isZobMember,
    memberType: mt.memberType,
  };
}

export function isAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && String(process.env.AUTH_BYPASS ?? '').toLowerCase() === 'true';
}

export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || String(process.env.ALLOW_DEV_LOGIN ?? '').toLowerCase() === 'true';
}
