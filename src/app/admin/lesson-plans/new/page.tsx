import PageShell from '@/components/PageShell';
import { requireLessonPlansEditor } from '@/lib/auth/guards';
import { createLessonPlanAction } from '../actions';
import RichHtmlEditor from '@/components/admin/RichHtmlEditor';

export default async function NewLessonPlanPage() {
  await requireLessonPlansEditor();

  return (
    <PageShell
      title="New Lesson Plan"
      subtitle="Create a existing lesson plan record in the MySQL lesson_plans table."
      crumbs={[{ href: '/admin/lesson-plans', label: 'Lesson plans' }, { label: 'New' }]}
    >
      <form action={createLessonPlanAction} className="ui-card">
        <div className="ui-card__body grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="ui-label">Track ID *</label>
              <input
                name="track_id"
                type="number"
                min={0}
                step={1}
                required
                className="ui-input"
                defaultValue={1}
              />
            </div>

            <div>
              <label className="ui-label">Location</label>
              <input
                name="location"
                className="ui-input"
                placeholder="e.g. DEL / GND / TWR / APP / CTR"
                maxLength={3}
                defaultValue=""
              />
            </div>

            <div>
              <label className="ui-label">Workload</label>
              <input name="workload" className="ui-input" placeholder="e.g. Low / Medium" maxLength={16} defaultValue="" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="ui-label">Lesson name *</label>
              <input name="lesson_name" className="ui-input" required maxLength={256} />
            </div>
            <div>
              <label className="ui-label">Time (minutes)</label>
              <input name="time" type="number" className="ui-input" min={0} step={1} defaultValue={60} />
            </div>
          </div>

          <div>
            <label className="ui-label">Session orientation</label>
            <input
              name="session_orientation"
              className="ui-input"
              placeholder="Quick session overview / orientation"
              maxLength={256}
              defaultValue=""
            />
          </div>

          <div>
            <RichHtmlEditor
              name="theory"
              label="Theory"
              placeholder="Add theory, references, and notes…"
              helpText="Supports bold/underline/lists/links. Saved as simple HTML compatible with the previous site."
              minHeight={220}
            />
          </div>

          <div>
            <RichHtmlEditor
              name="competencies"
              label="Competencies"
              placeholder="Add competencies…"
              helpText="Tip: use bullets for clean scanning."
              minHeight={180}
            />
          </div>

          <div>
            <RichHtmlEditor
              name="approved_sweatbox_files"
              label="Approved sweatbox files"
              placeholder="Add file names / sets…"
              helpText="Use bullets or a simple list."
              minHeight={140}
            />
          </div>

          <div>
            <RichHtmlEditor name="notes" label="Notes" placeholder="Anything extra…" minHeight={140} />
          </div>
        </div>

        <div className="ui-card__footer flex items-center justify-end gap-2">
          <a href="/admin/lesson-plans" className="ui-btn ui-btn--secondary">
            Cancel
          </a>
          <button type="submit" className="ui-btn ui-btn--primary">
            Create
          </button>
        </div>
      </form>
    </PageShell>
  );
}
