import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { getById } from '@/lib/admin/crud';
import { deleteRouteAction, updateRouteAction } from '../actions';

export default async function EditRoutePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const saved = (sp?.saved ?? '') === '1';

  const r = await getById('routes', id);
  if (!r) {
    return (
      <PageShell title="Admin • Route" subtitle="Route not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/routing', label: 'Routing' }, { label: String(id) }]}>
        <div className="ui-card"><div className="ui-card__body text-sm text-white/70">Route not found.</div></div>
      </PageShell>
    );
  }

  const update = updateRouteAction.bind(null, String(id));

  return (
    <PageShell
      title="Admin • Edit Route"
      subtitle={`Editing route #${id}`}
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/routing', label: 'Routing' }, { label: String(id) }]}
      right={(
        <div className="flex items-center gap-2">
          <Link href="/admin/routing" className="ui-button">Back</Link>
          <form action={deleteRouteAction.bind(null, String(id))}>
            <button className="ui-button danger" type="submit">Delete</button>
          </form>
        </div>
      )}
    >
      {saved ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Saved.</div>
      ) : null}

      <form action={update} className="ui-card">
        <div className="ui-card__header"><div className="text-sm font-semibold">Route</div></div>
        <div className="ui-card__body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Departure (ICAO)</div>
              <input name="dep" className="ui-input" defaultValue={String(r.dep ?? r.departure ?? '')} />
            </label>
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Arrival (ICAO)</div>
              <input name="arr" className="ui-input" defaultValue={String(r.arr ?? r.arrival ?? '')} />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Route</div>
              <textarea name="route" className="ui-textarea" defaultValue={String(r.route ?? '')} />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Notes</div>
              <textarea name="remarks" className="ui-textarea" defaultValue={String(r.remarks ?? '')} />
            </label>
          </div>
          <button className="ui-button" type="submit">Save changes</button>
        </div>
      </form>
    </PageShell>
  );
}
