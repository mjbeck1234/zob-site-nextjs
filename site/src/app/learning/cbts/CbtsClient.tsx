'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CbtItem, CbtSection } from '@/lib/cbts';

type Props = {
  sections: CbtSection[];
  cbts: CbtItem[];
  initialViewedIds: number[];
};

type TabId = 'all' | string;

function normalizeEmbedUrl(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';

  // Google Slides: accept either .../edit or base deck URL and convert to /embed.
  if (s.includes('docs.google.com/presentation')) {
    const baseNoQuery = s.split('?')[0]?.replace(/\/+$/, '') ?? s;

    if (baseNoQuery.endsWith('/embed')) {
      return `${baseNoQuery}?start=false&loop=false&delayms=60000`;
    }
    if (baseNoQuery.endsWith('/edit')) {
      return `${baseNoQuery.replace(/\/edit$/, '/embed')}?start=false&loop=false&delayms=60000`;
    }

    return `${baseNoQuery}/embed?start=false&loop=false&delayms=60000`;
  }

  // Generic fallback: try to use as-is.
  return s;
}

function tabClass(active: boolean, disabled?: boolean) {
  const base = 'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition';
  if (disabled) return `${base} border-white/10 bg-white/5 text-white/35 cursor-not-allowed`;
  if (active) return `${base} border-white/20 bg-white/15 text-white`;
  return `${base} border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10`;
}

function sectionTitle(sectionById: Map<string, CbtSection>, sectionId: string): string {
  return sectionById.get(sectionId)?.title ?? (sectionId === 'u' ? 'Uncategorized' : `Section ${sectionId}`);
}

