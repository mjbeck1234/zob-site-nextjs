import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getUser } from '@/lib/auth/getUser';
import { deriveRoles } from '@/lib/auth/permissions';

export default async function LearningCenterPage() {
  const user = await getUser();
  const roles = user ? deriveRoles(user) : null;

  return (
    <PageShell
      title="Learning Center"
      subtitle="Training resources for ZOB controllers — CBTs, exams, and flight data practice."
      crumbs={[{ href: '/', label: 'Home' }, { label: 'Learning' }]}
      right={
        user ? (
          <div className="text-right">
            <div className="text-sm font-semibold">{user.fullName}</div>
            <div className="text-xs text-white/60">
              {roles?.tier === 'non_member' ? 'Not on roster' : roles?.tier?.replace('_', ' ') ?? '—'}
            </div>
          </div>
        ) : (
          <a href="/api/auth/login" className="ui-btn ui-btn--primary">
            Login with VATSIM
          </a>
        )
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">CBTs</div>
              <div className="text-xs text-white/60">Onboarding and theory modules</div>
            </div>
          </div>
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              Watch controller briefings and record completion.
            </div>
            <div className="mt-4">
              <Link href="/learning/cbts" className="ui-btn ui-btn--primary">
                Open CBTs
              </Link>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Exams</div>
              <div className="text-xs text-white/60">Assigned exams and your results</div>
            </div>
          </div>
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              Take knowledge checks and review your graded attempts.
            </div>
            <div className="mt-4">
              <Link href="/exam" className="ui-btn ui-btn--primary">
                Open Exams
              </Link>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Flight Data Practice</div>
              <div className="text-xs text-white/60">Fix flight plans and practice clearances</div>
            </div>
          </div>
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              Work randomized practice cases to build speed and accuracy.
            </div>
            <div className="mt-4">
              <Link href="/learning/flight-data-practice" className="ui-btn ui-btn--primary">
                Start Practice
              </Link>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Syllabus</div>
              <div className="text-xs text-white/60">Mentor-fillable progress checklist</div>
            </div>
          </div>
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              Keep training progress in one place — view your own syllabus or (mentors) update a student’s.
            </div>
            <div className="mt-4">
              <Link href="/learning/syllabus" className="ui-btn ui-btn--primary">
                Open Syllabus
              </Link>
            </div>
          </div>
        </div>
      </div>

      {roles?.tier === 'non_member' ? (
        <div className="mt-6 ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              Some learning tools are restricted to ZOB home/visiting controllers. If you are transferring in or your roster status looks wrong, contact staff.
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
