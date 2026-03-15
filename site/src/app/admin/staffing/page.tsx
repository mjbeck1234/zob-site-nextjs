import Link from 'next/link';
import { requireEventsManager } from '@/lib/auth/guards';
import { listStaffingRequestsForAdmin, approvalLabel } from '@/lib/staffing';
import { approveStaffingRequestAction, denyStaffingRequestAction, setPendingStaffingRequestAction } from './actions';

export default async function AdminStaffingRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; updated?: string; error?: string }>;
}) {
  await requireEventsManager();
  const sp = (await searchParams) ?? {};
  const status = (sp.status ?? 'pending') as 'pending' | 'approved' | 'denied' | 'all';

  const rows = await listStaffingRequestsForAdmin(status);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Staffing Requests</h1>
          <p className="text-sm text-slate-400">Review and approve/deny staffing requests.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link className={`ui-button ${status === 'pending' ? 'ui-button-primary' : ''}`} href="/admin/staffing?status=pending">Pending</Link>
          <Link className={`ui-button ${status === 'approved' ? 'ui-button-primary' : ''}`} href="/admin/staffing?status=approved">Approved</Link>
          <Link className={`ui-button ${status === 'denied' ? 'ui-button-primary' : ''}`} href="/admin/staffing?status=denied">Denied</Link>
          <Link className={`ui-button ${status === 'all' ? 'ui-button-primary' : ''}`} href="/admin/staffing?status=all">All</Link>
        </div>
      </div>

      {sp.error ? (
        <div className="ui-alert ui-alert-error">{decodeURIComponent(sp.error)}</div>
      ) : null}
      {sp.updated ? <div className="ui-alert ui-alert-success">Updated.</div> : null}

      <div className="ui-card">
        <div className="ui-card-header">
          <h2 className="ui-card-title">Requests</h2>
        </div>
        <div className="ui-card-content overflow-x-auto">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-400">No requests.</div>
          ) : (
            <table className="ui-table min-w-[1000px]">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>CID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Group</th>
                  <th>Date</th>
                  <th>Zulu</th>
                  <th>Pilots</th>
                  <th>Status</th>
                  <th>Banner</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = approvalLabel(r.approved);
                  return (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.pilot_cid}</td>
                      <td>{r.pilot_full_name}</td>
                      <td>{r.pilot_email}</td>
                      <td>{r.group_name ?? '-'}</td>
                      <td>{r.event_date ?? '-'}</td>
                      <td>
                        {(r.time_start ?? '----') + ' - ' + (r.time_end ?? '----')}
                      </td>
                      <td>{r.pilot_count ?? '-'}</td>
                      <td>{status.label}</td>
                      <td>
                        {r.event_banner ? (
                          <a className="ui-link" href={r.event_banner} target="_blank" rel="noreferrer">
                            link
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="max-w-[320px] truncate" title={r.description ?? ''}>
                        {r.description ?? '-'}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <form action={approveStaffingRequestAction}>
                            <input type="hidden" name="id" value={String(r.id)} />
                            <button className="ui-button ui-button-primary" type="submit">
                              Approve
                            </button>
                          </form>
                          <form action={denyStaffingRequestAction}>
                            <input type="hidden" name="id" value={String(r.id)} />
                            <button className="ui-button" type="submit">
                              Deny
                            </button>
                          </form>
                          <form action={setPendingStaffingRequestAction}>
                            <input type="hidden" name="id" value={String(r.id)} />
                            <button className="ui-button" type="submit">
                              Pending
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
