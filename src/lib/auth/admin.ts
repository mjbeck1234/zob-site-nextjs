import { getUser } from '@/lib/auth/getUser';
import { redirect } from 'next/navigation';
import { canAccessAdmin, deriveRoles } from '@/lib/auth/permissions';

export const DEFAULT_ADMIN_ROLES = [
  'webadmin',
  'atm',
  'datm',
  'ta',
  'ata',
  'wm',
  'awm',
  'ec',
  'aec',
  'et',
  'fe',
  'afe',
  'fet',
  'wt',
] as const;

export function isAdminRoles(roles: string[] | undefined | null): boolean {
  const set = new Set((roles ?? []).map((r) => String(r).trim().toLowerCase()).filter(Boolean));

  const configured = (process.env.ADMIN_ROLES ?? '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

  const allowed = configured.length ? configured : Array.from(DEFAULT_ADMIN_ROLES);
  return allowed.some((r) => set.has(r));
}

/**
 * Redirects to home if the user is not logged in or not an admin.
 */
export async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect('/?auth=required');

  // Backwards compatible:
  // - If they pass the old role list, allow.
  // - Otherwise, allow any staff member (via user_roles / canonical roles).
  if (!isAdminRoles(user.roles) && !canAccessAdmin(user)) {
    redirect('/?auth=forbidden');
  }

  return user;
}

/**
 * Redirects to home if the user is not logged in or not an **admin-tier** user.
 *
 * This is intentionally stricter than requireAdmin(), which is staff+ and is
 * used for viewing admin tools.
 */
export async function requireSiteAdminOnly() {
  const user = await getUser();
  if (!user) redirect('/?auth=required');

  const d = deriveRoles(user);
  if (d.tier !== 'admin') redirect('/?auth=forbidden');

  return user;
}
