import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { selectAll } from '@/lib/query';
import { deleteNoticeAction } from './actions';
import { tableExists } from '@/lib/schema';

export default async function AdminNoticesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const deleted = (sp?.deleted ?? '') === '1';

  const exists = await tableExists('notices');
  const notices = exists ? await selectAll('notices', { orderBySql: 'id DESC', limit: 200 }) : [];

  return (
    <PageShell
      title="Admin • Notices"
      subtitle="Create and manage facility notices."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Notices' }]}
      right={
        <Link href="/admin/notices/new" className="ui-button">
          New notice
        </Link>
      }
    >
      {deleted ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Notice deleted.</div>
      ) : null}

      {!exists ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Your database does not contain a <span className="font-semibold">notices</span> table.
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Latest notices</div>
          <span className="ui-badge">{notices.length}</span>
        </div>
        <div className="ui-card__body">
          {notices.length ? (
            <div className="space-y-3">
              {notices.map((n: any) => (
                <div key={String(n.id)} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{n.title ?? 'Notice'}</div>
                      <div className="mt-1 text-xs text-white/55">
                        {n.author ? `— ${n.author}` : ''}{' '}
                        {n.created_at ? `• ${new Date(n.created_at).toLocaleDateString()}` : n.published_date ? `• ${String(n.published_date)}` : ''}
                      </div>
                      {n.body ? <div className="mt-2 text-sm text-white/70 line-clamp-2 whitespace-pre-line">{String(n.body)}</div> : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/admin/notices/${n.id}`} className="ui-button">
                        Edit
                      </Link>

                      <form action={deleteNoticeAction.bind(null, String(n.id))}>
                        <button className="ui-button danger" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60">No notices found.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
