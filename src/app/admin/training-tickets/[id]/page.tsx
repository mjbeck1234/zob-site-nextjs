import Link from 'next/link';

import PageShell from '@/components/PageShell';
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';
import TrainingTicketRubric from '@/components/training/TrainingTicketRubric';
import { requireTrainingTicketWriter } from '@/lib/auth/guards';
import { deriveRoles } from '@/lib/auth/permissions';
import { canEditTrainingTicket } from '@/lib/auth/trainingTickets';
import { getById } from '@/lib/admin/crud';
import { getRoster } from '@/lib/content';
import { TRAINING_SESSION_TYPES } from '@/lib/trainingTickets';

import { deleteTrainingTicketAction, updateTrainingTicketAction } from '../actions';

function displayName(r: any) {
  const pref = String(r?.pref_name ?? r?.prefName ?? '').trim();
  const first = pref || String(r?.first_name ?? r?.firstName ?? '').trim();
  const last = String(r?.last_name ?? '').trim();
  const cid = r?.cid ? String(r.cid) : '';
  const base = `${first} ${last}`.trim();
  return `${base || 'Unknown'} (#${cid})`;
}

function toDatetimeLocalValue(v: any): string {
  if (!v) return '';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

export default async function EditTrainingTicketPage({
  params,
  searchParams,
}: {
  // In newer Next.js versions, params/searchParams may be Promises in Server Components.
  params: { id: string } | Promise<{ id: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const actor = await requireTrainingTicketWriter();
  const roles = deriveRoles(actor);
  const canDelete = roles.tier === 'admin';

  const p = await Promise.resolve(params);
  const id = String((p as any)?.id ?? '');
  // Avoid passing "undefined" (or other invalid ids) into Postgres integer comparisons.
  const isValidId = /^\d+$/.test(id);
  const ticket = isValidId ? await getById('training_tickets', id) : null;

  // Row-level authorization: only senior training staff can access all tickets.
  // Mentors/Instructors can only edit tickets where they are the mentor.
  if (ticket && !canEditTrainingTicket(actor, ticket)) {
    return (
      <PageShell
        title="Training Ticket"
        subtitle="Ticket not found."
        crumbs={[
          { href: '/', label: 'Home' },
          { href: '/admin', label: 'Admin' },
          { href: '/admin/training-tickets', label: 'Training Tickets' },
          { label: isValidId ? id : 'Unknown' },
        ]}
        actions={
          <Link href="/admin/training-tickets" className="ui-btn">
            Back
          </Link>
        }
      >
        <div className="ui-card">
          <div className="ui-card__body text-sm text-white/60">
            This ticket may have been deleted.
          </div>
        </div>
      </PageShell>
    );
  }

  const error = typeof sp.error === 'string' ? sp.error : '';
  const saved = typeof sp.saved === 'string' ? sp.saved === '1' : false;

  if (!ticket || !canEditTrainingTicket(actor, ticket)) {
    return (
      <PageShell
        title="Training Ticket"
        subtitle="Ticket not found."
        crumbs={[
          { href: '/', label: 'Home' },
          { href: '/admin', label: 'Admin' },
          { href: '/admin/training-tickets', label: 'Training Tickets' },
          { label: isValidId ? id : 'Unknown' },
        ]}
        actions={
          <Link href="/admin/training-tickets" className="ui-btn">
            Back
          </Link>
        }
      >
        <div className="ui-card">
          <div className="ui-card__body text-sm text-white/60">
            {isValidId ? 'This ticket may have been deleted.' : 'Invalid training ticket id.'}
          </div>
        </div>
      </PageShell>
    );
  }

  const roster = (await getRoster()) as any[];
  const deleteFormId = `delete-training-ticket-${id}`;
  const isNoShow = toBool((ticket as any).no_show);

  return (
    <PageShell
      title={`Training Ticket #${id}`}
      subtitle="Edit session details."
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        { href: '/admin/training-tickets', label: 'Training Tickets' },
        { label: `#${id}` },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/training-tickets" className="ui-btn">
            Back
          </Link>
          <Link href="/admin/training-tickets/new" className="ui-btn ui-btn--primary">
            New Ticket
          </Link>
        </div>
      }
    >
      {saved ? (
        <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          Training ticket updated.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Please fill in all required fields.
        </div>
      ) : null}

      {isNoShow ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Marked as a student no-show.
        </div>
      ) : null}

      {/* Separate delete form (no nested forms). */}
      {canDelete ? <form id={deleteFormId} action={deleteTrainingTicketAction.bind(null, id)} /> : null}

      <form action={updateTrainingTicketAction.bind(null, id)} className="ui-card">
        <div className="ui-card__body grid gap-4">
          <input type="hidden" name="lesson_plan_id" value={ticket?.lesson_plan_id ? String(ticket.lesson_plan_id) : ''} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="ui-label">Student</label>
              <select name="student_cid" className="ui-input" required defaultValue={String(ticket.student_cid ?? '')}>
                <option value="" disabled>
                  Select a student...
                </option>
                {roster.map((r) => (
                  <option key={String(r.cid)} value={String(r.cid)}>
                    {displayName(r)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="ui-label">Mentor</label>
              <select
                name="mentor_cid"
                className="ui-input"
                required
                defaultValue={String(ticket.mentor_cid ?? actor.cid)}
              >
                <option value="" disabled>
                  Select a mentor...
                </option>
                {roster.map((r) => (
                  <option key={String(r.cid)} value={String(r.cid)}>
                    {displayName(r)}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-white/50">(Usually you, but editable for cleanup.)</div>
            </div>

            <div>
              <label className="ui-label">Session type</label>
              <select
                name="session_type"
                className="ui-input"
                required
                defaultValue={String(ticket.session_type ?? TRAINING_SESSION_TYPES[0].value)}
              >
                {TRAINING_SESSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="ui-label">Duration (minutes)</label>
              <input
                name="duration_minutes"
                type="number"
                min={0}
                step={1}
                className="ui-input"
                defaultValue={Number(ticket.duration_minutes) || 0}
              />
              <div className="mt-1 text-xs text-white/50">If marked as No-show, duration is forced to 0.</div>
            </div>

            <div>
              <label className="ui-label">Session start</label>
              <input
                name="session_start"
                type="datetime-local"
                className="ui-input"
                required
                defaultValue={toDatetimeLocalValue(ticket.session_start)}
              />
              <div className="mt-1 text-xs text-white/50">Uses your browser’s local time.</div>
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <input type="checkbox" name="no_show" value="1" defaultChecked={isNoShow} />
                <span className="text-sm text-white/90">Student no-show</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="ui-label">Scenario summary (optional)</label>
              <input
                name="scenario_summary"
                className="ui-input"
                defaultValue={(ticket as any).scenario_summary ? String((ticket as any).scenario_summary) : ''}
                placeholder="e.g., Moderate: light to moderate traffic"
              />
            </div>

            <div className="md:col-span-2">
              <label className="ui-label">General notes (optional)</label>
              <textarea
                name="notes"
                className="ui-input min-h-[90px]"
                defaultValue={ticket.notes ? String(ticket.notes) : ''}
                placeholder="What was covered? Any follow-up?"
              />
            </div>

            <div>
              <label className="ui-label">Notes to the student (optional)</label>
              <textarea
                name="notes_student"
                className="ui-input min-h-[140px]"
                defaultValue={(ticket as any).notes_student ? String((ticket as any).notes_student) : ''}
                placeholder="Feedback the student should see..."
              />
            </div>

            <div>
              <label className="ui-label">Notes for future mentors (optional)</label>
              <textarea
                name="notes_future"
                className="ui-input min-h-[140px]"
                defaultValue={(ticket as any).notes_future ? String((ticket as any).notes_future) : ''}
                placeholder="Context for future sessions..."
              />
            </div>
          </div>

          <div className="mt-2">
            <div className="mb-2 text-sm font-semibold text-white">Rubric</div>
            <TrainingTicketRubric initialRatings={(ticket as any).rubric_ratings} initialChecks={(ticket as any).rubric_checks} />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {canDelete ? (
              <ConfirmSubmitButton
                form={deleteFormId}
                confirmMessage="Delete this training ticket? This cannot be undone."
                type="submit"
                className="ui-btn ui-btn--danger"
              >
                Delete (admin)
              </ConfirmSubmitButton>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Link href="/admin/training-tickets" className="ui-btn">
                Cancel
              </Link>
              <button type="submit" className="ui-btn ui-btn--primary">
                Save changes
              </button>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
