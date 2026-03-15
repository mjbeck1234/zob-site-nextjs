import { NextResponse } from 'next/server';
import { findProceduresByName, getProcedureFixes, type ProcedureFixPoint } from '@/lib/idsProcedures';
import { getAirwayString, getPointsByIds } from '@/lib/idsCoreData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Expected by the Leaflet route plotter on the IDS map
type OutFix = { fix: string; lat: number; lon: number };
type RouteResponse = { route: string; fixes: OutFix[]; errors?: string[] };

const norm = (s: string) => String(s ?? '').trim().toUpperCase();

function altAirportId(tok: string): string | null {
  const t = norm(tok);
  if (t.startsWith('K') && t.length === 4) return t.slice(1);
  return null;
}

function splitTokens(route: string): string[] {
  return String(route ?? '')
    .trim()
    .split(/\s+/g)
    .map((t) => norm(t))
    .filter(Boolean);
}

function isAirway(tok: string): boolean {
  // J/Q/V/T/A...
  return /^[A-Z]{1,2}\d+$/i.test(tok) && /^(J|Q|V|T|A)/i.test(tok);
}

function isProcName(tok: string): boolean {
  // Typically ends in a digit: BLAID2, ACCRA5, PUCKY1, etc.
  return /^[A-Z0-9]{3,10}\d$/i.test(tok);
}

function parseAirwayString(s: string): string[] {
  // AWY_STRING is like: 'KXYZ..ABC..DEF..GHI'
  const parts = String(s ?? '')
    .split('..')
    .map((x) => norm(x))
    .filter(Boolean);
  return parts;
}

function sq(n: number) {
  return n * n;
}

function coordForSeqItem(
  item: string | ProcedureFixPoint,
  point: Map<string, { lat: number; lon: number }>
): { lat: number; lon: number } | null {
  if (typeof item === 'string') {
    const named = point.get(norm(item));
    if (named) return named;
    const alt = altAirportId(item);
    return alt ? (point.get(alt) ?? null) : null;
  }

  if (item.lat != null && item.lon != null) return { lat: item.lat, lon: item.lon };
  const named = point.get(norm(item.fix));
  if (named) return named;
  const alt = altAirportId(item.fix);
  return alt ? (point.get(alt) ?? null) : null;
}

function coordForProcPoint(
  item: ProcedureFixPoint,
  point: Map<string, { lat: number; lon: number }>
): { lat: number; lon: number } | null {
  return coordForSeqItem(item, point);
}

