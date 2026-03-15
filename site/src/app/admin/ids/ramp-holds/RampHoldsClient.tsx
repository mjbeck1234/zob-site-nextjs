"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

type Hold = {
  icao: string;
  standId: string;
  standRef: string | null;
  note: string | null;
  createdByCid: number | null;
  createdByMode: string | null;
  createdAtMs: number;
  expiresAtMs: number;
  updatedAtMs: number;
  pilotConnected: boolean | null;
};

function fmt(ms: number) {
  if (!ms) return "";
  try {
    const d = new Date(ms);
    return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function RampHoldsClient() {
  const [icao, setIcao] = useState("KDTW");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const f = filter.trim().toUpperCase();
    if (!f) return holds;
    return holds.filter((h) => {
      const ref = (h.standRef ?? "").toUpperCase();
      const note = (h.note ?? "").toUpperCase();
      const mode = (h.createdByMode ?? "").toUpperCase();
      const cid = h.createdByCid ? String(h.createdByCid) : "";
      return ref.includes(f) || h.standId.toUpperCase().includes(f) || note.includes(f) || mode.includes(f) || cid.includes(f);
    });
  }, [holds, filter]);

  const summary = useMemo(() => {
    let pilot = 0;
    let controller = 0;
    let other = 0;
    let connected = 0;
    let connectedKnown = 0;

    for (const h of holds) {
      const m = (h.createdByMode ?? "").toLowerCase();
      if (m === "pilot") pilot++;
      else if (m === "controller") controller++;
      else other++;

      if (h.pilotConnected !== null) {
        connectedKnown++;
        if (h.pilotConnected) connected++;
      }
    }
    return { pilot, controller, other, connected, connectedKnown };
  }, [holds]);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ramp-holds?icao=${encodeURIComponent(icao)}&includeConnected=1&activeOnly=1`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load holds");
      setHolds((json.holds ?? []) as Hold[]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearHold(standId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ramp-holds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "clear", icao, standId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Clear failed");
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    const t = window.setInterval(() => load(), 30 * 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icao]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Active Ramp Holds</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              className="w-[110px]"
              value={icao}
              onChange={(e) => setIcao(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="KDTW"
            />
            <Button onClick={load} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Pilot: {summary.pilot}</Badge>
            <Badge variant="secondary">Controller: {summary.controller}</Badge>
            <Badge variant="secondary">Other: {summary.other}</Badge>
            {summary.connectedKnown ? (
              <Badge variant="secondary">Pilots connected: {summary.connected}/{summary.connectedKnown}</Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter (A36, cid, note…)" />
            <Button variant="outline" onClick={() => setFilter("")} disabled={!filter}>
              Clear
            </Button>
          </div>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stand</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>CID</TableHead>
                <TableHead>Connected</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? (
                filtered.map((h) => (
                  <TableRow key={`${h.icao}-${h.standId}`}>
                    <TableCell className="font-medium">{h.standRef || h.standId}</TableCell>
                    <TableCell>{h.createdByMode || ""}</TableCell>
                    <TableCell>{h.createdByCid ?? ""}</TableCell>
                    <TableCell>
                      {h.createdByMode?.toLowerCase() === "pilot" ? (
                        h.pilotConnected === null ? "" : h.pilotConnected ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-red-600">No</span>
                        )
                      ) : (
                        ""
                      )}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate" title={h.note ?? ""}>
                      {h.note ?? ""}
                    </TableCell>
                    <TableCell>{fmt(h.expiresAtMs)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => clearHold(h.standId)} disabled={busy}>
                        Release
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">
                    No active holds.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>
            This page reads from <span className="font-medium text-foreground">ids_ramp_holds</span> and lets staff release
            stuck reservations. It refreshes every 30 seconds.
          </div>
          <div>
            Pilot connectivity is estimated from the live VATSIM pilot list (not prefiler list). A pilot shown as "No"
            may be disconnected or their feed entry may be delayed.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
