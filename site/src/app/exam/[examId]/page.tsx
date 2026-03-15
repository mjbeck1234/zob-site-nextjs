import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getUser } from '@/lib/auth/getUser';
import { canAccessAdmin } from '@/lib/auth/permissions';
import { getExamById, startOrResumeAttempt, getAttemptBundleForStudent, isExamAssignedToStudent } from '@/lib/exams';
import TakeExamClient from './take/TakeExamClient';

export default async function TakeExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const user = await getUser();
  const exam = await getExamById(examId);

  if (!exam) {
    return (
      <PageShell title="Exams" subtitle="Not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: 'Not found' }]}>
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Exam not found.</div></div></div>
      </PageShell>
    );
  }

  if (!exam.published && !(user && canAccessAdmin(user))) {
    return (
      <PageShell title="Exams" subtitle="Not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: 'Not found' }]}>
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Exam not found.</div></div></div>
      </PageShell>
    );
  }

  // Students should only be able to take exams that have been assigned to them.
  // Staff (admin/mentors/exams managers) can still open any exam for testing.
  if (user && !canAccessAdmin(user)) {
    const assigned = await isExamAssignedToStudent(Number(exam.id), Number(user.cid));
    if (!assigned) {
      return (
        <PageShell title="Exams" subtitle="Not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: 'Not found' }]}>
          <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">This exam is not assigned to you.</div></div></div>
        </PageShell>
      );
    }
  }

  if (!user) {
    return (
      <PageShell
        title={exam.title}
        subtitle="Sign in to take this exam"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: exam.title }]}
        right={<Link href="/exam" className="ui-link">← Back</Link>}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">You must be signed in to take exams.</div>
            <div className="mt-4">
              <a href="/api/auth/login" className="ui-btn ui-btn--primary">Login with VATSIM</a>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // Students should only be able to take exams that were assigned to them.
  // Staff can still open any exam (e.g., for testing).
  if (!canAccessAdmin(user)) {
    const assigned = await isExamAssignedToStudent(Number(exam.id), Number(user.cid));
    if (!assigned) {
      return (
        <PageShell
          title="Exams"
          subtitle="Not found"
          crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: 'Not found' }]}
          right={<Link href="/exam" className="ui-link">← Back</Link>}
        >
          <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">This exam is not assigned to you.</div></div></div>
        </PageShell>
      );
    }
  }

  const started = await startOrResumeAttempt(Number(exam.id), user);
  if (started.kind === 'missing') {
    return (
      <PageShell title="Exams" subtitle="Not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: 'Not found' }]}>
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Exam not found.</div></div></div>
      </PageShell>
    );
  }

  if (started.kind === 'no_questions') {
    return (
      <PageShell
        title={exam.title}
        subtitle="This exam is not ready"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: exam.title }]}
        right={<Link href="/exam" className="ui-link">← Back</Link>}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">No questions are configured yet.</div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (started.kind === 'locked') {
    return (
      <PageShell
        title={exam.title}
        subtitle="Locked"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: exam.title }]}
        right={<Link href="/exam" className="ui-link">← Back</Link>}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              This exam is locked because your most recent attempt was a fail.
              A staff member must reset it before you can retake.
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Link href={`/exam/attempt/${started.attempt.id}`} className="ui-btn ui-btn--primary">View results</Link>
              <Link href="/exam" className="ui-btn">Back to exams</Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (started.kind === 'pending') {
    return (
      <PageShell
        title={exam.title}
        subtitle="Pending review"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: exam.title }]}
        right={<Link href="/exam" className="ui-link">← Back</Link>}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">Your submission is waiting for a mentor to grade the written section.</div>
            <div className="mt-4 flex items-center gap-2">
              <Link href={`/exam/attempt/${started.attempt.id}`} className="ui-btn ui-btn--primary">View submission</Link>
              <Link href="/exam" className="ui-btn">Back to exams</Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const bundle = await getAttemptBundleForStudent(Number(started.attempt.id), user);
  if (!bundle) {
    return (
      <PageShell title={exam.title} subtitle="Unable to load" crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: exam.title }]}
        right={<Link href="/exam" className="ui-link">← Back</Link>}
      >
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Unable to load attempt.</div></div></div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={bundle.exam.title}
      subtitle={bundle.exam.description ?? 'Take your time. Your progress is saved automatically.'}
      crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: bundle.exam.title }]}
      right={(
        <div className="flex items-center gap-2">
          <Link href={`/exam/attempt/${bundle.attempt.id}`} className="ui-link">Results</Link>
          <Link href="/exam" className="ui-link">← Back</Link>
        </div>
      )}
    >
      <TakeExamClient bundle={bundle as any} />
    </PageShell>
  );
}
