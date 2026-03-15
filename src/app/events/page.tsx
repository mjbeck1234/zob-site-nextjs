import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getUpcomingPublishedEvents } from '@/lib/events';

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Only show non-archived upcoming / active events.
  // (Archived events remain accessible via direct links and in admin.)
  void (await searchParams); // keep signature stable; ignore query params
  const events = await getUpcomingPublishedEvents();

  return (
    <PageShell title="Events" subtitle="Facility events and community activities." crumbs={[{ href: '/', label: 'Home' }, { label: 'Events' }]}>
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Upcoming / Active events</div>
        </div>

        <div className="ui-card__body">
          {events.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {events.map((e: any) => (
                <div key={String(e.id)} className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  {e.banner_path ? (
                    <div className="h-40 w-full bg-black/20 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={String(e.banner_path)} alt="" className="h-full w-full object-contain opacity-95" />
                    </div>
                  ) : null}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-base font-semibold text-white">{e.name}</div>
                    </div>
                    <div className="mt-2 text-sm text-white/70 line-clamp-3 whitespace-pre-line">{e.description ?? ''}</div>
                    <div className="mt-3 text-xs text-white/55">
                      {e.start_at ? new Date(e.start_at).toLocaleString() : '—'}
                      {e.end_at ? ` → ${new Date(e.end_at).toLocaleString()}` : ''}
                    </div>
                    <div className="mt-4">
                      <Link href={`/events/${e.id}`} className="ui-link">
                        View details →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/70">No events found.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