function nearestIndexOnSeq(
  seq: Array<string | ProcedureFixPoint>,
  point: Map<string, { lat: number; lon: number }>,
  anchor: { lat: number; lon: number }
): number {
  let best = -1;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < seq.length; i++) {
    const p = coordForSeqItem(seq[i], point);
    if (!p) continue;
    const d = sq(p.lat - anchor.lat) + sq(p.lon - anchor.lon);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const route = norm(url.searchParams.get('route') ?? '');
  if (!route) return NextResponse.json({ error: 'Missing route' }, { status: 400 });

  const errors: string[] = [];

  // Point lookup is now lazy/DB-backed to avoid loading large JSON arrays into memory.
  const point = new Map<string, { lat: number; lon: number }>();

  const ensurePoints = async (ids: string[]) => {
    const want: string[] = [];
    for (const raw of ids) {
      const t = norm(raw);
      if (!t) continue;
      if (!point.has(t)) want.push(t);
      const alt = altAirportId(t);
      if (alt && !point.has(alt)) want.push(alt);
    }
    const uniq = Array.from(new Set(want));
    if (!uniq.length) return;
    const rows = await getPointsByIds(uniq);
    for (const r of rows) {
      const id = norm(r.id);
      if (!id) continue;
      point.set(id, { lat: Number(r.lat), lon: Number(r.lon) });
      // If this is a 3-letter airport, also set the 'K' prefix key for convenience.
      if (id.length === 3) point.set(`K${id}`, { lat: Number(r.lat), lon: Number(r.lon) });
    }
  };

  const airwayCache = new Map<string, string[] | null>();
  const getAirwaySeq = async (awyId: string): Promise<string[] | null> => {
    const key = norm(awyId);
    if (airwayCache.has(key)) return airwayCache.get(key) ?? null;
    const s = await getAirwayString(key);
    const seq = s ? parseAirwayString(s) : null;
    airwayCache.set(key, seq && seq.length ? seq : null);
    return airwayCache.get(key) ?? null;
  };

  // Small per-request caches for procedure lookups
  const procFixCache = new Map<string, ProcedureFixPoint[]>();

  const getProcSeq = async (procFull: string): Promise<ProcedureFixPoint[] | null> => {
    const key = norm(procFull);
    if (procFixCache.has(key)) return procFixCache.get(key)!;
    const seq = await getProcedureFixes(key);
    const out = (seq ?? [])
      .map((x) => ({
        fix: norm(x.fix),
        lat: x.lat == null ? null : Number(x.lat),
        lon: x.lon == null ? null : Number(x.lon),
      }))
      .filter((x) => Boolean(x.fix));
    procFixCache.set(key, out);
    return out.length ? out : null;
  };

  const pickStarSequence = async (procName: string, anchorTok: string | null): Promise<ProcedureFixPoint[] | null> => {
    const candidates = await findProceduresByName(procName, 'STAR');
    if (!candidates.length) return null;

    const anchorKey = anchorTok ? norm(anchorTok) : null;
    if (anchorKey) await ensurePoints([anchorKey]);
    const anchor = anchorKey
      ? (point.get(anchorKey) ?? (altAirportId(anchorKey) ? point.get(altAirportId(anchorKey)!) : null))
      : null;

    // Prefer a candidate where the anchor token appears in the sequence (then start from that point).
    if (anchorTok) {
      for (const c of candidates) {
        const seq = await getProcSeq(c.proc);
        if (!seq) continue;
        const idx = seq.findIndex((x) => x.fix === norm(anchorTok));
        if (idx !== -1) return seq.slice(idx);
      }
    }

    // Otherwise choose the candidate whose sequence passes closest to the anchor coordinate.
    if (anchor) {
      let bestSeq: ProcedureFixPoint[] | null = null;
      let bestIdx = -1;
      let bestD = Number.POSITIVE_INFINITY;

      for (const c of candidates) {
        const seq = await getProcSeq(c.proc);
        if (!seq) continue;
        await ensurePoints(seq.map((x) => x.fix));
        const idx = nearestIndexOnSeq(seq, point, anchor);
        if (idx === -1) continue;
        const p = coordForProcPoint(seq[idx], point);
        if (!p) continue;
        const d = sq(p.lat - anchor.lat) + sq(p.lon - anchor.lon);
        if (d < bestD) {
          bestD = d;
          bestSeq = seq;
          bestIdx = idx;
        }
      }

      if (bestSeq) return bestIdx > 0 ? bestSeq.slice(bestIdx) : bestSeq;
    }

    // Fallback: first matching STAR
    const seq = await getProcSeq(candidates[0].proc);
    return seq ?? null;
  };

  const pickSidSequence = async (procName: string, transitionTok: string | null): Promise<{ seq: ProcedureFixPoint[]; consumeNext: boolean } | null> => {
    // SID full token is typically PROC.TRANS
    if (transitionTok) {
      const full = `${norm(procName)}.${norm(transitionTok)}`;
      const seq = await getProcSeq(full);
      if (seq) return { seq, consumeNext: true };
    }

    const candidates = await findProceduresByName(procName, 'SID');
    if (!candidates.length) return null;

    // If caller provided a transition token but full lookup failed, prefer a candidate with matching transition.
    if (transitionTok) {
      const t = norm(transitionTok);
      const match = candidates.find((c) => norm(c.transition ?? '') === t);
      if (match) {
        const seq = await getProcSeq(match.proc);
        if (seq) return { seq, consumeNext: false };
      }
    }

    const seq = await getProcSeq(candidates[0].proc);
    return seq ? { seq, consumeNext: false } : null;
  };

  const tokens = splitTokens(route);

  const out: OutFix[] = [];

  const pushProcPoint = async (item: ProcedureFixPoint) => {
    const label = norm(item.fix);
    if (!label) return;

    let lat = item.lat;
    let lon = item.lon;

    if (lat == null || lon == null) {
      if (!point.has(label)) await ensurePoints([label]);
      const fallback = point.get(label) ?? (altAirportId(label) ? point.get(altAirportId(label)!) : undefined);
      if (!fallback) {
        errors.push(`No fixes found for '${label}'`);
        return;
      }
      lat = fallback.lat;
      lon = fallback.lon;
    }

    out.push({ fix: label, lat: Number(lat), lon: Number(lon) });
  };

  const push = async (id: string) => {
    const key = norm(id);
    if (!key) return;
    if (!point.has(key)) await ensurePoints([key]);
    const p = point.get(key) ?? (altAirportId(key) ? point.get(altAirportId(key)!) : undefined);
    if (!p) {
      errors.push(`No fixes found for '${key}'`);
      return;
    }
    out.push({ fix: key, lat: p.lat, lon: p.lon });
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // Airway expansion
    if (isAirway(tok)) {
      const prevTok = tokens[i - 1];
      const nextTok = tokens[i + 1];
      const seq = await getAirwaySeq(tok);

      if (seq && prevTok && nextTok) {
        // Need coordinates for airway nodes and for the endpoints to compute nearest indices.
        await ensurePoints(seq);
        await ensurePoints([prevTok, nextTok]);

        const nextIsOnSeq = seq.indexOf(nextTok) !== -1;
        let a = seq.indexOf(prevTok);
        let b = seq.indexOf(nextTok);

        // Many route strings use airports at the ends (e.g. "DTW J34 CLE"). Airports
        // generally do not appear as nodes in airway sequences. When that happens, fall
        // back to the nearest airway node to the airport/fix coordinate.
        if (a === -1) {
          const p = point.get(norm(prevTok)) ?? (altAirportId(prevTok) ? point.get(altAirportId(prevTok)!) : undefined);
          if (p) a = nearestIndexOnSeq(seq, point, p);
        }
        if (b === -1) {
          const p = point.get(norm(nextTok)) ?? (altAirportId(nextTok) ? point.get(altAirportId(nextTok)!) : undefined);
          if (p) b = nearestIndexOnSeq(seq, point, p);
        }

        if (a !== -1 && b !== -1 && a !== b) {
          const slice = a < b ? seq.slice(a, b + 1) : seq.slice(b, a + 1).reverse();
          for (const f of slice) await push(f);
          // Only consume nextTok if it's on the airway (otherwise it is a fix/apt outside the airway)
          if (nextIsOnSeq) i += 1;
          continue;
        }
      }

      // If airway expansion fails, treat airway token as a normal fix (rare but harmless)
      await push(tok);
      continue;
    }

    // Explicit full procedure token (PROC.TRANS or TRANS.PROC)
    if (tok.includes('.')) {
      const seq = await getProcSeq(tok);
      if (seq) {
        for (const f of seq) await pushProcPoint(f);
        continue;
      }
    }

    // Procedure name token (e.g. PUCKY1 / ACCRA5)
    if (isProcName(tok)) {
      // 1) SID at start of route
      if (i === 0) {
        const nextTok = tokens[i + 1] ?? null;
        const picked = await pickSidSequence(tok, nextTok);
        if (picked?.seq?.length) {
          for (const f of picked.seq) await pushProcPoint(f);
          if (picked.consumeNext) i += 1;
          continue;
        }
      }

      // 2) STAR at end of route (prefer anchor from previous token)
      if (i === tokens.length - 1) {
        const prevTok = tokens[i - 1] ?? null;
        // If the user provided TRANS PROC, prefer that exact full token.
        if (prevTok) {
          const fullStar = `${norm(prevTok)}.${tok}`;
          const seqFull = await getProcSeq(fullStar);
          if (seqFull) {
            if (out.length && out[out.length - 1].fix === norm(prevTok)) out.pop();
            for (const f of seqFull) await pushProcPoint(f);
            continue;
          }
        }

        const seq = await pickStarSequence(tok, prevTok);
        if (seq?.length) {
          for (const f of seq) await pushProcPoint(f);
          continue;
        }

        // If we couldn't resolve the STAR as a procedure, do NOT treat the procedure name as a fix.
        // This most commonly happens for non-FAA procedures (e.g., Canadian STARs) when only NASR is loaded.
        errors.push(`Procedure '${tok}' not found in IDS procedure data.`);
        continue;
      }

      // 3) SID with explicit transition token next (PROC TRANS -> PROC.TRANS)
      const nextTok = tokens[i + 1];
      if (nextTok) {
        const fullSid = `${tok}.${nextTok}`;
        const seq = await getProcSeq(fullSid);
        if (seq) {
          for (const f of seq) await pushProcPoint(f);
          i += 1;
          continue;
        }
      }

      // 4) STAR with explicit transition token previous (TRANS PROC -> TRANS.PROC)
      const prevTok = tokens[i - 1];
      if (prevTok) {
        const fullStar = `${prevTok}.${tok}`;
        const seq = await getProcSeq(fullStar);
        if (seq) {
          if (out.length && out[out.length - 1].fix === norm(prevTok)) out.pop();
          for (const f of seq) await pushProcPoint(f);
          continue;
        }
      }
    }

    // Default: treat as a point
    await push(tok);
  }

  const res: RouteResponse = {
    route,
    fixes: out,
    errors: errors.length ? errors.slice(0, 40) : undefined,
  };

  return NextResponse.json(res);
}
