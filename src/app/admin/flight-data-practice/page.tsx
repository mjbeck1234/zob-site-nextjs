import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireFlightDataPracticeManager } from '@/lib/auth/guards';
import { getFDPMode, listFDPCases } from '@/lib/flightDataPractice';
import { deleteFDPCaseAction } from './actions';

export default async function AdminFlightDataPracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireFlightDataPracticeManager();
  const sp = await searchParams;
  const deleted = (sp?.deleted ?? '') === '1';
  const error = (sp?.error ?? '') as string;

  const mode = await getFDPMode();
  const rows = mode === 'none' ? [] : await listFDPCases({ includeUnpublished: true });

  return (
    <PageShell
      title="Admin • Flight Data Practice"
      subtitle="Manage Flight Data Practice cases. The existing fdp source is preferred."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Flight Data Practice' }]}
      right={<Link href="/admin/flight-data-practice/new" className="ui-button">New case</Link>}
    >
      {deleted ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Case deleted.</div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          {error === 'missing' ? 'Missing required fields (dep/arr).' : 'Invalid request.'}
        </div>
      ) : null}

      {mode === 'none' ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Your database does not contain the preferred existing <span className="font-mono">fdp</span> table.
          Import or create <span className="font-mono">fdp</span> to use Flight Data Practice. The newer <span className="font-mono">flight_data_practice_cases</span> table is only used as a fallback when existing data is not installed.
        </div>
      ) : null}

      {mode === 'existing' ? (
        <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100">
          These cases are coming from the preferred existing <span className="font-mono">fdp</span> table used by student practice.
        </div>
      ) : mode === 'new' ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Stored <span className="font-mono">fdp</span> was not found, so this page is temporarily using the fallback <span className="font-mono">flight_data_practice_cases</span> table.
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Cases</div>
          <span className="ui-badge">{rows.length}</span>
        </div>
        <div className="ui-card__body">
          {rows.length ? (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={String(r.id)} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {r.title || `${r.dep} → ${r.arr}`}
                        {!r.published ? <span className="ml-2 text-xs text-amber-200">(unpublished)</span> : null}
                      </div>
                      <div className="mt-1 text-xs text-white/60">{r.callsign} • {r.ac_type} • {r.flight_rules}</div>
                      <div className="mt-2 text-xs text-white/70">
                        {r.good_route ? (<span>Expected route: <span className="font-mono">{String(r.good_route)}</span></span>) : (<span>No route check</span>)}
                        {r.good_cruise_alt ? (<span className="ml-2">• Expected alt: <span className="font-mono">{String(r.good_cruise_alt)}</span></span>) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/flight-data-practice/${r.id}`} className="ui-button">Edit</Link>
                      <form action={deleteFDPCaseAction}>
                        <input type="hidden" name="id" value={String(r.id)} />
                        <button className="ui-button danger" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60">No cases found.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
