import PageShell from '@/components/PageShell';
import LessonPlanText from '@/components/LessonPlanText';
import PrintButton from '@/components/PrintButton';
import { requireLessonPlansEditor } from '@/lib/auth/guards';
import { getLessonPlanById } from '@/lib/lessonPlans';
import { deleteLessonPlanAction, updateLessonPlanAction } from '../actions';
import RichHtmlEditor from '@/components/admin/RichHtmlEditor';

function fmtMinutes(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${n} min`;
}

function normalizeHtmlContentForEditor(value: any): string {
  let s = (value ?? '').toString();
  if (!s.trim()) return '';

  s = s.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  s = s.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
  s = s.replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\sstyle=("[^"]*"|'[^']*')/gi, '');
  s = s.replace(/\sclass=("[^"]*"|'[^']*')/gi, '');
  s = s.replace(/<\/?(span|font)[^>]*>/gi, '');
  s = s.replace(/<br\s*\/?\s*>/gi, '<br />');
  return s.trim();
}

export default async function LessonPlanDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  await requireLessonPlansEditor();
  const { id } = await params;
  const sp = await searchParams;
  const editing = String(sp.edit ?? '') === '1';

  const idNum = Number(id);
  const plan = Number.isFinite(idNum) ? await getLessonPlanById(idNum) : null;
  if (!plan) {
    return (
      <PageShell
        title="Lesson Plan"
        subtitle="Not found"
        crumbs={[{ href: '/admin/lesson-plans', label: 'Lesson Plans' }, { label: 'Not found' }]}
      >
        <div className="ui-card p-5">Could not find that lesson plan.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={plan.lesson_name}
      subtitle={`Track ${plan.track_id}${plan.location ? ` • ${plan.location}` : ''}`}
      crumbs={[{ href: '/admin/lesson-plans', label: 'Lesson Plans' }, { label: plan.lesson_name }]}
      actions={
        <div className="flex gap-2">
          {!editing ? <PrintButton /> : null}
          {!editing ? (
            <a className="ui-btn" href={`/admin/lesson-plans/${plan.id}?edit=1`}>Edit</a>
          ) : (
            <a className="ui-btn" href={`/admin/lesson-plans/${plan.id}`}>Cancel</a>
          )}
        </div>
      }
    >
      {!editing ? (
        <div className="lesson-print grid gap-4">
          {/* Overview */}
          <div className="ui-card p-5 lesson-section">
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <div>
                <div className="text-sm font-semibold">At a glance</div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/60">Track</div>
                    <div className="mt-1 font-semibold">{plan.track_id}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/60">Location</div>
                    <div className="mt-1 font-semibold">{plan.location || '—'}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/60">Workload</div>
                    <div className="mt-1 font-semibold">{plan.workload || '—'}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/60">Time</div>
                    <div className="mt-1 font-semibold">{fmtMinutes(plan.time) || '—'}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold">Session orientation</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-white/85">
                  <LessonPlanText value={plan.session_orientation} smartList={false} />
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="grid gap-4 md:grid-cols-2 lesson-two-col">
            <div className="ui-card p-5 lesson-section">
              <div className="text-sm font-semibold">Theory</div>
              <LessonPlanText value={plan.theory} className="mt-3" />
            </div>

            <div className="ui-card p-5 lesson-section">
              <div className="text-sm font-semibold">Competencies</div>
              <LessonPlanText value={plan.competencies} className="mt-3" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lesson-two-col">
            <div className="ui-card p-5 lesson-section">
              <div className="text-sm font-semibold">Approved sweatbox files</div>
              <LessonPlanText value={plan.approved_sweatbox_files} className="mt-3" />
            </div>

            <div className="ui-card p-5 lesson-section">
              <div className="text-sm font-semibold">Notes</div>
              <LessonPlanText value={plan.notes} className="mt-3" smartList={false} />
            </div>
          </div>

          <form action={deleteLessonPlanAction} className="no-print">
            <input type="hidden" name="id" value={String(plan.id)} />
            <button type="submit" className="ui-btn ui-btn--danger">
              Delete
            </button>
          </form>
        </div>
      ) : (
        <div className="ui-card p-5">
          <form action={updateLessonPlanAction} className="grid gap-4">
            <input type="hidden" name="id" value={String(plan.id)} />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm text-white/70">Lesson Name</span>
                <input name="lesson_name" defaultValue={plan.lesson_name} className="ui-input" required />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-white/70">Track ID</span>
                <input name="track_id" type="number" defaultValue={plan.track_id} className="ui-input" required />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-sm text-white/70">Location</span>
                <input name="location" defaultValue={plan.location} className="ui-input" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-white/70">Workload</span>
                <input name="workload" defaultValue={plan.workload} className="ui-input" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-white/70">Time (minutes)</span>
                <input name="time" type="number" defaultValue={plan.time} className="ui-input" />
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-sm text-white/70">Session Orientation</span>
              <input name="session_orientation" defaultValue={plan.session_orientation} className="ui-input" />
            </label>

            <div className="grid gap-1">
              <RichHtmlEditor
                name="theory"
                label="Theory"
                initialHtml={normalizeHtmlContentForEditor(plan.theory)}
                placeholder="Add theory, references, and notes…"
                helpText="Supports bold/underline/lists/links. Saved as simple HTML compatible with the previous site."
                minHeight={220}
              />
            </div>

            <div className="grid gap-1">
              <RichHtmlEditor
                name="competencies"
                label="Competencies"
                initialHtml={normalizeHtmlContentForEditor(plan.competencies)}
                placeholder="Add competencies…"
                helpText="Tip: use bullets for clean scanning."
                minHeight={180}
              />
            </div>

            <div className="grid gap-1">
              <RichHtmlEditor
                name="approved_sweatbox_files"
                label="Approved Sweatbox Files"
                initialHtml={normalizeHtmlContentForEditor(plan.approved_sweatbox_files)}
                placeholder="Add file names / sets…"
                helpText="Use bullets or a simple list."
                minHeight={140}
              />
            </div>

            <div className="grid gap-1">
              <RichHtmlEditor
                name="notes"
                label="Notes"
                initialHtml={normalizeHtmlContentForEditor(plan.notes)}
                placeholder="Anything extra…"
                minHeight={140}
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="ui-btn ui-btn--primary">
                Save
              </button>
              <a className="ui-btn" href={`/admin/lesson-plans/${plan.id}`}>
                Cancel
              </a>
            </div>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="text-sm text-white/70">Danger zone</div>
            <form action={deleteLessonPlanAction}>
              <input type="hidden" name="id" value={String(plan.id)} />
              <button
                type="submit"
                className="ui-btn ui-btn--danger mt-2"
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
