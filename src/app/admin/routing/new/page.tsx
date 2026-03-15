import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { createRouteAction } from '../actions';

export default async function NewRoutePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const error = sp?.error;

  return (
    <PageShell
      title="Admin • New Route"
      subtitle="Add a routing helper / LOA row. Only columns that exist in your DB will be stored."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/routing', label: 'Routing' }, { label: 'New' }]}
      right={(
        <Link href="/admin/routing" className="ui-button">Back</Link>
      )}
    >
      {error ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          {error === 'missing_dep' ? 'Departure is required.' : error === 'missing_arr' ? 'Arrival is required.' : 'Route text is required.'}
        </div>
      ) : null}

      <form action={createRouteAction} className="ui-card">
        <div className="ui-card__header"><div className="text-sm font-semibold">Route</div></div>
        <div className="ui-card__body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Departure (ICAO)</div>
              <input name="dep" className="ui-input" placeholder="e.g. KCAK" required />
            </label>
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Arrival (ICAO)</div>
              <input name="arr" className="ui-input" placeholder="e.g. KCLE" required />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Route</div>
              <textarea name="route" className="ui-textarea" placeholder="e.g. PMM KEATN J70 ..." required />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Notes</div>
              <textarea name="remarks" className="ui-textarea" placeholder="Optional" />
            </label>
          </div>
          <button className="ui-button" type="submit">Create route</button>
        </div>
      </form>
    </PageShell>
  );
}
