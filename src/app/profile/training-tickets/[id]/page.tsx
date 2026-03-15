import Link from 'next/link';

import PageShell from '@/components/PageShell';
import HtmlContent from '@/components/HtmlContent';
import TrainingTicketRubricView from '@/components/training/TrainingTicketRubricView';
import { requireLogin } from '@/lib/auth/guards';
import { getRoster } from '@/lib/content';
import { TRAINING_SESSION_TYPES, getTrainingTicketsSchemaInfo, getTrainingTicketForStudent, trainingTicketsEnabledForProfile } from '@/lib/trainingTickets';

function displayName(r: any) {
  const pref = String(r?.pref_name ?? r?.prefName ?? r?.preferred_name ?? r?.preferredName ?? '').trim();
  const first =
    pref ||
    String(
      r?.first_name ?? r?.firstName ?? r?.first ?? r?.firstname ?? r?.fname ?? r?.given_name ?? r?.givenName ?? ''
    ).trim();
  const last = String(r?.last_name ?? r?.lastName ?? r?.last ?? r?.lastname ?? r?.lname ?? r?.surname ?? '').trim();
  const cid = r?.cid ? String(r.cid) : '';
  const base = `${first} ${last}`.trim();
  return `${base || 'Unknown'} (#${cid})`;
}

function typeLabel(v: any) {
  const s = String(v ?? '');
  return TRAINING_SESSION_TYPES.find((t) => t.value === s)?.label ?? s;
}

function fmt(v: any) {
  if (!v) return '—';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default async function ProfileTrainingTicketDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const user = await requireLogin();
  const p = await Promise.resolve(params);
  const idRaw = String((p as any)?.id ?? '');
  const id = Number(idRaw);

  const enabled = await trainingTicketsEnabledForProfile();
  const info = await getTrainingTicketsSchemaInfo();
  if (!enabled.enabled) {
    return (
      <PageShell
        title="Training Ticket"
        subtitle="Training tickets are not enabled."
        crumbs={[{ href: '/', label: 'Home' }, { href: '/profile', label: 'Profile' }, { href: '/profile/training-tickets', label: 'Training Tickets' }, { label: idRaw || 'Unknown' }]}
        actions={
          <Link href="/profile/training-tickets" className="ui-btn">
            Back
          </Link>
        }
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">Training tickets are not enabled in your current database schema.</div>
          </div>
        </div>
      </PageShell>
    );
  }

  const isValidId = Number.isFinite(id) && id > 0;
  const ticket = isValidId ? await getTrainingTicketForStudent(id, Number(user.cid)) : null;

  if (!ticket) {
    return (
      <PageShell
        title="Training Ticket"
        subtitle="Ticket not found."
        crumbs={[{ href: '/', label: 'Home' }, { href: '/profile', label: 'Profile' }, { href: '/profile/training-tickets', label: 'Training Tickets' }, { label: idRaw || 'Unknown' }]}
        actions={
          <Link href="/profile/training-tickets" className="ui-btn">
            Back
          </Link>
        }
      >
        <div className="ui-card">
          <div className="ui-card__body text-sm text-white/70">
            {isValidId ? 'This ticket may have been deleted.' : 'Invalid training ticket id.'}
          </div>
        </div>
      </PageShell>
    );
  }

  const roster = (await getRoster().catch(() => [])) as any[];
  const rosterByCid = new Map<string, string>(roster.map((r) => [String(r.cid), displayName(r)]));
  const mentor = rosterByCid.get(String(ticket.mentor_cid)) ?? (ticket as any).mentor_name ?? `#${String(ticket.mentor_cid ?? '')}`;
  const student = rosterByCid.get(String(ticket.student_cid)) ?? (ticket as any).student_name ?? `#${String(ticket.student_cid ?? '')}`;
  const isNoShow = info.hasNoShow ? Boolean((ticket as any).no_show) : false;

  return (
    <PageShell
      title={`Training Ticket #${id}`}
      subtitle="Student view (mentor-only notes hidden)."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/profile', label: 'Profile' }, { href: '/profile/training-tickets', label: 'Training Tickets' }, { label: `#${id}` }]}
      actions={
        <Link href="/profile/training-tickets" className="ui-btn">
          Back
        </Link>
      }
    >
      {isNoShow ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Marked as a student no-show.
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="ui-card">
          <div className="ui-card__body grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60">Student</div>
              <div className="mt-1 text-sm text-white/90">{student}</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Mentor</div>
              <div className="mt-1 text-sm text-white/90">{mentor}</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Session type</div>
              <div className="mt-1 text-sm text-white/90">{typeLabel(ticket.session_type)}</div>
            </div>
            {(ticket as any).training_category || (ticket as any).position ? (
              <div>
                <div className="text-xs text-white/60">Category</div>
                <div className="mt-1 text-sm text-white/90">{String((ticket as any).training_category ?? (ticket as any).position)}</div>
              </div>
            ) : null}
            <div>
              <div className="text-xs text-white/60">Duration</div>
              <div className="mt-1 text-sm text-white/90">{Number(ticket.duration_minutes) || 0} minutes</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Session start</div>
              <div className="mt-1 text-sm text-white/90">{fmt(ticket.session_start)}</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Last updated</div>
              <div className="mt-1 text-sm text-white/90">
                {info.hasUpdatedAt ? fmt((ticket as any).updated_at) : fmt((ticket as any).created_at)}
              </div>
            </div>
          </div>
        </div>

        {(ticket as any).scenario_summary ? (
          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Scenario summary</div>
            </div>
            <div className="ui-card__body text-sm text-white/80">{String((ticket as any).scenario_summary)}</div>
          </div>
        ) : null}

        {info.hasRubric ? (
          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Rubric</div>
            </div>
            <div className="ui-card__body">
              <TrainingTicketRubricView
                rubricRatings={(ticket as any).rubric_ratings}
                rubricChecks={(ticket as any).rubric_checks}
                variant="bullets"
              />
            </div>
          </div>
        ) : null}

        {info.hasNotesSplit || (ticket as any).notes_student ? (
          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Notes to you</div>
            </div>
            <HtmlContent
              className="ui-card__body text-sm text-white/80 whitespace-normal leading-relaxed"
              html={String((ticket as any).notes_student ?? '').trim() || '—'}
            />
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
