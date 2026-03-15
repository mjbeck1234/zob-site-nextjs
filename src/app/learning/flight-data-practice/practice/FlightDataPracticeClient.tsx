'use client';

import { useEffect, useMemo, useState } from 'react';

type FDPCase = {
  id: number;
  title: string | null;
  callsign: string;
  ac_type: string;
  flight_rules: string;
  dep: string;
  arr: string;
  bad_cruise_alt: number | null;
  bad_route: string | null;
  bad_remarks: string | null;
  good_cruise_alt: number | null;
  good_route: string | null;
  good_remarks: string | null;
};

type CheckResult = {
  ok: boolean;
  result: {
    ok: boolean;
    altitudeOk: boolean;
    routeOk: boolean;
    remarksOk: boolean;
  };
  submitted?: {
    cruiseAlt: string;
    route: string;
    remarks: string;
  };
  nextCase?: FDPCase | null;
};

function normRoute(s: string): string {
  const raw = (s ?? '').trim().toUpperCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');
  if (!raw) return '';
  const cleaned = raw.replace(/[^A-Z0-9\s]/g, ' ');
  return cleaned
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t !== 'DCT' && t !== 'DIRECT')
    .join(' ');
}

function badge(ok: boolean) {
  return ok ? '✅' : '❌';
}

