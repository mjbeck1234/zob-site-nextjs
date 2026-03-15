import PageShell from '@/components/PageShell';
import { requireLessonPlansEditor } from '@/lib/auth/guards';
import { listLessonPlans } from '@/lib/lessonPlans';

function uniqSorted(vals: string[]): string[] {
  const set = new Set(vals.filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export default async function LessonPlansIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; track?: string; loc?: string }>;
}) {
  await requireLessonPlansEditor();
  const sp = await searchParams;

  const q = String(sp.q ?? '').trim().toLowerCase();
  const track = String(sp.track ?? '').trim();
  const loc = String(sp.loc ?? '').trim().toUpperCase();

  const plans = await listLessonPlans();

  const tracks = uniqSorted(plans.map((p) => String(p.track_id)));
  const locations = uniqSorted(plans.map((p) => String(p.location ?? '').toUpperCase()));

  const filtered = plans.filter((p) => {
    if (track && String(p.track_id) !== track) return false;
    if (loc && String(p.location ?? '').toUpperCase() !== loc) return false;
    if (!q) return true;
    const hay = [
      p.lesson_name,
      p.location,
      p.workload,
      p.session_orientation,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  // Group by track for nicer browsing.
  const byTrack = new Map<string, typeof filtered>();
  for (const p of filtered) {
    const k = String(p.track_id);
    const arr = byTrack.get(k) ?? [];
    arr.push(p);
    byTrack.set(k, arr);
  }

  return (
    <PageShell
      title="Lesson Plans"
      subtitle="Lesson plan library (track/location/workload/time)"
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        { label: 'Lesson Plans' },
      ]}
      actions={
        <a className="ui-btn ui-btn--primary" href="/admin/lesson-plans/new">
          New Lesson Plan
        </a>
      }
    >
      <div className="grid gap-4">
        <form className="ui-card" method="get">
          <div className="ui-card__body grid gap-3 md:grid-cols-4">
            <div className="grid gap-1">
              <label className="text-xs text-white/60">Search</label>
              <input
                className="ui-input"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="e.g. DTW, departures, workload"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-white/60">Track</label>
              <select className="ui-input" name="track" defaultValue={track}>
                <option value="">All tracks</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    Track {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-white/60">Location</label>
              <select className="ui-input" name="loc" defaultValue={loc}>
                <option value="">All locations</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="ui-btn ui-btn--primary" type="submit">
                Apply
              </button>
              <a className="ui-btn" href="/admin/lesson-plans">
                Reset
              </a>
            </div>
          </div>
        </form>

        {filtered.length === 0 ? (
          <div className="ui-card">
            <div className="ui-card__body text-white/70">No lesson plans found.</div>
          </div>
        ) : (
          <div className="grid gap-4">
            {Array.from(byTrack.entries())
              .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
              .map(([trackId, items]) => (
                <section key={trackId} className="grid gap-2">
                  <div className="text-sm font-semibold text-white/80">Track {trackId}</div>
                  <div className="grid gap-2">
                    {items.map((p) => (
                      <a
                        key={p.id}
                        href={`/admin/lesson-plans/${p.id}`}
                        className="ui-card hover:border-white/20 transition-colors"
                      >
                        <div className="ui-card__body grid gap-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-base font-semibold text-white">{p.lesson_name}</div>
                            <div className="text-xs text-white/60">
                              {String(p.location ?? '').toUpperCase()}{' '}
                              {p.time ? `• ${p.time} min` : ''}{' '}
                              {p.workload ? `• ${p.workload}` : ''}
                            </div>
                          </div>
                          {p.session_orientation ? (
                            <div className="text-xs text-white/70 line-clamp-2">{p.session_orientation}</div>
                          ) : null}
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