export default function CbtsClient({ sections, cbts, initialViewedIds }: Props) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabId>('all');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [viewed, setViewed] = useState<Set<number>>(() => new Set(initialViewedIds ?? []));

  const bySection = useMemo(() => {
    const m = new Map<string, CbtItem[]>();
    for (const c of cbts) {
      const sid = String(c.section_id ?? 'u');
      if (!m.has(sid)) m.set(sid, []);
      m.get(sid)!.push(c);
    }
    for (const [k, v] of m.entries()) {
      v.sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
      m.set(k, v);
    }
    return m;
  }, [cbts]);

  const sectionById = useMemo(() => {
    const m = new Map<string, CbtSection>();
    for (const s of sections) m.set(String(s.id), s);
    return m;
  }, [sections]);

  const countsBySection = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sections) {
      const sid = String(s.id);
      m.set(sid, (bySection.get(sid) ?? []).length);
    }
    return m;
  }, [sections, bySection]);

  const viewedCountsBySection = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sections) {
      const sid = String(s.id);
      const list = bySection.get(sid) ?? [];
      m.set(sid, list.filter((c) => viewed.has(Number(c.id))).length);
    }
    return m;
  }, [sections, bySection, viewed]);

  // If the selected tab disappears (rare), fall back to All.
  useEffect(() => {
    if (tab === 'all') return;
    const sid = String(tab);
    if (!sectionById.has(sid)) setTab('all');
  }, [tab, sectionById]);

  const active = useMemo(() => cbts.find((c) => Number(c.id) === Number(activeId)) ?? null, [cbts, activeId]);

  // Log viewed when a CBT is opened.
  useEffect(() => {
    if (activeId == null) return;
    const id = Number(activeId);
    if (!Number.isFinite(id) || id <= 0) return;

    // Optimistically mark as viewed.
    setViewed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // Fire-and-forget view log (best effort).
    fetch('/api/cbts/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cbtId: id }),
    }).catch(() => {
      // ignore
    });
  }, [activeId]);

  const visibleList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sid = String(tab);

    let list: CbtItem[] = [];
    if (sid === 'all') {
      list = [...cbts];
    } else {
      list = [...(bySection.get(sid) ?? [])];
    }

    if (q) {
      list = list.filter((c) => {
        const sect = sid === 'all' ? sectionTitle(sectionById, String(c.section_id ?? 'u')) : '';
        const hay = `${c.title ?? ''} ${c.description ?? ''} ${sect}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (sid === 'all') {
      list.sort((a, b) => {
        const sa = sectionTitle(sectionById, String(a.section_id ?? 'u'));
        const sb = sectionTitle(sectionById, String(b.section_id ?? 'u'));
        const sectCmp = sa.localeCompare(sb);
        if (sectCmp !== 0) return sectCmp;
        return String(a.title ?? '').localeCompare(String(b.title ?? ''));
      });
    } else {
      list.sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
    }

    return list;
  }, [tab, query, cbts, bySection, sectionById]);

  const tabLabel = useMemo(() => {
    if (tab === 'all') return 'All CBTs';
    return sectionTitle(sectionById, String(tab));
  }, [tab, sectionById]);

  const viewedInTab = useMemo(() => visibleList.filter((c) => viewed.has(Number(c.id))).length, [visibleList, viewed]);

  return (
    <>
      <div className="ui-card">
        <div className="ui-card__body">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">CBTs</div>
              <div className="text-xs text-white/60">Each section is a tab. Click a CBT to open it; we’ll mark it as viewed automatically.</div>
            </div>

            <div className="w-full md:w-80">
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                placeholder={tab === 'all' ? 'Search all CBTs…' : 'Search this section…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button type="button" className={tabClass(tab === 'all')} onClick={() => setTab('all')}>
              All
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">{cbts.length}</span>
            </button>

            {sections.map((s) => {
              const sid = String(s.id);
              const count = countsBySection.get(sid) ?? 0;
              const viewedCount = viewedCountsBySection.get(sid) ?? 0;
              const disabled = count <= 0;

              return (
                <button
                  key={sid}
                  type="button"
                  className={tabClass(tab === sid, disabled)}
                  onClick={() => {
                    if (!disabled) setTab(sid);
                  }}
                  title={disabled ? 'No CBTs in this section' : s.title}
                >
                  <span className="whitespace-nowrap">{s.title}</span>
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">{count}</span>
                  {viewedCount > 0 && viewedCount < count ? (
                    <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                      {viewedCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 ui-card">
        <div className="ui-card__header">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{tabLabel}</div>
              <div className="text-xs text-white/60">
                {visibleList.length} CBT{visibleList.length === 1 ? '' : 's'}
                {query.trim() ? <span className="text-white/40"> · filtered</span> : null}
              </div>
            </div>

            <div className="text-xs text-white/50">Viewed: {viewedInTab}/{visibleList.length}</div>
          </div>
        </div>

        <div className="ui-card__body">
          {!visibleList.length ? (
            <div className="text-sm text-white/70">No CBTs found.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {visibleList.map((c) => {
                const isViewed = viewed.has(Number(c.id));
                const sid = String(c.section_id ?? 'u');
                const sect = tab === 'all' ? sectionTitle(sectionById, sid) : null;

                return (
                  <div key={String(c.id)} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold">{c.title}</div>

                        {sect ? (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">{sect}</span>
                        ) : null}

                        {isViewed ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">Viewed</span>
                        ) : null}
                      </div>

                      {c.description ? (
                        <div className="mt-0.5 line-clamp-2 text-xs text-white/60">{c.description}</div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" className="ui-btn ui-btn--primary" onClick={() => setActiveId(Number(c.id))}>
                        Open
                      </button>
                      <a className="ui-btn" href={String(c.url ?? '#')} target="_blank" rel="noreferrer">
                        New tab
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {active ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{active.title}</div>
                <div className="truncate text-xs text-white/60">{active.description ?? ''}</div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <a className="ui-btn" href={String(active.url ?? '#')} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
                <button type="button" className="ui-btn" onClick={() => setActiveId(null)}>
                  Close
                </button>
              </div>
            </div>

            <div className="aspect-video w-full bg-black">
              <iframe title={String(active.title ?? 'CBT')} src={normalizeEmbedUrl(String(active.url ?? ''))} className="h-full w-full" allowFullScreen />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
