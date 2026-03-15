"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RootInfo = { baseDir: string; cycle: string | null };
type StatusRow = {
  relPath: string;
  absPath: string;
  exists: boolean;
  sizeBytes: number;
  updatedAt: string | null;
};

export function IdsDataStatusClient(props: { initialRoot: RootInfo; initialStatus: StatusRow[] }) {
  const [root, setRoot] = useState<RootInfo>(props.initialRoot);
  const [status, setStatus] = useState<StatusRow[]>(props.initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ids/reload", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Reload failed");
      setRoot(json.root);
      setStatus(json.status);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>IDS Data Status</CardTitle>
          <Button onClick={reload} disabled={busy}>
            {busy ? "Reloading…" : "Reload IDS Data"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Base:</span> {root.baseDir}
            </div>
            <div>
              <span className="font-medium text-foreground">Cycle:</span> {root.cycle ?? "(root)"}
            </div>
          </div>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Exists</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status.map((r) => (
                <TableRow key={r.relPath}>
                  <TableCell className="font-mono text-xs">{r.relPath}</TableCell>
                  <TableCell>{r.exists ? "✅" : "❌"}</TableCell>
                  <TableCell className="text-right">{r.exists ? r.sizeBytes.toLocaleString() : "—"}</TableCell>
                  <TableCell>{r.updatedAt ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
