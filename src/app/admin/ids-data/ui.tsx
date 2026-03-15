'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

import { refreshNasrFromFaaAction, uploadNasrZipAction, uploadSupplementalNavdataAction, type RefreshResult } from './actions';

export type DatasetStatus = {
  dataset: string;
  cycle: string;
  updated_at: string;
};

function fmtDate(v: string) {
  // stored as text from postgres; show as-is if parsing fails
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export function IDSDataClient({ datasets }: { datasets: DatasetStatus[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [suppResult, setSuppResult] = useState<RefreshResult | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const suppAirportsRef = useRef<HTMLInputElement | null>(null);
  const suppFixRef = useRef<HTMLInputElement | null>(null);
  const suppNavRef = useRef<HTMLInputElement | null>(null);
  const [suppScope, setSuppScope] = useState<'region' | 'north_america' | 'global'>('region');

  const byKey = useMemo(() => {
    const m = new Map<string, DatasetStatus>();
    for (const d of datasets ?? []) m.set(String(d.dataset), d);
    return m;
  }, [datasets]);

  const knownKeys = ['apt', 'nav', 'fixes', 'awy', 'sid', 'star', 'faa'];
  const rows = knownKeys.map((k) => byKey.get(k) ?? { dataset: k, cycle: '-', updated_at: '-' });

  const runAuto = () => {
    startTransition(async () => {
      setResult(null);
      try {
        const r = await refreshNasrFromFaaAction();
        setResult(r);
        if (r.ok) {
          toast.success(r.message);
          router.refresh();
        } else {
          toast.error(r.message);
        }
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to refresh NASR datasets.';
        setResult({ ok: false, message: msg });
        toast.error(msg);
      }
    });
  };

  const runUpload = (file: File) => {
    startTransition(async () => {
      setResult(null);
      const fd = new FormData();
      fd.set('zip', file);
      try {
        const r = await uploadNasrZipAction(fd);
        setResult(r);
        if (r.ok) {
          toast.success(r.message);
          router.refresh();
        } else {
          toast.error(r.message);
        }
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to import uploaded ZIP.';
        setResult({ ok: false, message: msg });
        toast.error(msg);
      }
    });
  };

  const runSupplemental = () => {
    startTransition(async () => {
      setSuppResult(null);
      const fd = new FormData();
      fd.set('scope', suppScope);

      const airports = suppAirportsRef.current?.files?.[0] ?? null;
      const fix = suppFixRef.current?.files?.[0] ?? null;
      const nav = suppNavRef.current?.files?.[0] ?? null;

      if (airports) fd.set('airports_csv', airports);
      if (fix) fd.set('earth_fix', fix);
      if (nav) fd.set('earth_nav', nav);

      if (!airports && !fix && !nav) {
        toast.error('Choose at least one supplemental file first.');
        return;
      }

      try {
        const r = await uploadSupplementalNavdataAction(fd);
        setSuppResult(r);
        if (r.ok) {
          toast.success(r.message);
          router.refresh();
        } else {
          toast.error(r.message);
        }
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to import supplemental navdata.';
        setSuppResult({ ok: false, message: msg });
        toast.error(msg);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold text-white">Auto Refresh (FAA)</div>
            <span className="ui-badge">NASR</span>
          </div>
          <div className="ui-card__body space-y-3">
            <div className="text-sm text-white/70">
              Downloads the newest <span className="font-semibold text-white/80">28-Day NASR subscription ZIP</span> from the FAA site,
              parses it, and overwrites the IDS datasets in Postgres.
            </div>
            <Button onClick={runAuto} disabled={pending}>
              {pending ? 'Refreshing…' : 'Refresh from FAA'}
            </Button>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold text-white">Manual Upload</div>
            <span className="ui-badge">ZIP</span>
          </div>
          <div className="ui-card__body space-y-3">
            <div className="text-sm text-white/70">
              Upload a NASR subscription ZIP manually if needed.
            </div>
            <div className="space-y-2">
              <Label htmlFor="nasr-zip" className="text-white/80">NASR ZIP</Label>
              <Input
                id="nasr-zip"
                ref={fileRef}
                type="file"
                accept=".zip,application/zip"
                disabled={pending}
              />
            </div>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                const f = fileRef.current?.files?.[0];
                if (!f) {
                  toast.error('Choose a ZIP file first.');
                  return;
                }
                runUpload(f);
              }}
            >
              {pending ? 'Importing…' : 'Import Uploaded ZIP'}
            </Button>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Supplemental Navdata (Canada / Global)</div>
          <span className="ui-badge">OPTIONAL</span>
        </div>
        <div className="ui-card__body space-y-3">
          <div className="text-sm text-white/70">
            FAA NASR is US-only. If your IDS routes include <span className="font-semibold text-white/80">Canadian fixes/airports</span> (e.g. CYYZ, WOZEE),
            you can import a supplemental dataset.
            <div className="mt-2 text-white/60">
              Recommended: X-Plane-format <span className="font-mono">earth_fix.dat</span> and <span className="font-mono">earth_nav.dat</span> (from your sim navdata / Navigraph),
              plus <span className="font-mono">airports.csv</span> from OurAirports for non-US airports.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-white/80">Scope</Label>
              <select
                className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-white"
                value={suppScope}
                onChange={(e) => setSuppScope(e.target.value as any)}
                disabled={pending}
              >
                <option value="region">Great Lakes region (fast)</option>
                <option value="north_america">North America</option>
                <option value="global">Global (largest)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supp-airports" className="text-white/80">airports.csv (OurAirports)</Label>
              <Input id="supp-airports" ref={suppAirportsRef} type="file" accept=".csv,text/csv" disabled={pending} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supp-fix" className="text-white/80">earth_fix.dat (X-Plane)</Label>
              <Input id="supp-fix" ref={suppFixRef} type="file" accept=".dat,text/plain" disabled={pending} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="supp-nav" className="text-white/80">earth_nav.dat (X-Plane)</Label>
              <Input id="supp-nav" ref={suppNavRef} type="file" accept=".dat,text/plain" disabled={pending} />
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button variant="secondary" disabled={pending} onClick={runSupplemental}>
                {pending ? 'Importing…' : 'Import Supplemental Navdata'}
              </Button>
            </div>
          </div>

          {suppResult ? (
            <div className="text-sm">
              <div className={suppResult.ok ? 'text-emerald-400' : 'text-red-400'}>{suppResult.message}</div>
              {suppResult.stats ? (
                <div className="text-white/55">
                  Imported: {Object.entries(suppResult.stats)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ')}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Current Dataset Status</div>
          <span className="ui-badge">DB</span>
        </div>
        <div className="ui-card__body">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-white/80">
                  <th className="text-left py-2 pr-4">Dataset</th>
                  <th className="text-left py-2 pr-4">Cycle</th>
                  <th className="text-left py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.dataset} className="border-t border-white/10 text-white/75">
                    <td className="py-2 pr-4 font-mono">{r.dataset}</td>
                    <td className="py-2 pr-4">{r.cycle ?? '-'}</td>
                    <td className="py-2">{r.updated_at ? fmtDate(r.updated_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {result ? (
        <div className="text-sm">
          <div className={result.ok ? 'text-emerald-400' : 'text-red-400'}>{result.message}</div>
          {result.fileName ? <div className="text-white/55">File: {result.fileName}</div> : null}
          {result.cycle ? <div className="text-white/55">Cycle: {result.cycle}</div> : null}
          {result.stats ? (
            <div className="text-white/55">
              Imported: {Object.entries(result.stats)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