export default function FlightDataPracticeClient({ initialCase }: { initialCase: FDPCase | null }) {
  const [caseRow, setCaseRow] = useState<FDPCase | null>(initialCase);
  const [mode, setMode] = useState<'all' | 'errors'>('all');
  const [cruiseAlt, setCruiseAlt] = useState<string>('');
  const [route, setRoute] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<CheckResult | null>(null);
  const [toast, setToast] = useState<string>('');

  useEffect(() => {
    if (!caseRow) return;
    setCruiseAlt(caseRow.bad_cruise_alt == null ? '' : String(caseRow.bad_cruise_alt));
    setRoute(caseRow.bad_route ?? '');
    setRemarks(caseRow.bad_remarks ?? '');
    setLast(null);
    setToast('');
  }, [caseRow?.id]);

  const title = useMemo(() => {
    if (!caseRow) return 'No practice plans configured.';
    return caseRow.title || `Flight Strip - ${caseRow.callsign} (${caseRow.dep}→${caseRow.arr})`;
  }, [caseRow]);

  async function loadNext() {
    const res = await fetch('/api/flight-data-practice/next', { cache: 'no-store' });
    if (!res.ok) throw new Error('Unable to load next plan');
    const data = await res.json();
    setCaseRow(data.case ?? null);
  }

  async function onCheck() {
    if (!caseRow) return;
    setBusy(true);
    setToast('');
    try {
      const res = await fetch('/api/flight-data-practice/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId: caseRow.id,
          cruiseAlt,
          route,
          remarks,
        }),
      });

      const data = (await res.json()) as CheckResult;
      setLast({
        ...data,
        submitted: {
          cruiseAlt,
          route,
          remarks,
        },
      });

      if (data.ok) {
        setToast('Correct! Click New Plan when you are ready.');
      }
    } catch (e: any) {
      setToast(e?.message || 'Unable to check plan');
    } finally {
      setBusy(false);
    }
  }

  if (!caseRow) {
    return (
      <div className="ui-card">
        <div className="ui-card__body">
          <div className="text-sm text-white/70">No Flight Data Practice plans are published yet.</div>
          <div className="mt-4 text-sm text-white/70">Ask a Training Administrator to add plans in Admin → Flight Data Practice.</div>
        </div>
      </div>
    );
  }

  const hasAlt = caseRow.good_cruise_alt != null;
  const hasRoute = caseRow.good_route != null;
  const hasRemarks = caseRow.good_remarks != null;

  const showNonErrors = mode === 'all';
  const altOk = hasAlt ? last?.result?.altitudeOk : true;
  const routeOk = hasRoute ? last?.result?.routeOk : true;
  const remarksOk = hasRemarks ? last?.result?.remarksOk : true;
  const submittedCruiseAlt = last?.submitted?.cruiseAlt ?? '';
  const submittedRoute = last?.submitted?.route ?? '';
  const submittedRemarks = last?.submitted?.remarks ?? '';

  // Generic explanations (do not reveal the answer).
  const altitudeWrongMsg = `The altitude you entered is incorrect for this scenario. Review direction-of-flight / altitude rules (FAA JO 7110.65 4-5-2) and select an appropriate altitude.`;
  const altitudeRightMsg = `The altitude you entered is correct for this scenario.`;
  const routeWrongMsg = `The route you entered is not IAW our inter-facility LOAs for this destination. Review the LOA downloads and preferred routes, then file a valid routing.`;
  const routeRightMsg = `The route you entered is IAW our inter-facility LOAs.`;

  return (
    <div className="grid gap-4">
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="flex items-center gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="ui-input text-sm"
              style={{ minWidth: 160 }}
            >
              <option value="all">All Fields</option>
              <option value="errors">Only Errors</option>
            </select>
          </div>
        </div>

        <div className="ui-card__body">
          {toast ? (
            <div className="mb-3 text-sm text-white/75">{toast}</div>
          ) : null}

          <div className="grid gap-4">
            {showNonErrors ? (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Callsign</span>
                  <input className="ui-input" value={caseRow.callsign} readOnly />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">A/C Type</span>
                  <input className="ui-input" value={caseRow.ac_type} readOnly />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Flight Rules</span>
                  <input className="ui-input" value={caseRow.flight_rules} readOnly />
                </label>
              </div>
            ) : null}

            {showNonErrors ? (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Depart</span>
                  <input className="ui-input" value={caseRow.dep} readOnly />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Arrive</span>
                  <input className="ui-input" value={caseRow.arr} readOnly />
                </label>
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">&nbsp;</span>
                  <div className="flex items-center gap-2">
                    <button disabled={busy} onClick={onCheck} className="ui-btn ui-btn--primary" type="button">
                      ✓ Amend Plan
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => loadNext().catch(() => {})}
                      className="ui-btn"
                      type="button"
                    >
                      ⟳ New Plan
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-white/70">{caseRow.dep} → {caseRow.arr} ({caseRow.callsign})</div>
                <div className="flex items-center gap-2">
                  <button disabled={busy} onClick={onCheck} className="ui-btn ui-btn--primary" type="button">✓ Amend Plan</button>
                  <button disabled={busy} onClick={() => loadNext().catch(() => {})} className="ui-btn" type="button">⟳ New Plan</button>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {hasAlt ? (
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Cruise Alt</span>
                  <input
                    className="ui-input"
                    value={cruiseAlt}
                    onChange={(e) => setCruiseAlt(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 29000"
                  />
                </label>
              ) : null}
              {hasRoute ? (
                <label className={`grid gap-1 ${hasAlt ? 'md:col-span-2' : 'md:col-span-3'}`}>
                  <span className="text-sm font-semibold text-white/85">Route</span>
                  <input
                    className="ui-input"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    placeholder="e.g. ACO BUCKO ANTHM4"
                  />
                </label>
              ) : null}
            </div>

            {hasRemarks ? (
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Remarks</span>
                <textarea
                  className="ui-input"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="/V/"
                />
              </label>
            ) : null}
          </div>
        </div>
      </div>

      {last ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="grid gap-4">
              <div className="text-sm text-white/80 font-semibold">Results</div>

              <div className="grid gap-3">
                {hasAlt ? (
                  <div className="flex gap-3">
                    <div className="text-2xl" aria-hidden>{badge(Boolean(altOk))}</div>
                    <div>
                      <div className="text-sm font-semibold text-white/90">Altitude: {submittedCruiseAlt || '—'}</div>
                      <div className="text-sm text-white/70">{altOk ? altitudeRightMsg : altitudeWrongMsg}</div>
                    </div>
                  </div>
                ) : null}

                {hasRoute ? (
                  <div className="flex gap-3">
                    <div className="text-2xl" aria-hidden>{badge(Boolean(routeOk))}</div>
                    <div>
                      <div className="text-sm font-semibold text-white/90">Route: {normRoute(submittedRoute) || '—'}</div>
                      <div className="text-sm text-white/70">
                        {routeOk ? routeRightMsg : (
                          <>
                            {routeWrongMsg}{' '}
                            <a href="/downloads" target="_blank" rel="noreferrer" className="ui-link">LOA downloads</a>
                            {' '}or{' '}
                            <a href={`/routing?arrival=${encodeURIComponent(caseRow.arr)}`} target="_blank" rel="noreferrer" className="ui-link">preferred routes</a>
                            .
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {hasRemarks ? (
                  <div className="flex gap-3">
                    <div className="text-2xl" aria-hidden>{badge(Boolean(remarksOk))}</div>
                    <div>
                      <div className="text-sm font-semibold text-white/90">Remarks</div>
                      <div className="text-sm text-white/70">{remarksOk ? 'Looks good.' : 'Remarks do not match the expected format for this scenario.'}</div>
                      {submittedRemarks ? <div className="mt-1 text-xs text-white/50">Submitted: {submittedRemarks}</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
