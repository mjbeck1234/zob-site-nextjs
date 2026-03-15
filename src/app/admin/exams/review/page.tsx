import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireExamsGrader } from '@/lib/auth/guards';
import { canManageExams } from '@/lib/auth/exams';
import { listAttemptsNeedingReview } from '@/lib/exams';

export default async function ExamReviewQueuePage() {
  const user = await requireExamsGrader();
  const canManage = canManageExams(user);
  const rows = await listAttemptsNeedingReview();

  return (
    <PageShell
      title="Exam Review Queue"
      subtitle="Written responses waiting for mentor grading"
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        ...(canManage ? [{ href: '/admin/exams', label: 'Exams' }] : [{ label: 'Exams' }]),
        { label: 'Review queue' },
      ]}
      right={<Link href={canManage ? '/admin/exams' : '/admin'} className="ui-link">← Back</Link>}
    >
      <div className="ui-card">
        <div className="ui-card__body">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Attempt</th>
                    <th>Exam</th>
                    <th>Student</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>#{a.id}</td>
                      <td>{a.exam_title ?? `Exam #${a.exam_id}`}</td>
                      <td>{a.student_name ?? a.student_cid}</td>
                      <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}</td>
                      <td className="text-right whitespace-nowrap">
                        <Link className="ui-btn ui-btn--primary" href={`/admin/exams/review/${a.id}`}>Grade</Link>
                        <span className="text-white/20">&nbsp;•&nbsp;</span>
                        <Link className="ui-link" href={`/exam/attempt/${a.id}`}>View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-white/70">No attempts are waiting for review.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
