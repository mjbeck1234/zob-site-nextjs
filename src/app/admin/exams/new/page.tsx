import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireExamsManager } from '@/lib/auth/guards';
import { sql } from '@/lib/db';
import { createExamAction } from '../actions';

export default async function NewExamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireExamsManager();
  const sp = await searchParams;

  const hasDesc = false;

  return (
    <PageShell
      title="New Exam"
      subtitle="Create a new exam shell (add questions after)."
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        { href: '/admin/exams', label: 'Exams' },
        { label: 'New' },
      ]}
      right={<Link href="/admin/exams" className="ui-link">← Back</Link>}
    >
      <div className="grid gap-4">
        <div className="ui-card">
          <div className="ui-card__body">
            {sp.error ? (
              <div className="mb-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                {sp.error === 'missing' ? 'Title is required.' : 'Unable to create exam.'}
              </div>
            ) : null}

            <form action={createExamAction} className="grid gap-3 max-w-2xl">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Title</span>
                <input name="title" className="ui-input" required />
              </label>

              {hasDesc ? (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Description</span>
                  <textarea name="description" className="ui-input min-h-[120px]" placeholder="Optional description" />
                </label>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Pass percent</span>
                  <input name="pass_percent" type="number" min={1} max={100} defaultValue={80} className="ui-input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Number to ask</span>
                  <input name="number_to_ask" type="number" min={0} defaultValue={0} className="ui-input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Reassign period (days)</span>
                  <input name="reassign_period" type="number" min={0} defaultValue={0} className="ui-input" />
                </label>
              </div>

              <button className="ui-btn ui-btn--primary" type="submit">Create exam</button>
            </form>

            {!hasDesc ? (
              <div className="mt-4 text-xs text-white/60">
                Note: your current <code>exams</code> table does not include a <code>description</code> column. You can add it later if you want.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
