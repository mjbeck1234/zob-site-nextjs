import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/lib/site';
import CommandPalette from '@/components/CommandPalette';
import { getUser } from '@/lib/auth/getUser';
import {
  canAccessAdmin,
  canEditRosterCerts,
  canManageEvents,
  canManageCbts,
  canManageFlightDataPractice,
  canManageNotices,
  canManageRoster,
  canManageSplits,
  canManageTrainingTickets,
  canModerateLoa,
  canAccessSeniorStaff,
  deriveRoles,
} from '@/lib/auth/permissions';
import { canGradeExams, canManageExams } from '@/lib/auth/exams';
import { canModerateFeedback } from '@/lib/auth/feedback';

function adminAllowedFromRoles(roles: string[] | undefined | null): boolean {
  const set = new Set((roles ?? []).map((r) => String(r).trim().toLowerCase()).filter(Boolean));
  const configured = (process.env.ADMIN_ROLES ?? '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

  // Keep in sync with lib/auth/admin.ts DEFAULT_ADMIN_ROLES
  const defaults = [
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
  ];
  const allowed = configured.length ? configured : defaults;
  return allowed.some((r) => set.has(r));
}

const navLinks = [
  // /ids is shown to tier admins that are not home/visiting members (members get IDS under the Controllers menu)
  { href: '/ids', label: 'IDS' },
  // Roster is rendered as a dropdown (see below)
  { href: '/events', label: 'Events' },
  { href: '/splits', label: 'Splits' },
  { href: '/feedback', label: 'Feedback' },
  { href: '/visit', label: 'Visit' },
];

const controllersMenuLinks = [
  { href: '/ids', label: 'IDS' },
  { href: '/downloads', label: 'Downloads' },
  { href: '/events', label: 'Events' },
];

const pilotMenuLinks = [
  { href: '/pilot/ramp', label: 'Ramp Gate Selection' },
  { href: '/pilot/resources', label: 'Resources' },
];

const rosterMenuLinks = [
  { href: '/roster', label: 'Roster' },
  { href: '/roster/stats', label: 'Controller Statistics' },
  { href: '/roster/staff', label: 'ARTCC Staff' },
];

export default async function Navbar() {
  let user: any = undefined;
  try {
    user = await getUser();
  } catch (e) {
    console.error('Navbar:getUser failed (continuing as guest)', e);
    user = undefined;
  }
  const isMember = Boolean(user?.isZobMember);
  const showAdmin = Boolean(user && (canAccessAdmin(user) || adminAllowedFromRoles(user.roles)));
  const tier = user ? deriveRoles(user).tier : 'non_member';
  const isTierAdmin = tier === 'admin';

  // Admin dropdown items (only shown when showAdmin is true).
  const canNotices = user ? canManageNotices(user) : false;
  const canEvents = user ? canManageEvents(user) : false;
  const canDownloads = Boolean(user && canAccessAdmin(user));
  const canRoutes = Boolean(user && canAccessAdmin(user));
  const canIdsData = Boolean(user && deriveRoles(user).tier === 'admin');
  const canSplitsAdmin = user ? canManageSplits(user) : false;
  const canExamsManage = user ? canManageExams(user) : false;
  const canExamsGrade = user ? canGradeExams(user) : false;
  const canCbtsManage = user ? canManageCbts(user) : false;
  const canFDP = user ? canManageFlightDataPractice(user) : false;
  const canTickets = user ? canManageTrainingTickets(user) : false;
  const canRosterCerts = user ? canEditRosterCerts(user) : false;
  const canRoster = user ? canManageRoster(user) : false;
  const canFeedback = user ? canModerateFeedback(user) : false;
  const canLoa = user ? canModerateLoa(user) : false;
  const canSenior = user ? canAccessSeniorStaff(user) : false;

  const adminLinks: Array<{ href: string; label: string; group: string }> = [];
  if (canNotices) adminLinks.push({ href: '/admin/notices', label: 'Notices', group: 'Content' });
  if (canEvents) adminLinks.push({ href: '/admin/events', label: 'Events', group: 'Content' });
  // Staffing requests are handled by Events team or Admin.
  if (canEvents) adminLinks.push({ href: '/admin/staffing', label: 'Staffing Requests', group: 'Content' });
  if (canDownloads) adminLinks.push({ href: '/admin/downloads', label: 'Downloads', group: 'Content' });
  if (canRoutes) adminLinks.push({ href: '/admin/routing', label: 'Routes', group: 'Content' });
  if (canSplitsAdmin) adminLinks.push({ href: '/admin/splits', label: 'Splits', group: 'Content' });
  if (showAdmin) adminLinks.push({ href: '/admin/status', label: 'System Status', group: 'Systems' });
  if (canIdsData) {
    adminLinks.push({ href: '/admin/ids-data', label: 'IDS Data', group: 'Systems' });
    adminLinks.push({ href: '/admin/ramp-overrides', label: 'Ramp Overrides', group: 'Systems' });
  }

  // Learning tools
  // Lesson plans are broadly useful; keep visible for staff+.
  if (showAdmin) adminLinks.push({ href: '/admin/lesson-plans', label: 'Lesson Plans', group: 'Learning' });
  if (canCbtsManage) adminLinks.push({ href: '/admin/cbts', label: 'CBTs', group: 'Learning' });
  if (canTickets) adminLinks.push({ href: '/admin/training-tickets', label: 'Training Tickets', group: 'Learning' });
  if (canExamsManage) adminLinks.push({ href: '/admin/exams', label: 'Exams', group: 'Learning' });
  else if (canExamsGrade) adminLinks.push({ href: '/admin/exams/review', label: 'Exams Review', group: 'Learning' });
  if (canFDP) adminLinks.push({ href: '/admin/flight-data-practice', label: 'Flight Data Practice', group: 'Learning' });

  // Management
  if (canSenior && canFeedback) adminLinks.push({ href: '/admin/feedback', label: 'Feedback', group: 'Management' });
  if (canSenior && canLoa) adminLinks.push({ href: '/admin/loa', label: 'LOA Requests', group: 'Management' });

  // Roster
  if (canRosterCerts) {
    adminLinks.push({ href: '/admin/roster', label: canRoster ? 'Roster' : 'Roster Certifications', group: 'Roster' });
  }

  // Note: /admin now redirects to the first tool; we intentionally don't show
  // a separate "hub" link in the navbar.

  // Home/visiting members don't need the Visit link in the top nav.
  // Keep it visible for non-members (so they can visit/apply) and for true admins.
  const filteredNavLinks = navLinks.filter((l) => {
    if (l.href === '/visit') {
      if (isTierAdmin) return true;
      return !isMember;
    }
    if (l.href === '/ids') {
      // Home/visiting members get IDS under the Controllers dropdown.
      return isTierAdmin && !isMember;
    }
    if (l.href === '/events') {
      // Home/visiting members get Events under the Controllers dropdown.
      return !isMember;
    }
    return true;
  });

  const hasPilotRole = Boolean(user && (user.roles ?? []).some((r: string) => String(r).trim().toLowerCase() === 'pilot'));
  const memberLabel = user
    ? hasPilotRole && !user.isZobMember
      ? 'Pilot'
      : user.isZobMember
        ? user.memberType === 'visiting'
          ? 'Visiting Member'
          : 'Home Member'
        : 'Non-member'
    : '';
  // Don't show pseudo-roles like `member` / `non_member` in the UI.
  const rawRolesText = user
    ? (user.roles ?? [])
        .filter((r: string) => {
          const v = String(r).toLowerCase();
          if (!v) return false;
          if (['member', 'non_member'].includes(v)) return false;
          if (memberLabel === 'Pilot' && v === 'pilot') return false;
          return true;
        })
        .join(', ')
    : '';
  const menuRoleLine = rawRolesText ? `${memberLabel} · ${rawRolesText}` : memberLabel;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-[rgba(11,15,16,0.80)] backdrop-blur border-b border-white/10">
        <div className="container h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white no-underline">
            <Image
              src={site.logoUrl}
              alt={`${site.name} logo`}
              width={44}
              height={44}
              priority
              className="rounded-full"
            />
            <div className="hidden sm:flex flex-col leading-tight">
              <div className="text-white font-bold text-sm tracking-wide">Cleveland ARTCC</div>
              <div className="text-white/60 text-[11px] font-semibold tracking-[0.18em]">ZOB</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-2">
            {/* Hover dropdown: closes automatically when the mouse leaves the section */}
            <div className="relative group">
              <button
                type="button"
                aria-haspopup="menu"
                className="cursor-pointer px-3 py-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white hover:bg-white/10 rounded-xl select-none"
              >
                Roster
              </button>
              <div className="absolute left-0 top-full pt-2 w-64 rounded-2xl border border-white/10 bg-[#0f1416] shadow-xl overflow-hidden opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition">
                <div className="py-1">
                  {rosterMenuLinks.map((l) => (
                    <Link
                      key={l.href}
                      className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline"
                      href={l.href}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative group">
              <button
                type="button"
                aria-haspopup="menu"
                className="cursor-pointer px-3 py-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white hover:bg-white/10 rounded-xl select-none"
              >
                Pilot
              </button>
              <div className="absolute left-0 top-full pt-2 w-64 rounded-2xl border border-white/10 bg-[#0f1416] shadow-xl overflow-hidden opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition">
                <div className="py-1">
                  {pilotMenuLinks.map((l) => (
                    <Link
                      key={l.href}
                      className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline"
                      href={l.href}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            {isMember ? (
              <div className="relative group">
                <button
                  type="button"
                  aria-haspopup="menu"
                  className="cursor-pointer px-3 py-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white hover:bg-white/10 rounded-xl select-none"
                >
                  Controllers
                </button>
                <div className="absolute left-0 top-full pt-2 w-64 rounded-2xl border border-white/10 bg-[#0f1416] shadow-xl overflow-hidden opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition">
                  <div className="py-1">
                    {controllersMenuLinks.map((l) => (
                      <Link
                        key={l.href}
                        className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline"
                        href={l.href}
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {filteredNavLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white hover:bg-white/10 rounded-xl no-underline"
              >
                {l.label}
              </Link>
            ))}
            {isMember ? (
              <div className="relative group">
                <button
                  type="button"
                  aria-haspopup="menu"
                  className="cursor-pointer px-3 py-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white hover:bg-white/10 rounded-xl select-none"
                >
                  Learning
                </button>
                <div className="absolute left-0 top-full pt-2 w-64 rounded-2xl border border-white/10 bg-[#0f1416] shadow-xl overflow-hidden opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition">
                  <div className="py-1">
                    <Link className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline" href="/learning/cbts">CBTs</Link>
                    <Link className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline" href="/learning/flight-data-practice">Flight Data Practice</Link>
                    <Link className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline" href="/learning/syllabus">Syllabus</Link>
                    <Link className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline" href="/exam">Exams</Link>
                  </div>
                </div>
              </div>
            ) : null}
            {showAdmin ? (
              <div className="relative group">
                <button
                  type="button"
                  aria-haspopup="menu"
                  className="cursor-pointer px-3 py-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white hover:bg-white/10 rounded-xl select-none"
                >
                  Admin
                </button>
                <div className="absolute left-0 top-full pt-2 w-72 rounded-2xl border border-white/10 bg-[#0f1416] shadow-xl overflow-hidden opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition">
                  <div className="py-2">
                    {['Content', 'Learning', 'Management', 'Roster', 'Systems'].map((g) => {
                      const links = adminLinks.filter((l) => l.group === g);
                      if (!links.length) return null;
                      return (
                        <div key={g}>
                          <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">{g}</div>
                          {links.map((l) => (
                            <Link
                              key={l.href}
                              className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline"
                              href={l.href}
                            >
                              {l.label}
                            </Link>
                          ))}
                          <div className="my-1 border-t border-white/10" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <CommandPalette />
            </div>

            {user ? (
              <div className="relative group">
                <button
                  type="button"
                  aria-haspopup="menu"
                  className="cursor-pointer px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold select-none"
                >
                  {user.fullName ?? `CID ${user.cid}`}
                </button>
                <div className="absolute right-0 top-full pt-2 w-56 rounded-2xl border border-white/10 bg-[#0f1416] shadow-xl overflow-hidden opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition">
                  <div className="px-4 py-3 border-b border-white/10">
                    <div className="text-white text-sm font-semibold">{user.fullName ?? `CID ${user.cid}`}</div>
                    <div className="text-white/70 text-xs mt-1">{menuRoleLine}</div>
                  </div>
                  <div className="py-1">
                    <Link className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline" href="/profile">
                      Profile
                    </Link>
                    <a className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline" href="/api/auth/logout">
                      Logout
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <a href="/api/auth/login" className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold no-underline">
                Login (VATSIM)
              </a>
            )}

            {/* Mobile menu */}
            <details className="relative lg:hidden">
              <summary className="list-none cursor-pointer px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold select-none">
                Menu
              </summary>
              <div className="absolute right-0 top-full pt-2 w-64 rounded-2xl border border-white/10 bg-[#0f1416] shadow-xl overflow-hidden">
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50">Roster</div>
                  {rosterMenuLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <div className="my-2 border-t border-white/10" />
                  <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50">Pilot</div>
                  {pilotMenuLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline"
                    >
                      {l.label}
                    </Link>
                  ))}
                  {isMember ? (
                    <>
                      <div className="my-2 border-t border-white/10" />
                      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50">Controllers</div>
                      {controllersMenuLinks.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline"
                        >
                          {l.label}
                        </Link>
                      ))}
                    </>
                  ) : null}
                  <div className="my-2 border-t border-white/10" />
                  {filteredNavLinks.map((l) => (
                    <Link key={l.href} href={l.href} className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline">
                      {l.label}
                    </Link>
                  ))}
                  {isMember ? (
                    <>
                      <div className="my-2 border-t border-white/10" />
                      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50">Learning</div>
                      <Link href="/learning/cbts" className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline">
                        CBTs
                      </Link>
                      <Link href="/learning/flight-data-practice" className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline">
                        Flight Data Practice
                      </Link>
                      <Link href="/learning/syllabus" className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline">
                        Syllabus
                      </Link>
                      <Link href="/exam" className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline">
                        Exams
                      </Link>
                    </>
                  ) : null}
                  {showAdmin ? (
                    <>
                      <div className="my-2 border-t border-white/10" />
                      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/50">Admin</div>
                      {['Content', 'Learning', 'Management', 'Roster', 'Systems'].map((g) => {
                        const links = adminLinks.filter((l) => l.group === g);
                        if (!links.length) return null;
                        return (
                          <div key={g}>
                            <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">{g}</div>
                            {links.map((l) => (
                              <Link
                                key={l.href}
                                href={l.href}
                                className="block px-4 py-2 text-sm text-white/85 hover:text-white hover:bg-white/10 no-underline"
                              >
                                {l.label}
                              </Link>
                            ))}
                          </div>
                        );
                      })}
                    </>
                  ) : null}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
