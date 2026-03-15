import Link from 'next/link';
import PageShell from '@/components/PageShell';
import TrainingTicketRubric from '@/components/training/TrainingTicketRubric';
import { requireTrainingTicketWriter } from '@/lib/auth/guards';
import { getRoster } from '@/lib/content';
import { TRAINING_SESSION_TYPES } from '@/lib/trainingTickets';
import { getLessonPlanById } from '@/lib/lessonPlans';
import { createTrainingTicketAction } from '../actions';

function displayName(r: any) {
  const pref = String(r?.pref_name ?? r?.prefName ?? '').trim();
  const first = pref || String(r?.first_name ?? r?.firstName ?? '').trim();
  const last = String(r?.last_name ?? '').trim();
  const cid = r?.cid ? String(r.cid) : '';
  const base = `${first} ${last}`.trim();
  return `${base || 'Unknown'} (#${cid})`;
}

export default async function NewTrainingTicketPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const actor = await requireTrainingTicketWriter();
  const roster = (await getRoster()) as any[];


  const lessonPlanIdRaw = typeof (sp as any)?.lessonPlanId === 'string' ? String((sp as any).lessonPlanId) : '';
  const lessonPlanId = lessonPlanIdRaw && !Number.isNaN(Number(lessonPlanIdRaw)) ? Number(lessonPlanIdRaw) : null;
  const lessonPlan = lessonPlanId ? await getLessonPlanById(lessonPlanId) : null;

  // Stored lesson_plans schema doesn't include default session type; keep current default.
  const defaultSessionType = TRAINING_SESSION_TYPES[0].value;
  const defaultScenarioSummary = lessonPlan
    ? String((lessonPlan as any).session_orientation ?? (lessonPlan as any).lesson_name ?? '')
    : '';

  const error = typeof sp.error === 'string' ? sp.error : '';

  return (
    <PageShell
      title="New Training Ticket"
      subtitle="Record a mentoring/training session."
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        { href: '/admin/training-tickets', label: 'Training Tickets' },
        { label: 'New' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/training-tickets" className="ui-btn">
            Back
          </Link>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Please fill in all required fields.
        </div>
      ) : null}

      {lessonPlan ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Using lesson plan:{' '}
          <span className="font-semibold">{String((lessonPlan as any).lesson_name)}</span>{' '}
          (Track {String((lessonPlan as any).track_id)}, {String((lessonPlan as any).location)})
        </div>
      ) : null}

      <form action={createTrainingTicketAction} className="ui-card">
        <div className="ui-card__body grid gap-4">
          <input type="hidden" name="mentor_cid" value={String(actor.cid)} />
          {lessonPlan ? <input type="hidden" name="lesson_plan_id" value={String(lessonPlan.id)} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="ui-label">Student</label>
              <select name="student_cid" className="ui-input" required defaultValue="">
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
              <label className="ui-label">Session type</label>
              <select
                name="session_type"
                className="ui-input"
                required
                defaultValue={defaultSessionType}
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
                defaultValue={60}
              />
              <div className="mt-1 text-xs text-white/50">If marked as No-show, duration is forced to 0.</div>
            </div>

            <div>
              <label className="ui-label">Session start</label>
              <input name="session_start" type="datetime-local" className="ui-input" required />
              <div className="mt-1 text-xs text-white/50">Uses your browser’s local time.</div>
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <input type="checkbox" name="no_show" value="1" />
                <span className="text-sm text-white/90">Student no-show</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="ui-label">Scenario summary (optional)</label>
              <input
                name="scenario_summary"
                className="ui-input"
                placeholder="e.g., Moderate: light to moderate traffic"
                defaultValue={defaultScenarioSummary}
              />
            </div>

            <div className="md:col-span-2">
              <label className="ui-label">General notes (optional)</label>
              <textarea
                name="notes"
                className="ui-input min-h-[90px]"
                placeholder="What was covered? Any follow-up?"
              />
            </div>

            <div>
              <label className="ui-label">Notes to the student (optional)</label>
              <textarea
                name="notes_student"
                className="ui-input min-h-[140px]"
                placeholder="Feedback the student should see..."
              />
            </div>

            <div>
              <label className="ui-label">Notes for future mentors (optional)</label>
              <textarea
                name="notes_future"
                className="ui-input min-h-[140px]"
                placeholder="Context for future sessions..."
              />
            </div>
          </div>

          <div className="mt-2">
            <div className="mb-2 text-sm font-semibold text-white">Rubric</div>
            <TrainingTicketRubric />
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Link href="/admin/training-tickets" className="ui-btn">
              Cancel
            </Link>
            <button type="submit" className="ui-btn ui-btn--primary">
              Save ticket
            </button>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
