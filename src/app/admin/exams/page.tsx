import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireExamsManager } from '@/lib/auth/guards';
import { examsEnabled, listAllExams } from '@/lib/exams';

export default async function AdminExamsPage({ searchParams }: { searchParams: Promise<{ deleted?: string; created?: string; assigned?: string }> }) {
  await requireExamsManager();
  const sp = await searchParams;
  const ok = await examsEnabled();
  const rows = ok ? await listAllExams() : [];

  return (
    <PageShell
      title="Admin: Exams"
      subtitle="Create and manage exams, questions, and answer keys."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Exams' }]}
      right={(
        <div className="flex items-center gap-2">
          <Link href="/admin/exams/review" className="ui-btn">Review queue</Link>
          <Link href="/admin/exams/assign" className="ui-btn">Assign exam</Link>
          <Link href="/admin/exams/new" className="ui-btn ui-btn--primary">New exam</Link>
        </div>
      )}
    >
      {!ok ? (
        <div className="ui-card"><div className="ui-card__body">
          <div className="text-sm text-white/70">
            Exams tables are not installed yet. Run <span className="text-white/85 font-semibold">sql/create_tables_exams.sql</span>.
          </div>
        </div></div>
      ) : (
        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Exams</div>
              <div className="text-xs text-white/60">{rows.length} total</div>
            </div>
          </div>
          <div className="ui-card__body">
            {sp.deleted === '1' ? <div className="mb-4 ui-badge">Deleted</div> : null}
            {sp.assigned === '1' ? <div className="mb-4 ui-badge">Assigned</div> : null}
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Pass</th>
                      <th>Published</th>
                      <th>Archived</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <div className="text-white font-semibold">{e.title}</div>
                          {e.description ? <div className="text-xs text-white/60 mt-1">{e.description}</div> : null}
                        </td>
                        <td>{e.pass_percent}%</td>
                        <td>{e.published ? 'Yes' : 'No'}</td>
                        <td>{e.archived ? 'Yes' : 'No'}</td>
                        <td className="text-right whitespace-nowrap">
                          <Link href={`/admin/exams/${e.id}`} className="ui-btn ui-btn--primary">Edit</Link>
                          <span className="text-white/20">&nbsp;•&nbsp;</span>
                          <Link href={`/exam/${e.id}`} className="ui-link">Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-white/70">No exams.</div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
