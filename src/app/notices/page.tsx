import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getNotices } from '@/lib/content';

export const dynamic = 'force-dynamic';

export default async function NoticesPage() {
  const notices = await getNotices(200);

  return (
    <PageShell title="Notices" subtitle={notices.length ? 'Latest updates and announcements.' : 'No notices yet.'}>
      <div className="grid gap-3">
        {notices.map((n) => (
          <Link
            key={n.id}
            href={`/notices/${n.id}`}
            className="block rounded-2xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm font-semibold">{n.title}</div>
              <div className="text-xs text-white/55 whitespace-nowrap">
                {n.updated_at ? new Date(n.updated_at as any).toLocaleString() : ''}
              </div>
            </div>
            <div className="mt-2 text-sm text-white/80 line-clamp-4 whitespace-pre-wrap">{n.body}</div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
