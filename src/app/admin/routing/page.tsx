import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { selectAll } from '@/lib/query';
import { deleteRouteAction } from './actions';
import { tableExists } from '@/lib/schema';

export default async function AdminRoutingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const deleted = (sp?.deleted ?? '') === '1';

  const exists = await tableExists('routes');
  const rows = exists ? await selectAll('routes', { orderBySql: 'id DESC', limit: 200 }) : [];

  return (
    <PageShell
      title="Admin • Routing"
      subtitle="Manage LOA / routing helper rows. Columns shown depend on your DB schema."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Routing' }]}
      right={(
        <Link href="/admin/routing/new" className="ui-button">New route</Link>
      )}
    >
      {deleted ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Route deleted.</div>
      ) : null}

      {!exists ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Your database does not contain a <span className="font-mono">routes</span> table.
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Routes</div>
          <span className="ui-badge">{rows.length}</span>
        </div>
        <div className="ui-card__body">
          {rows.length ? (
            <div className="space-y-3">
              {rows.map((r: any) => (
                <div key={String(r.id)} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {String(r.dep ?? r.departure ?? '').toUpperCase()}{r.dep || r.departure ? ' → ' : ''}{String(r.arr ?? r.arrival ?? '').toUpperCase() || `Route #${r.id}`}
                      </div>
                      <div className="mt-2 text-xs text-white/70">{String(r.route ?? '')}</div>
                      {r.remarks ? <div className="mt-1 text-xs text-white/55">{String(r.remarks)}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/routing/${r.id}`} className="ui-button">Edit</Link>
                      <form action={deleteRouteAction.bind(null, String(r.id))}>
                        <button className="ui-button danger" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60">No routes found.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
