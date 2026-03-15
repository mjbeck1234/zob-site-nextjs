import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageShell from '@/components/PageShell';
import RichMarkdown from '@/components/RichMarkdown';
import { getNoticeById } from '@/lib/content';

export const dynamic = 'force-dynamic';

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const noticeId = Number(id);
  if (!Number.isFinite(noticeId)) notFound();

  const notice = await getNoticeById(noticeId);
  if (!notice) notFound();

  return (
    <PageShell
      title={notice.title}
      subtitle={notice.updated_at ? `Updated ${new Date(notice.updated_at as any).toLocaleString()}` : ''}
    >
      <div className="mb-4">
        <Link href="/notices" className="text-sm text-white/70 hover:text-white">
          ← Back to notices
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <RichMarkdown content={notice.body || ''} />
      </div>
    </PageShell>
  );
}
