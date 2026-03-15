"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ProcedureLink = {
  name: string;
  url: string;
};

type AirportQuickLookResponse = {
  ok: boolean;
  error?: string;
  cycle: string | null;
  query: {
    input: string;
    faa?: string;
    icao?: string;
    display?: string;
  };
  airport?: {
    faa?: string;
    icao?: string;
    lat?: number;
    lon?: number;
  };
  metar?: {
    raw?: string;
    fetchedAtIso?: string;
    source?: string;
  };
  procedures?: {
    tppCycle?: string;
    searchUrl?: string;
    sids: ProcedureLink[];
    stars: ProcedureLink[];
    source?: string;
  };
};

const PINNED_KEY = "ids:pinnedAirports:v1";

function normalizePinnedCode(code: string): string {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function readPinnedAirports(): string[] {
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePinnedCode).filter(Boolean);
  } catch {
    return [];
  }
}

function writePinnedAirports(pinned: string[]): void {
  try {
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
  } catch {
    // ignore
  }
}

export function AirportQuickLook() {
  const [code, setCode] = useState<string>("");
  const [result, setResult] = useState<AirportQuickLookResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [pinned, setPinned] = useState<string[]>([]);

  const searchParams = useSearchParams();
  const didAutoQueryRef = useRef(false);


  useEffect(() => {
    setPinned(readPinnedAirports());
  }, []);
  // Allow deep-links like /ids?tab=airport&airport=KCLE
  useEffect(() => {
    if (didAutoQueryRef.current) return;
    const qp = searchParams.get("airport") || searchParams.get("code");
    if (!qp) return;
    const q = normalizePinnedCode(qp);
    if (!q) return;
    didAutoQueryRef.current = true;
    setCode(q);
    fetchAirportQuickLook(q);
  }, [searchParams]);


  const primaryAirportCode = useMemo(() => {
    const r = result;
    if (!r?.ok) return null;
    const icao = r.airport?.icao?.toUpperCase();
    const faa = r.airport?.faa?.toUpperCase();
    return normalizePinnedCode(icao || faa || r.query?.display || r.query?.input || "");
  }, [result]);

  const isPinned = useMemo(() => {
    if (!primaryAirportCode) return false;
    return pinned.includes(primaryAirportCode);
  }, [pinned, primaryAirportCode]);

  async function fetchAirportQuickLook(input: string) {
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ids/airport?code=${encodeURIComponent(q)}`);
      const json: AirportQuickLookResponse = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({
        ok: false,
        error: e?.message ?? "Failed to fetch",
        cycle: null,
        query: { input: q },
      });
    } finally {
      setLoading(false);
    }
  }

  function togglePin() {
    if (!primaryAirportCode) return;
    setPinned((prev) => {
      const next = prev.includes(primaryAirportCode)
        ? prev.filter((x) => x !== primaryAirportCode)
        : [...prev, primaryAirportCode];
      writePinnedAirports(next);
      return next;
    });
  }

  function removePinned(codeToRemove: string) {
    const norm = normalizePinnedCode(codeToRemove);
    setPinned((prev) => {
      const next = prev.filter((x) => x !== norm);
      writePinnedAirports(next);
      return next;
    });
  }

  function openPinned(codeToOpen: string) {
    const norm = normalizePinnedCode(codeToOpen);
    setCode(norm);
    fetchAirportQuickLook(norm);
  }

  const headerLabel = useMemo(() => {
    if (!result?.ok) return null;
    const icao = result.airport?.icao?.toUpperCase();
    const faa = result.airport?.faa?.toUpperCase();
    if (icao && faa && icao !== faa) return `${icao} (${faa})`;
    return icao || faa || result.query?.display || null;
  }, [result]);

  const metarText = useMemo(() => {
    if (!result?.ok) return null;
    const raw = result.metar?.raw ?? null;
    if (!raw) return null;
    return raw;
  }, [result]);

  const sids = result?.ok ? result?.procedures?.sids ?? [] : [];
  const stars = result?.ok ? result?.procedures?.stars ?? [] : [];
  const tppSearchUrl = result?.ok ? result?.procedures?.searchUrl : undefined;

  async function openProcedureChart(proc: { name: string; url: string }) {
    if (!result?.ok) return;

    // Prefer the direct URL we already have (often a direct PDF).
    const direct = String(proc?.url || '').trim();
    if (direct) {
      window.open(direct, '_blank', 'noopener,noreferrer');
      return;
    }

    // Fallback: attempt to resolve a chart link by procedure name.
    const airportCode =
      result.airport?.icao || result.airport?.faa || result.query?.display || result.query?.input || code;
    const qs = new URLSearchParams({
      airport: String(airportCode || '').trim(),
      proc: String(proc?.name || '').trim(),
    });

    try {
      const res = await fetch(`/api/ids/chart?${qs.toString()}`);
      const data: any = await res.json();
      const url = data?.url || tppSearchUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      if (tppSearchUrl) window.open(tppSearchUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle>Airport Quick Look</CardTitle>
          <div className="flex items-center gap-2">
            {primaryAirportCode ? (
              <Button variant={isPinned ? "secondary" : "outline"} size="sm" onClick={togglePin}>
                {isPinned ? "Pinned" : "Pin"}
              </Button>
            ) : null}
          </div>
        </div>

        {pinned.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pinned.map((p) => (
              <div key={p} className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openPinned(p)}
                  className="shrink-0"
                >
                  {p}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removePinned(p)}
                  aria-label={`Remove ${p}`}
                  title={`Remove ${p}`}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="airport-code">Airport code (ICAO or FAA)</Label>
            <Input
              id="airport-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. KCLE or CLE"
              autoComplete="off"
            />
          </div>
          <Button
            type="button"
            onClick={() => fetchAirportQuickLook(code)}
            disabled={loading || !code.trim()}
            className="md:w-28"
          >
            {loading ? "..." : "Search"}
          </Button>
        </div>

        {result?.error ? <div className="text-sm text-red-500">{result.error}</div> : null}

        {result?.ok ? (
          <>
            <Separator />

            {headerLabel ? (
              <div className="text-lg font-semibold tracking-tight">{headerLabel}</div>
            ) : null}

            {/* METAR */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-sm font-semibold">Current METAR</div>
                <div className="text-xs text-muted-foreground">
                  {result.metar?.fetchedAtIso ? `Updated ${result.metar.fetchedAtIso}` : null}
                </div>
              </div>

              {metarText ? (
                <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-relaxed">
                  {metarText}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground">No METAR available.</div>
              )}
            </div>

            <Separator />

            {/* Procedures */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-semibold">SIDs</div>
                {sids.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No SID list found.</div>
                ) : (
                  <ul className="space-y-1">
                    {sids.map((p) => (
                      <li key={`sid-${p.url}-${p.name}`}>
                        <button
                          type="button"
                          onClick={() => openProcedureChart(p)}
                          className="text-sm text-primary underline underline-offset-4 hover:no-underline"
                          title="Open chart"
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">STARs</div>
                {stars.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No STAR list found.</div>
                ) : (
                  <ul className="space-y-1">
                    {stars.map((p) => (
                      <li key={`star-${p.url}-${p.name}`}>
                        <button
                          type="button"
                          onClick={() => openProcedureChart(p)}
                          className="text-sm text-primary underline underline-offset-4 hover:no-underline"
                          title="Open chart"
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {tppSearchUrl ? (
              <div className="text-xs text-muted-foreground">
                Missing something? Open the full procedure search: {" "}
                <a
                  href={tppSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-4 hover:no-underline"
                >
                  FAA d-TPP search
                </a>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default AirportQuickLook;
