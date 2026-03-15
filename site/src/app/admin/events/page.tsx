import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireEventsManager } from '@/lib/auth/guards';
import { selectAll } from '@/lib/query';
import { deleteEventAction } from './actions';
import { tableExists, tableHasColumn } from '@/lib/schema';

function truthy01(v: any): boolean {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
}

function isPublished(v: any): boolean {
  if (typeof v === 'string' && v.trim().toLowerCase() === 'yes') return true;
  return truthy01(v);
}

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEventsManager();
  const sp = await searchParams;
  const deleted = (sp?.deleted ?? '') === '1';

  // Default: hide archived events. (Archived events are still accessible via direct /admin/events/[id] links.)
  const showArchived = String(sp?.archived ?? '') === '1';

  const exists = await tableExists('events');

  let events: any[] = [];
  if (exists) {
    const hasEventDate = await tableHasColumn('events', 'event_date').catch(() => false);
    const hasStartAt = await tableHasColumn('events', 'start_at').catch(() => false);
    const hasArchived = await tableHasColumn('events', 'archived').catch(() => false);

    const orderBySql = hasEventDate
      ? 'event_date ASC, time_start ASC, id ASC'
      : hasStartAt
        ? 'start_at ASC, id ASC'
        : 'id DESC';

    const whereSql = !showArchived && hasArchived ? `archived = 0` : undefined;
    events = await selectAll('events', { whereSql, orderBySql, limit: 200 }).catch(() => []);
  }

  return (
    <PageShell
      title="Admin • Events"
      subtitle="Create and manage events."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Events' }]}
      right={(
        <Link href="/admin/events/new" className="ui-button">
          New event
        </Link>
      )}
    >
      {deleted ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Event deleted.</div>
      ) : null}

      {!exists ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Your database does not contain an <span className="font-semibold">events</span> table.
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Events</div>
          <span className="ui-badge">{events.length}</span>
          <div className="ml-auto">
            <Link href={showArchived ? '/admin/events' : '/admin/events?archived=1'} className="ui-link">
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Link>
          </div>
        </div>
        <div className="ui-card__body">
          {events.length ? (
            <div className="space-y-3">
              {events.map((e: any) => (
                <div key={String(e.id)} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{e.name ?? e.title ?? `Event #${e.id}`}</div>
                      <div className="mt-1 text-xs text-white/55">
                        {e.start_at ? `• ${new Date(String(e.start_at)).toLocaleString()}` : e.event_date ? `• ${String(e.event_date)}` : e.date ? `• ${String(e.date)}` : ''}
                        {truthy01(e.archived) ? ' • archived' : ''}
                        {truthy01(e.assignments_published) ? ' • assignments published' : ''}
                        {!isPublished(e.published) ? ' • unpublished' : ''}
                      </div>
                      {e.description ? <div className="mt-2 text-sm text-white/70 line-clamp-2 whitespace-pre-line">{String(e.description)}</div> : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/admin/events/${e.id}`} className="ui-button">
                        Edit
                      </Link>

                      <form action={deleteEventAction}>
                        <input type="hidden" name="id" value={String(e.id)} />
                        <button className="ui-button danger" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60">No events found.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
