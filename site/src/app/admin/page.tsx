import Link from 'next/link';
import { redirect } from 'next/navigation';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import {
  canAccessAdmin,
  canAccessSeniorStaff,
  canEditRosterCerts,
  canManageEvents,
  canManageFlightDataPractice,
  canManageNotices,
  canManageSplits,
  canManageTrainingTickets,
  canModerateLoa,
  canManageRoster,
  deriveRoles,
} from '@/lib/auth/permissions';
import { canGradeExams, canManageExams } from '@/lib/auth/exams';
import { canModerateFeedback } from '@/lib/auth/feedback';

function pickFirstAdminTool(user: any): string {
  const isSiteAdmin = deriveRoles(user).tier === 'admin';

  const canNotices = canManageNotices(user);
  const canEvents = canManageEvents(user);
  const canDownloads = canAccessAdmin(user);
  const canRoutes = canAccessAdmin(user);
  const canSplits = canManageSplits(user);
  const canIds = isSiteAdmin;

  const canTickets = canManageTrainingTickets(user);
  const canExamsManage = canManageExams(user);
  const canExamsGrade = canGradeExams(user);
  const canFdp = canManageFlightDataPractice(user);

  const canSenior = canAccessSeniorStaff(user);
  const canFeedback = canModerateFeedback(user);
  const canLoa = canModerateLoa(user);

  const canRosterCerts = canEditRosterCerts(user);
  const canRoster = canManageRoster(user);

  // Priority order: common daily tools first.
  if (canNotices) return '/admin/notices';
  if (canEvents) return '/admin/events';
  if (canDownloads) return '/admin/downloads';
  if (canRoutes) return '/admin/routing';
  if (canSplits) return '/admin/splits';
  if (canIds) return '/admin/ids-data';

  // Learning tools
  if (canTickets) return '/admin/training-tickets';
  if (canExamsManage) return '/admin/exams';
  if (canExamsGrade) return '/admin/exams/review';
  if (canFdp) return '/admin/flight-data-practice';
  // Lesson plans are broadly useful for staff+.
  if (canAccessAdmin(user)) return '/admin/lesson-plans';

  // Management
  if (canSenior && canFeedback) return '/admin/feedback';
  if (canSenior && canLoa) return '/admin/loa';

  // Roster
  if (canRosterCerts) return canRoster ? '/admin/roster' : '/admin/roster';

  // Fallback
  return '/';
}

export default async function AdminEntryPage({
  searchParams,
}: {
  // Next.js 15/16 may provide searchParams as a Promise (dynamic APIs).
  // `await` works for both a Promise and a plain object.
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const user = await requireAdmin();

  const sp = ((await (searchParams as any)) ?? {}) as Record<string, string | string[] | undefined>;

  const forbidden =
    typeof sp?.forbidden === 'string'
      ? sp.forbidden
      : Array.isArray(sp?.forbidden)
        ? sp?.forbidden[0]
        : undefined;

  const next = pickFirstAdminTool(user);

  // Default behavior: this page should not be a hub of links anymore.
  // Instead, it routes you to the first tool you can use.
  if (!forbidden) {
    redirect(next);
  }

  // If a child page sent you here with a forbidden flag, show a small explanation.
  return (
    <PageShell title="Admin" subtitle="You don’t have access to that admin section." crumbs={[{ href: '/', label: 'Home' }, { label: 'Admin' }]}>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
        <div className="font-semibold text-white">Access denied</div>
        <div className="mt-1 text-white/70">
          You don’t have access to <span className="text-white/85 font-semibold">{forbidden}</span>. Use the Admin dropdown in the top bar, or jump to the first tool you can access.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="ui-btn" href={next}>
            Go to available admin tool
          </Link>
          <Link className="ui-btn" href="/">
            Home
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
