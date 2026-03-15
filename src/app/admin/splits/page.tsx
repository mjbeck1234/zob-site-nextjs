import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { selectAll } from '@/lib/query';
import { getActiveSplitSelection, getSplitPresets } from '@/lib/content';
import { deleteSplitAction } from './actions';
import { createPresetFromLiveAction, deleteSplitPresetAction, setActiveSplitAction } from './activeActions';
import { tableExists } from '@/lib/schema';

export default async function AdminSplitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const deleted = (sp?.deleted ?? '') === '1';

  const exists = await tableExists('splits');
  const rows = exists ? await selectAll('splits', { orderBySql: 'id DESC', limit: 200 }) : [];

  const hasActive = await tableExists('split_active');
  const hasPresets = await tableExists('split_presets');
  const active = await getActiveSplitSelection();
  const presets = await getSplitPresets();

  return (
    <PageShell
      title="Admin • Splits"
      subtitle="Manage split/sector configurations."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Splits' }]}
      right={(
        <Link href="/admin/splits/new" className="ui-button">New split</Link>
      )}
    >
      {deleted ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Split deleted.</div>
      ) : null}


      <div className="ui-card mb-6">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Active split</div>
          <span className="ui-badge">Global</span>
        </div>
        <div className="ui-card__body">
          {!hasActive || !hasPresets ? (
            <div className="text-sm text-white/70">
              To enable the global active split selector and server-side presets, run{' '}
              <code className="rounded bg-white/10 px-1 py-0.5">sql/create_tables_split_state.sql</code> against your database.
            </div>
          ) : (
            <form action={setActiveSplitAction} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs text-white/60">Mode</div>
                  <select name="mode" defaultValue={active.mode} className="ui-input w-full">
                    <option value="live">Live (database)</option>
                    <option value="preset">Preset</option>
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/60">Preset</div>
                  <select name="preset_id" defaultValue={active.presetId ?? ''} className="ui-input w-full">
                    <option value="">Select preset…</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-white/50">Only used when Mode = Preset.</div>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="ui-btn w-full">
                    Set active
                  </button>
                </div>
              </div>
              <div className="text-xs text-white/60">
                Current:{' '}
                {active.mode === 'preset' && active.presetName ? (
                  <span className="font-medium text-white">Preset — {active.presetName}</span>
                ) : (
                  <span className="font-medium text-white">Live (database)</span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="ui-card mb-6">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Split presets</div>
          <span className="ui-badge">{presets.length}</span>
        </div>
        <div className="ui-card__body">
          {!hasPresets ? (
            <div className="text-sm text-white/70">
              Presets are not enabled. Run{' '}
              <code className="rounded bg-white/10 px-1 py-0.5">sql/create_tables_split_state.sql</code>.
            </div>
          ) : (
            <div className="space-y-4">
              <form action={createPresetFromLiveAction} className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <div className="mb-1 text-xs text-white/60">New preset name</div>
                  <input name="name" className="ui-input w-full" placeholder="e.g. FNO split" />
                  <div className="mt-1 text-[11px] text-white/50">Saves the current rows in the Splits table.</div>
                </div>
                <button type="submit" className="ui-btn md:w-auto">
                  Save current as preset
                </button>
              </form>

              {presets.length ? (
                <div className="space-y-2">
                  {presets.map((p) => (
                    <div key={p.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="text-xs text-white/50">
                          {p.createdAt ? `Created ${new Date(p.createdAt).toLocaleString()}` : ''}
                          {p.createdBy ? ` • ${p.createdBy}` : ''}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <form action={setActiveSplitAction}>
                          <input type="hidden" name="mode" value="preset" />
                          <input type="hidden" name="preset_id" value={p.id} />
                          <button type="submit" className="ui-btn ui-btn--primary">
                            Set active
                          </button>
                        </form>
                        <form action={deleteSplitPresetAction}>
                          <input type="hidden" name="preset_id" value={p.id} />
                          <button type="submit" className="ui-btn ui-btn--danger">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/60">No presets yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
      {!exists ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          Your database does not contain a <span className="font-semibold">splits</span> table.
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Splits</div>
          <span className="ui-badge">{rows.length}</span>
        </div>
        <div className="ui-card__body">
          {rows.length ? (
            <div className="space-y-3">
              {rows.map((r: any) => (
                <div key={String(r.id)} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{String(r.callsign ?? `Split #${r.id}`)}</div>
                      <div className="mt-1 text-xs text-white/60">{r.frequency ? String(r.frequency) : ''}{r.type ? ` • ${String(r.type)}` : ''}</div>
                      <div className="mt-2 text-xs text-white/70">
                        {String(r.splits ?? '').slice(0, 120)}{String(r.splits ?? '').length > 120 ? '…' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/splits/${r.id}`} className="ui-button">Edit</Link>
                      <form action={deleteSplitAction.bind(null, String(r.id))}>
                        <button className="ui-button danger" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60">No splits found.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
