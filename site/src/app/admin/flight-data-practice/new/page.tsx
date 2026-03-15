import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireFlightDataPracticeManager } from '@/lib/auth/guards';
import { createFDPCaseAction } from '../actions';
import { getFDPMode } from '@/lib/flightDataPractice';

export default async function NewFDPCasePage() {
  await requireFlightDataPracticeManager();
  const mode = await getFDPMode();
  const existingMode = mode === 'existing';

  return (
    <PageShell
      title="Admin • Flight Data Practice"
      subtitle="New case"
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/flight-data-practice', label: 'Flight Data Practice' }, { label: 'New' }]}
      right={<Link href="/admin/flight-data-practice" className="ui-link">← Back</Link>}
    >
      {existingMode ? (
        <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100">
          You are adding to the preferred existing <span className="font-mono">fdp</span> table used by practice.
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Stored <span className="font-mono">fdp</span> was not found, so this form will save into the fallback <span className="font-mono">flight_data_practice_cases</span> table.
        </div>
      )}

      <div className="ui-card">
        <div className="ui-card__body">
          <form action={createFDPCaseAction} className="grid gap-4">
            <div className={`grid gap-4 ${existingMode ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Title (optional)</span>
                <input name="title" className="ui-input" placeholder="e.g. KCLE → KDTW (Route + Altitude)" />
              </label>
              {!existingMode ? (
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Published</span>
                  <select name="published" className="ui-input" defaultValue="1">
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </label>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Depart (required)</span>
                <input name="dep" className="ui-input" placeholder="KCLE" required />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Arrive (required)</span>
                <input name="arr" className="ui-input" placeholder="KDTW" required />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Flight Rules</span>
                <input name="flight_rules" className="ui-input" defaultValue="IFR" />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Callsign</span>
                <input name="callsign" className="ui-input" defaultValue="DCM104" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">A/C Type</span>
                <input name="ac_type" className="ui-input" defaultValue="B738/W" />
              </label>
            </div>

            {!existingMode ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white/90">Student sees (incorrect plan)</div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Bad Cruise Alt (optional)</span>
                  <input name="bad_cruise_alt" className="ui-input" placeholder="28000" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Bad Route (optional)</span>
                  <input name="bad_route" className="ui-input" placeholder="DIRECT" />
                </label>
              </div>
              <label className="mt-4 grid gap-1">
                <span className="text-sm font-semibold text-white/85">Bad Remarks (optional)</span>
                <textarea name="bad_remarks" className="ui-input" rows={2} placeholder="/V/" />
              </label>
            </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white/90">Expected correction (what counts as “right”)</div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Good Cruise Alt (optional)</span>
                  <input name="good_cruise_alt" className="ui-input" placeholder="29000" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Good Route (optional)</span>
                  <input name="good_route" className="ui-input" placeholder="ACO BUCKO ANTHM4" />
                </label>
              </div>
              {!existingMode ? (
                <label className="mt-4 grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Good Remarks (optional)</span>
                  <textarea name="good_remarks" className="ui-input" rows={2} placeholder="(leave blank unless you want to validate remarks exactly)" />
                </label>
              ) : null}
              {existingMode ? (<div className="mt-2 text-xs text-sky-100/80">In existing mode, the student-visible incorrect plan is generated automatically from the saved route and altitude.</div>) : null}
</div>

            <div className="flex items-center gap-2">
              <button className="ui-btn ui-btn--primary" type="submit">Save</button>
              <Link href="/admin/flight-data-practice" className="ui-btn">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
