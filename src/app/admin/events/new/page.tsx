import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireEventsManager } from '@/lib/auth/guards';
import { createEventAction } from '@/app/admin/events/actions';

export default async function NewEventPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEventsManager();
  const sp = await searchParams;
  const from = typeof sp.from === 'string' ? sp.from : undefined;

  return (
    <PageShell title="New Event" subtitle="Create a new event (events/web/admin).">
      <div className="ui-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Event Details</div>
            <div className="mt-1 text-xs text-white/60">Fields mirror the `events` table.</div>
          </div>
          <Link className="ui-button" href={from ?? '/admin/events'}>
            Back
          </Link>
        </div>

        <form action={createEventAction} className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Name</div>
              <input name="name" className="ui-input" placeholder="e.g. New Year, New York" required />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Host (ARTCC code)</div>
              <input name="host" className="ui-input" placeholder="e.g. ZNY" />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Start (local)</div>
              <input name="start_at" type="datetime-local" className="ui-input" />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">End (local)</div>
              <input name="end_at" type="datetime-local" className="ui-input" />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Shift 1 label</div>
              <input name="shift_1_label" className="ui-input" placeholder="e.g. 1900-2300Z" />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Shift 2 label</div>
              <input name="shift_2_label" className="ui-input" placeholder="e.g. 2300-0300Z" />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Max shifts per controller</div>
              <input name="max_shifts_per_user" type="number" min={1} defaultValue={1} className="ui-input" />
            </label>

            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Banner path (public/…)</div>
              <input name="banner_path" className="ui-input" placeholder="/banners/newyear.jpg" />
            </label>
          </div>

          <label className="block">
            <div className="text-xs text-white/60 mb-1">Description (markdown ok)</div>
            <textarea name="description" className="ui-textarea" rows={8} placeholder="Pilot briefing / event details…" />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="published" value="1" className="h-4 w-4" /> Published
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="assignments_published" value="1" className="h-4 w-4" /> Assignments published
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="archived" value="1" className="h-4 w-4" /> Archived
            </label>

            <div className="flex-1" />

            <button className="ui-button" type="submit">
              Create Event
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
