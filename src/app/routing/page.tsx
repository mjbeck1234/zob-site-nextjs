import PageShell from '@/components/PageShell';
import { getRoutes } from '@/lib/content';

export default async function RoutingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;

  const arrival = typeof sp.arrival === 'string' ? sp.arrival : undefined;
  const routes = await getRoutes(arrival);

  return (
    <PageShell title="Routing" subtitle="Preferred routes and LOA-friendly flight planning hints." crumbs={[{ href: '/', label: 'Home' }, { label: 'Routing' }]}>
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Route Finder</div>
          <form className="flex items-center gap-2" action="/routing" method="get">
            <input
              name="arrival"
              placeholder="Arrival (e.g., KCLE)"
              defaultValue={arrival ?? ''}
              className="h-10 w-48 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/20"
            />
            <button className="h-10 rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/[0.14]">
              Search
            </button>
          </form>
        </div>

        <div className="ui-card__body">
          <div className="text-sm text-white/70">
            {arrival ? (
              <span>
                Showing routes filtered by arrival <span className="font-semibold text-white">{arrival}</span>.
              </span>
            ) : (
              <span>Showing all routes.</span>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <div className="max-h-[65vh] overflow-auto">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Departure</th>
                    <th>Arrival</th>
                    <th>Route</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r: any, idx: number) => (
                    <tr key={String(r.id ?? `${r.dep ?? r.departure ?? ''}-${r.arr ?? r.arrival ?? ''}-${idx}`)}>
                      <td className="font-semibold">{r.dep ?? r.departure ?? r.origin ?? r.from ?? ''}</td>
                      <td className="font-semibold">{r.arr ?? r.arrival ?? r.dest ?? r.to ?? ''}</td>
                      <td className="font-mono text-xs">{r.route ?? ''}</td>
                      <td>{r.notes ?? r.remarks ?? ''}</td>
                    </tr>
                  ))}
                  {!routes.length ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '16px 12px' }}>
                        <span className="text-sm opacity-70">No routes found.</span>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
