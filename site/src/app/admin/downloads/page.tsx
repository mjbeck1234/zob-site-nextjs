import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { selectAll } from '@/lib/query';
import { deleteDownloadAction } from './actions';
import { tableExists } from '@/lib/schema';

export default async function AdminDownloadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const deleted = (sp?.deleted ?? '') === '1';

  const exists = await tableExists('downloads');
  const rows = exists ? await selectAll('downloads', { orderBySql: 'id DESC', limit: 200 }) : [];

  return (
    <PageShell
      title="Admin • Downloads"
      subtitle="Manage downloadable resources."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Downloads' }]}
      right={(
        <Link href="/admin/downloads/new" className="ui-button">
          New download
        </Link>
      )}
    >
      {deleted ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Download deleted.</div>
      ) : null}

      {!exists ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Your database does not contain a <span className="font-semibold">downloads</span> table.
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Latest downloads</div>
          <span className="ui-badge">{rows.length}</span>
        </div>
        <div className="ui-card__body">
          {rows.length ? (
            <div className="space-y-3">
              {rows.map((d: any) => (
                <div key={String(d.id)} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{d.name ?? d.title ?? `Download #${d.id}`}</div>
                      <div className="mt-1 text-xs text-white/55">
                        {d.category ? `• ${String(d.category)}` : ''}
                        {d.upload_date ? ` • ${String(d.upload_date)}` : ''}
                      </div>
                      <div className="mt-2 text-xs text-white/65 break-all">{String(d.file_path ?? d.url ?? '')}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/admin/downloads/${d.id}`} className="ui-button">Edit</Link>
                      <form action={deleteDownloadAction.bind(null, String(d.id))}>
                        <button className="ui-button danger" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60">No downloads found.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
