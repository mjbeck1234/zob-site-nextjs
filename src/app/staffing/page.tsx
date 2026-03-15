import Link from 'next/link';
import { createStaffingRequestAction } from './actions';
import PilotCountInput from './PilotCountInput';
import { getUser } from '@/lib/auth/getUser';
import { listMyStaffingRequestsForCid, approvalLabel } from '@/lib/staffing';

export default async function StaffingPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const created = sp.created === '1';
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  const user = await getUser();

  if (!user) {
    return (
      <main className="container mx-auto max-w-5xl px-6 py-10">
        <div className="ui-card p-6">
          <h1 className="text-2xl font-semibold">Request Staffing</h1>
          <p className="mt-3 opacity-80">You need to sign in with VATSIM to submit a staffing request.</p>
          <div className="mt-6">
            <Link href="/api/auth/login?next=/staffing" className="ui-btn">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const myRequests = await listMyStaffingRequestsForCid(user.cid);

  return (
    <main className="container mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Request Staffing</h1>

      <div className="ui-card mt-6 p-6">
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          <div className="font-semibold">Disclaimer:</div>
          <p className="mt-2 leading-relaxed">
            Upon filling out and submitting this staffing request form on behalf of your group, we acknowledge that this request does not guarantee staffing from ZOB. Additionally,
            requests made less than 7 days from the event may not be honored due to limited availability from our staff and controllers to provide support. If your group is requesting
            staffing during an event that involves our facility or surrounding Tier 1/neighboring facilities, it is usually guaranteed that support staffing from ZOB is being provided.
          </p>
        </div>

        {created && <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">Request submitted. Our events team will review it shortly.</div>}
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {error === 'limit'
              ? 'You already have 3 pending staffing requests. Please wait for a decision or have an events/admin member close one out.'
              : error === 'missing'
                ? 'Please fill out all required fields.'
                : error}
          </div>
        )}

        <form action={createStaffingRequestAction} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-1">
              <label className="ui-label">Full Name</label>
              <input className="ui-input" value={user.fullName} readOnly />
            </div>
            <div className="md:col-span-1">
              <label className="ui-label">VATSIM CID</label>
              <input className="ui-input" value={user.cid} readOnly />
            </div>
            <div className="md:col-span-1">
              <label className="ui-label">Your Email Address</label>
              <input name="pilot_email" className="ui-input" defaultValue={user.email ?? ''} placeholder="e.g. example@domain.com" required />
            </div>
            <div className="md:col-span-1">
              <label className="ui-label">Group Name</label>
              <input name="group_name" className="ui-input" placeholder="e.g. Frontier Virtual" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="ui-label">Event Date</label>
              <input name="event_date" type="date" className="ui-input" required />
            </div>
            <div>
              <label className="ui-label">Time Start (in Zulu)</label>
              <input name="time_start" className="ui-input" placeholder="0000" inputMode="numeric" pattern="[0-9]{4}" required />
            </div>
            <div>
              <label className="ui-label">Time End (in Zulu)</label>
              <input name="time_end" className="ui-input" placeholder="0000" inputMode="numeric" pattern="[0-9]{4}" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="ui-label">Pilot Count (estimate)</label>
              <PilotCountInput initial={5} min={1} max={300} />
            </div>
            <div>
              <label className="ui-label">Link to Flight Banner</label>
              <input name="event_banner" className="ui-input" placeholder="https://..." />
            </div>
          </div>

          <div>
            <label className="ui-label">Group Flight Description</label>
            <textarea name="description" className="ui-input min-h-[140px]" required />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="ui-btn">
              Request
            </button>
          </div>
        </form>
      </div>

      <div className="ui-card mt-8 p-6">
        <h2 className="text-lg font-semibold">My Requests</h2>
        {myRequests.length === 0 ? (
          <p className="mt-3 opacity-80">No requests yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="ui-table w-full">
              <thead>
                <tr>
                  <th className="text-left">ID</th>
                  <th className="text-left">Event</th>
                  <th className="text-left">Time (Z)</th>
                  <th className="text-left">Pax</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => {
                  const { label } = approvalLabel(r.approved);
                  return (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>
                        <div className="font-medium">{r.group_name || '—'}</div>
                        <div className="text-xs opacity-75">{r.event_date || '—'}</div>
                      </td>
                      <td>
                        {r.time_start || '—'} → {r.time_end || '—'}
                      </td>
                      <td>{r.pilot_count ?? '—'}</td>
                      <td>{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
