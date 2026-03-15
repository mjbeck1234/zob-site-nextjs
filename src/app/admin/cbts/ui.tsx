'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdminCbtItem, AdminCbtSection } from '@/lib/cbtsAdmin';

type Props = {
  initialSections: AdminCbtSection[];
  initialCbts: AdminCbtItem[];
};

type ApiList = {
  ok: boolean;
  dbOk: boolean;
  sections: AdminCbtSection[];
  cbts: AdminCbtItem[];
};

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = String(data?.error ?? data?.message ?? res.statusText ?? 'Request failed');
    throw new Error(msg);
  }
  return data;
}

export default function AdminCbtsClient({ initialSections, initialCbts }: Props) {
  const [sections, setSections] = useState<AdminCbtSection[]>(initialSections ?? []);
  const [cbts, setCbts] = useState<AdminCbtItem[]>(initialCbts ?? []);
  const [busy, setBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');

  // Add section
  const [secTitle, setSecTitle] = useState('');
  const [secPublished, setSecPublished] = useState(true);

  // Edit section
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState('');
  const [editSectionPublished, setEditSectionPublished] = useState(true);

  // Add CBT
  const [cbtSection, setCbtSection] = useState<string>('u');
  const [cbtTitle, setCbtTitle] = useState('');
  const [cbtUrl, setCbtUrl] = useState('');
  const [cbtDesc, setCbtDesc] = useState('');
  const [cbtPublished, setCbtPublished] = useState(true);

  // Edit CBT
  const [editingCbtId, setEditingCbtId] = useState<string | null>(null);
  const [editCbtSection, setEditCbtSection] = useState<string>('u');
  const [editCbtTitle, setEditCbtTitle] = useState('');
  const [editCbtUrl, setEditCbtUrl] = useState('');
  const [editCbtDesc, setEditCbtDesc] = useState('');
  const [editCbtPublished, setEditCbtPublished] = useState(true);

  const sectionOptions = useMemo(() => {
    const opts = [...sections]
      .slice()
      .sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')))
      .map((s) => ({ id: String(s.id), title: String(s.title ?? '').trim() || `Section ${s.id}`, published: s.published }));
    return [{ id: 'u', title: 'Uncategorized', published: 1 }, ...opts];
  }, [sections]);

  const bySection = useMemo(() => {
    const map = new Map<string, AdminCbtItem[]>();
    for (const c of cbts) {
      const sid = c.section_id == null ? 'u' : String(c.section_id);
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(c);
    }
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
      map.set(k, v);
    }
    return map;
  }, [cbts]);

  const filteredSections = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return sectionOptions;
    return sectionOptions.filter((s) => {
      const list = bySection.get(String(s.id)) ?? [];
      return list.some((c) => `${c.title ?? ''} ${c.description ?? ''} ${c.url ?? ''}`.toLowerCase().includes(query));
    });
  }, [q, sectionOptions, bySection]);

  async function refresh() {
    const data: ApiList = await fetchJson('/api/admin/cbts');
    if (!data?.dbOk) return;
    setSections(data.sections ?? []);
    setCbts(data.cbts ?? []);
  }

  function startEditSection(sid: string, title: string, published: boolean) {
    setEditingSectionId(sid);
    setEditSectionTitle(title);
    setEditSectionPublished(published);
  }

  async function saveSectionEdit() {
    if (!editingSectionId) return;
    setError(null);
    setRowBusyId(`sec:${editingSectionId}`);
    try {
      await fetchJson('/api/admin/cbt-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSectionId,
          title: editSectionTitle,
          published: editSectionPublished ? 1 : 0,
        }),
      });
      setEditingSectionId(null);
      await refresh();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? 'Failed to update section'));
    } finally {
      setRowBusyId(null);
    }
  }

  async function toggleSectionPublished(sectionId: string, next: number) {
    setError(null);
    setRowBusyId(`sec:${sectionId}`);
    try {
      await fetchJson('/api/admin/cbt-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sectionId, published: next }),
      });
      await refresh();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? 'Failed to update section'));
    } finally {
      setRowBusyId(null);
    }
  }

  function startEditCbt(c: AdminCbtItem) {
    setEditingCbtId(String(c.id));
    setEditCbtSection(c.section_id == null ? 'u' : String(c.section_id));
    setEditCbtTitle(String(c.title ?? ''));
    setEditCbtUrl(String(c.url ?? ''));
    setEditCbtDesc(String(c.description ?? ''));
    setEditCbtPublished(Number(c.published ?? 0) > 0);
  }

  async function saveCbtEdit() {
    if (!editingCbtId) return;
    setError(null);
    setRowBusyId(`cbt:${editingCbtId}`);
    try {
      await fetchJson('/api/admin/cbts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCbtId,
          sectionId: editCbtSection,
          title: editCbtTitle,
          url: editCbtUrl,
          description: editCbtDesc,
          published: editCbtPublished ? 1 : 0,
        }),
      });
      setEditingCbtId(null);
      await refresh();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? 'Failed to update CBT'));
    } finally {
      setRowBusyId(null);
    }
  }

  async function toggleCbtPublished(cbtId: string, next: number) {
    setError(null);
    setRowBusyId(`cbt:${cbtId}`);
    try {
      await fetchJson('/api/admin/cbts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cbtId, published: next }),
      });
      await refresh();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? 'Failed to update CBT'));
    } finally {
      setRowBusyId(null);
    }
  }

  async function submitSection(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await fetchJson('/api/admin/cbt-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: secTitle, published: secPublished ? 1 : 0 }),
      });
      setSecTitle('');
      setSecPublished(true);
      await refresh();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? 'Failed to add section'));
    } finally {
      setBusy(false);
    }
  }

  async function submitCbt(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await fetchJson('/api/admin/cbts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: cbtSection,
          title: cbtTitle,
          url: cbtUrl,
          description: cbtDesc,
          published: cbtPublished ? 1 : 0,
        }),
      });
      setCbtTitle('');
      setCbtUrl('');
      setCbtDesc('');
      setCbtPublished(true);
      await refresh();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? 'Failed to add CBT'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Keep the selected section valid if sections load later.
    const ok = sectionOptions.some((s) => String(s.id) === String(cbtSection));
    if (!ok) setCbtSection('u');
  }, [sectionOptions, cbtSection]);

  return (
    <div className="grid gap-4">
      {error ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm font-semibold text-red-200">{error}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold">Add section</div>
            <div className="text-xs text-white/60">Sections group CBTs on the Learning page.</div>
          </div>
          <div className="ui-card__body">
            <form className="grid gap-3" onSubmit={submitSection}>
              <label className="grid gap-1">
                <div className="text-xs text-white/60">Title</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="e.g., Clearance Delivery"
                  value={secTitle}
                  onChange={(e) => setSecTitle(e.target.value)}
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={secPublished}
                  onChange={(e) => setSecPublished(e.target.checked)}
                />
                Published
              </label>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-white/50">Published sections appear on /learning/cbts.</div>
                <button disabled={busy || !secTitle.trim()} className="ui-btn ui-btn--primary" type="submit">
                  {busy ? 'Working…' : 'Add section'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold">Add CBT</div>
            <div className="text-xs text-white/60">Paste a Google Slides URL (or any link). The learner view will embed it when possible.</div>
          </div>
          <div className="ui-card__body">
            <form className="grid gap-3" onSubmit={submitCbt}>
              <label className="grid gap-1">
                <div className="text-xs text-white/60">Section</div>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={cbtSection}
                  onChange={(e) => setCbtSection(e.target.value)}
                >
                  {sectionOptions.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {s.title}{s.id !== 'u' && Number(s.published ?? 0) <= 0 ? ' (unpublished section)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <div className="text-xs text-white/60">Title</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="e.g., LUAW Basics"
                  value={cbtTitle}
                  onChange={(e) => setCbtTitle(e.target.value)}
                />
              </label>

              <label className="grid gap-1">
                <div className="text-xs text-white/60">URL</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="https://docs.google.com/presentation/..."
                  value={cbtUrl}
                  onChange={(e) => setCbtUrl(e.target.value)}
                />
              </label>

              <label className="grid gap-1">
                <div className="text-xs text-white/60">Description (optional)</div>
                <textarea
                  className="min-h-[72px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="Short summary shown under the CBT title"
                  value={cbtDesc}
                  onChange={(e) => setCbtDesc(e.target.value)}
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={cbtPublished}
                  onChange={(e) => setCbtPublished(e.target.checked)}
                />
                Published
              </label>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-white/50">Unpublished CBTs won’t appear to learners.</div>
                <button disabled={busy || !cbtTitle.trim() || !cbtUrl.trim()} className="ui-btn ui-btn--primary" type="submit">
                  {busy ? 'Working…' : 'Add CBT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Existing CBTs</div>
              <div className="text-xs text-white/60">Search matches title, description, or URL.</div>
            </div>
            <div className="w-full md:w-80">
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredSections.map((s) => {
          const sid = String(s.id);
          const list = bySection.get(sid) ?? [];
          const query = q.trim().toLowerCase();
          const visible = !query
            ? list
            : list.filter((c) => `${c.title ?? ''} ${c.description ?? ''} ${c.url ?? ''}`.toLowerCase().includes(query));

          const sectionLabel = sid === 'u'
            ? 'Uncategorized'
            : `${s.title}${Number((s as any).published ?? 1) <= 0 ? ' (unpublished)' : ''}`;

          return (
            <div key={sid} className="ui-card">
              <div className="ui-card__header">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{sectionLabel}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-white/60">{visible.length} CBT{visible.length === 1 ? '' : 's'}</div>
                    {sid !== 'u' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="ui-btn"
                          disabled={rowBusyId === `sec:${sid}`}
                          onClick={() => {
                            if (editingSectionId === sid) {
                              setEditingSectionId(null);
                            } else {
                              startEditSection(sid, String((s as any).title ?? ''), Number((s as any).published ?? 0) > 0);
                            }
                          }}
                        >
                          {editingSectionId === sid ? 'Close' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          className="ui-btn"
                          disabled={rowBusyId === `sec:${sid}`}
                          onClick={() => toggleSectionPublished(sid, Number((s as any).published ?? 0) > 0 ? 0 : 1)}
                        >
                          {Number((s as any).published ?? 0) > 0 ? 'Unpublish' : 'Publish'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="ui-card__body">
                {sid !== 'u' && editingSectionId === sid ? (
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1">
                        <div className="text-xs text-white/60">Section title</div>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40"
                          value={editSectionTitle}
                          onChange={(e) => setEditSectionTitle(e.target.value)}
                        />
                      </label>
                      <label className="flex items-center gap-2 self-end text-sm text-white/80">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={editSectionPublished}
                          onChange={(e) => setEditSectionPublished(e.target.checked)}
                        />
                        Published
                      </label>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="ui-btn"
                        onClick={() => setEditingSectionId(null)}
                        disabled={rowBusyId === `sec:${sid}`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        onClick={saveSectionEdit}
                        disabled={rowBusyId === `sec:${sid}` || !editSectionTitle.trim()}
                      >
                        {rowBusyId === `sec:${sid}` ? 'Saving…' : 'Save section'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {!visible.length ? (
                  <div className="text-sm text-white/70">No CBTs in this section.</div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {visible.map((c) => (
                      <div key={String(c.id)} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          {editingCbtId === String(c.id) ? (
                            <div className="grid gap-2">
                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="grid gap-1">
                                  <div className="text-xs text-white/60">Section</div>
                                  <select
                                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                                    value={editCbtSection}
                                    onChange={(e) => setEditCbtSection(e.target.value)}
                                  >
                                    {sectionOptions.map((ss) => (
                                      <option key={String(ss.id)} value={String(ss.id)}>
                                        {ss.title}{ss.id !== 'u' && Number(ss.published ?? 0) <= 0 ? ' (unpublished section)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex items-center gap-2 self-end text-sm text-white/80">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={editCbtPublished}
                                    onChange={(e) => setEditCbtPublished(e.target.checked)}
                                  />
                                  Published
                                </label>
                              </div>

                              <label className="grid gap-1">
                                <div className="text-xs text-white/60">Title</div>
                                <input
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                                  value={editCbtTitle}
                                  onChange={(e) => setEditCbtTitle(e.target.value)}
                                />
                              </label>

                              <label className="grid gap-1">
                                <div className="text-xs text-white/60">URL</div>
                                <input
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                                  value={editCbtUrl}
                                  onChange={(e) => setEditCbtUrl(e.target.value)}
                                />
                              </label>

                              <label className="grid gap-1">
                                <div className="text-xs text-white/60">Description</div>
                                <textarea
                                  className="min-h-[72px] w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                                  value={editCbtDesc}
                                  onChange={(e) => setEditCbtDesc(e.target.value)}
                                />
                              </label>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold">{c.title}</div>
                                {Number(c.published ?? 0) > 0 ? (
                                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">Published</span>
                                ) : (
                                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">Unpublished</span>
                                )}
                              </div>
                              {c.description ? (
                                <div className="mt-0.5 line-clamp-2 text-xs text-white/60">{c.description}</div>
                              ) : null}
                              <div className="mt-0.5 truncate text-xs text-white/40">{c.url}</div>
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {editingCbtId === String(c.id) ? (
                            <>
                              <button
                                type="button"
                                className="ui-btn"
                                onClick={() => setEditingCbtId(null)}
                                disabled={rowBusyId === `cbt:${String(c.id)}`}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="ui-btn ui-btn--primary"
                                onClick={saveCbtEdit}
                                disabled={rowBusyId === `cbt:${String(c.id)}` || !editCbtTitle.trim() || !editCbtUrl.trim()}
                              >
                                {rowBusyId === `cbt:${String(c.id)}` ? 'Saving…' : 'Save'}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="ui-btn"
                                onClick={() => startEditCbt(c)}
                                disabled={rowBusyId === `cbt:${String(c.id)}`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="ui-btn"
                                onClick={() => toggleCbtPublished(String(c.id), Number(c.published ?? 0) > 0 ? 0 : 1)}
                                disabled={rowBusyId === `cbt:${String(c.id)}`}
                              >
                                {Number(c.published ?? 0) > 0 ? 'Unpublish' : 'Publish'}
                              </button>
                              <a className="ui-btn" href={String(c.url)} target="_blank" rel="noreferrer">Open</a>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
