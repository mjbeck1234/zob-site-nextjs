import { getSession } from './session';
import { buildDevUser, isAuthBypassEnabled } from './devUser';
import { resolveRolesFromUserRoles, resolveRolesFromVatusa, isUserOnRoster, resolveRosterMemberType } from './roles';
import { getRosterOverride } from './rosterOverrides';
import { deriveRoles } from './permissions';

function norm(r: unknown): string {
  return String(r ?? '').trim().toLowerCase();
}

export async function getUser() {
  if (isAuthBypassEnabled()) {
    return buildDevUser();
  }

  const session = await getSession();
  const u = session.user;
  if (!u) return undefined;

  // Merge roles from DB (user_roles table) so changes take effect without re-login.
  try {
    const [extra, vatusa] = await Promise.all([
      resolveRolesFromUserRoles(u.cid),
      resolveRolesFromVatusa(u.cid),
    ]);
    const merged = Array.from(new Set([...(u.roles ?? []), ...(extra ?? []), ...(vatusa ?? [])].map(norm).filter(Boolean)));
    u.roles = merged;
  } catch {
    // ignore
  }

  // Derive membership flag.
  try {
    const [isMember, memberType] = await Promise.all([
      isUserOnRoster({ cid: u.cid, firstName: u.firstName, lastName: u.lastName }),
      resolveRosterMemberType({ cid: u.cid, firstName: u.firstName, lastName: u.lastName }),
    ]);
    u.isZobMember = isMember;
    u.memberType = memberType === 'visiting' ? 'vis' : memberType === 'home' ? 'prim' : memberType;
  } catch {
    // ignore
  }

  // Ensure we always have a boolean (some downstream UI treats undefined as false).
  if (typeof u.isZobMember !== 'boolean') u.isZobMember = false;

  // If they're on roster but we couldn't determine a member type, default to prim.
  // (Visiting membership is explicitly detected; unknown is treated as prim for access gating.)
  if (u.isZobMember && !u.memberType) u.memberType = 'prim';

  // Apply optional roster override (member status/type + notes).
  try {
    const o = await getRosterOverride(u.cid);
    if (o) {
      if (o.member_status_override === 'member') u.isZobMember = true;
      if (o.member_status_override === 'non_member') u.isZobMember = false;

      // Overrides are stored as existing strings in the DB (home/visiting) but we expose prim/vis.
      if (o.member_type_override === 'home') u.memberType = 'prim';
      if (o.member_type_override === 'visiting') u.memberType = 'vis';
      if (o.member_status_override === 'non_member') u.memberType = null;
    }
  } catch {
    // ignore
  }

  // Derive the new role tier/subrole model.
  try {
    const d = deriveRoles(u);
    u.roleTier = d.tier;
    u.subRoles = Array.from(d.subRoles);
  } catch {
    // ignore
  }

  return u;
}
