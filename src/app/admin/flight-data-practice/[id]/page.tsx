import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireFlightDataPracticeManager } from '@/lib/auth/guards';
import { getFDPCaseById, getFDPMode } from '@/lib/flightDataPractice';
import { updateFDPCaseAction } from '../actions';

export default async function EditFDPCasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireFlightDataPracticeManager();
  const { id } = await params;
  const sp = await searchParams;
  const saved = (sp?.saved ?? '') === '1';
  const caseId = Number.parseInt(id, 10);
  const row = Number.isFinite(caseId) ? await getFDPCaseById(caseId) : null;
  const mode = await getFDPMode();
  const existingMode = mode === 'existing';

  if (!row) {
    return (
      <PageShell title="Admin • Flight Data Practice" subtitle="Not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/flight-data-practice', label: 'Flight Data Practice' }, { label: 'Not found' }]}>
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Case not found.</div></div></div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Admin • Flight Data Practice"
      subtitle={row.title || `${row.dep} → ${row.arr}`}
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/flight-data-practice', label: 'Flight Data Practice' }, { label: 'Edit' }]}
      right={<Link href="/admin/flight-data-practice" className="ui-link">← Back</Link>}
    >
      {saved ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Saved.</div>
      ) : null}

      {existingMode ? (
        <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100">
          This case is backed by the preferred existing <span className="font-mono">fdp</span> table. Saving here updates the canonical callsign, aircraft, dep/arr, route, and altitude used by student practice.
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Stored <span className="font-mono">fdp</span> was not found, so this editor is using the fallback <span className="font-mono">flight_data_practice_cases</span> table.
        </div>
      )}

      <div className="ui-card">
        <div className="ui-card__body">
          <form action={updateFDPCaseAction} className="grid gap-4">
            <input type="hidden" name="id" value={String(row.id)} />

            <div className={`grid gap-4 ${existingMode ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Title (optional)</span>
                <input name="title" className="ui-input" defaultValue={row.title ?? ''} />
              </label>
              {!existingMode ? (
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Published</span>
                  <select name="published" className="ui-input" defaultValue={row.published ? '1' : '0'}>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </label>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Depart</span>
                <input name="dep" className="ui-input" defaultValue={row.dep} required />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Arrive</span>
                <input name="arr" className="ui-input" defaultValue={row.arr} required />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Flight Rules</span>
                <input name="flight_rules" className="ui-input" defaultValue={row.flight_rules ?? 'IFR'} />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Callsign</span>
                <input name="callsign" className="ui-input" defaultValue={row.callsign ?? ''} />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">A/C Type</span>
                <input name="ac_type" className="ui-input" defaultValue={row.ac_type ?? ''} />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white/90">Student sees (incorrect plan)</div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Bad Cruise Alt</span>
                  <input name="bad_cruise_alt" className="ui-input" defaultValue={row.bad_cruise_alt ?? ''} disabled={existingMode} readOnly={existingMode} />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Bad Route</span>
                  <input name="bad_route" className="ui-input" defaultValue={row.bad_route ?? ''} disabled={existingMode} readOnly={existingMode} />
                </label>
              </div>
              <label className="mt-4 grid gap-1">
                <span className="text-sm font-semibold text-white/85">Bad Remarks</span>
                <textarea name="bad_remarks" className="ui-input" rows={2} defaultValue={row.bad_remarks ?? ''} disabled={existingMode} readOnly={existingMode} />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white/90">Expected correction</div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Good Cruise Alt</span>
                  <input name="good_cruise_alt" className="ui-input" defaultValue={row.good_cruise_alt ?? ''} />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Good Route</span>
                  <input name="good_route" className="ui-input" defaultValue={row.good_route ?? ''} />
                </label>
              </div>
              <label className="mt-4 grid gap-1">
                <span className="text-sm font-semibold text-white/85">Good Remarks</span>
                <textarea name="good_remarks" className="ui-input" rows={2} defaultValue={row.good_remarks ?? ''} />
              </label>
              <div className="mt-2 text-xs text-white/60">Leave any “Good …” field blank to skip validation for that field.</div>
              {existingMode ? (<div className="mt-2 text-xs text-sky-100/80">Current mode stores the expected route and altitude only. The incorrect plan is generated automatically from that source data.</div>) : null}
            </div>

            <div className="flex items-center gap-2">
              <button className="ui-btn ui-btn--primary" type="submit">Save</button>
              <Link href="/admin/flight-data-practice" className="ui-btn">Back</Link>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
