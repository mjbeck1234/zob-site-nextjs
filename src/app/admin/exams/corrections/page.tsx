import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireExamsGrader } from '@/lib/auth/guards';
import { canManageExams } from '@/lib/auth/exams';
import { examCorrectionsEnabled, listPendingCorrections } from '@/lib/exams';

export default async function CorrectionsQueuePage() {
  const user = await requireExamsGrader();
  const canManage = canManageExams(user);
  const enabled = await examCorrectionsEnabled();

  if (!enabled) {
    return (
      <PageShell
        title="Exam corrections"
        subtitle="Install the corrections table to enable this queue."
        crumbs={[
          { href: '/', label: 'Home' },
          { href: '/admin', label: 'Admin' },
          ...(canManage ? [{ href: '/admin/exams', label: 'Exams' }] : [{ label: 'Exams' }]),
          { label: 'Corrections' },
        ]}
      >
        <div className="ui-card"><div className="ui-card__body">
          <div className="text-sm text-white/70">Corrections are not installed yet.</div>
          <div className="mt-2 text-xs text-white/60">Run <span className="font-mono">sql/create_tables_exam_corrections.sql</span> in your database.</div>
        </div></div>
      </PageShell>
    );
  }

  const items = await listPendingCorrections();

  return (
    <PageShell
      title="Exam corrections"
      subtitle={`${items.length} pending request(s)`}
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        ...(canManage ? [{ href: '/admin/exams', label: 'Exams' }] : [{ label: 'Exams' }]),
        { label: 'Corrections' },
      ]}
      right={(
        <div className="flex items-center gap-2">
          <Link className="ui-link" href="/admin/exams">← Back</Link>
        </div>
      )}
    >
      <div className="ui-card">
        <div className="ui-card__body">
          {!items.length ? (
            <div className="text-sm text-white/70">No pending corrections.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ui-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Created</th>
                    <th className="text-left">Exam</th>
                    <th className="text-left">Student</th>
                    <th className="text-left">Attempt</th>
                    <th className="text-left">Question</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c: any) => (
                    <tr key={c.id} className="hover:bg-white/[0.03]">
                      <td>
                        <Link className="ui-link block" href={`/admin/exams/corrections/${c.id}`}>
                          {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                        </Link>
                      </td>
                      <td>
                        <Link className="ui-link block" href={`/admin/exams/corrections/${c.id}`}>
                          {c.exam_title ?? c.exam_id ?? ''}
                        </Link>
                      </td>
                      <td>
                        <Link className="ui-link block" href={`/admin/exams/corrections/${c.id}`}>
                          {c.student_name ?? c.student_cid}
                        </Link>
                      </td>
                      <td>
                        <Link className="ui-link block" href={`/admin/exams/corrections/${c.id}`}>
                          #{c.attempt_id}
                          <div className="text-xs text-white/60">{c.attempt_status ?? ''}</div>
                        </Link>
                      </td>
                      <td>
                        <Link className="ui-link block" href={`/admin/exams/corrections/${c.id}`}>
                          #{c.question_id}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
