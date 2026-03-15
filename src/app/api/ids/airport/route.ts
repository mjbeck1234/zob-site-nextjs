import { NextResponse } from "next/server";
import { bestAirportCodeMatch, preferShortAirportCode } from "@/lib/ids/airportCode";
import { getIdsCycleInfo, loadIdsJson, withLiveCache } from "@/lib/idsStaticData";
import { ZOB_TOWERED_FIELDS, toIcaoCode } from "@/lib/dtpp/zobFields";
import { findProceduresByAirport } from "@/lib/idsProcedures";

type ProcedureLink = {
  name: string;
  url: string;
};

function sidDisplayFromRow(r: any): string {
  const raw = String(r?.sid_name ?? r?.name ?? "").trim();
  if (!raw) return "SID";
  const parts = raw.split(".");
  // IDS SID rows commonly encode "<procedure>.<transition/exit>".
  // Display the *procedure* (e.g., "GTLKE4"), not the transition fix (e.g., "DORET").
  return String(parts[0] ?? raw).trim() || raw;
}

function starDisplayFromRow(r: any): string {
  const raw = String(r?.star_name ?? r?.name ?? "").trim();
  if (!raw) return "STAR";
  const parts = raw.split(".");
  // IDS STAR rows commonly encode "<transition>.<procedure>".
  // Display the *procedure* (e.g., "BLAID2"), not the transition fix (e.g., "AALAN").
  return String(parts[1] ?? parts[0] ?? raw).trim() || raw;
}

type AirportQuickLookResponse = {
  ok: boolean;
  error?: string;
  cycle: string | null;
  query: {
    input: string;
    faa?: string;
    icao?: string;
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
    source: "faa_tpp" | "ids_json";
  };
};

function toNum(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

async function fetchMetarRaw(icao: string): Promise<{ raw?: string; fetchedAtIso: string; source: string } | null> {
  const up = String(icao || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(up)) return null;

  return withLiveCache(`metar:${up}`, 60, async () => {
    const url = `https://tgftp.nws.noaa.gov/data/observations/metar/stations/${up}.TXT`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3500);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        // Caching headers are best-effort; TGFTP is plain text.
        headers: { "User-Agent": "zob-ids-airport-quicklook" },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const text = (await res.text()).trim();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      // Format is usually:
      // 2026/02/06 22:51
      // KCLE 062251Z ...
      const raw = lines.length >= 2 ? lines[1] : lines[0];
      return {
        raw,
        fetchedAtIso: new Date().toISOString(),
        source: "NOAA TGFTP",
      };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  });
}

async function getCurrentTppCycle(): Promise<string | null> {
  return withLiveCache("tpp:cycle", 6 * 60 * 60, async () => {
    // FAA d-TPP page includes a link to the current edition metafile:
    // https://aeronav.faa.gov/d-tpp/2601/xml_data/d-tpp_Metafile.xml
    const url = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/";
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    try {
      const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
      if (!res.ok) return null;
      const html = await res.text();
      const m = html.match(/\/d-tpp\/(\d{4})\/xml_data\/d-tpp_Metafile\.xml/i);
      return m?.[1] ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  });
}

function uniqByName(list: ProcedureLink[]): ProcedureLink[] {
  const seen = new Set<string>();
  const out: ProcedureLink[] = [];
  for (const it of list) {
    const k = it.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

const NUM_WORD_TO_DIGIT: Record<string, string> = {
  ONE: "1",
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
  SIX: "6",
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  TEN: "10",
};

function procCodeFromTppLabel(labelHtml: string): string | null {
  const text = decodeBasicHtmlEntities(stripHtmlTags(labelHtml || ""));
  if (!text) return null;
  const upper = text.toUpperCase();

  // Skip continuation pages; we only list the primary chart entry.
  if (/\bCONT\b/.test(upper)) return null;

  // NOTE: The FAA search UI isn't consistent about where the procedure code appears in the link text.
  // In many cases it's "GTLKE FOUR" (good), but sometimes the transition/fix is shown first
  // (e.g. "DORET TRANSITION GTLKE FOUR"), which would incorrectly return the fix name.
  //
  // Heuristic: scan tokens and return the first *procedure-looking* token:
  //   1) Exact code token that already ends in digits (BLAID2, GTLKE4)
  //   2) A base token followed immediately by a number word/digits (GTLKE FOUR -> GTLKE4)

  const rawParts = upper.split(/\s+/).filter(Boolean);
  if (rawParts.length === 0) return null;

  const STOP = new Set([
    "DP",
    "SID",
    "STAR",
    "ODP",
    "APD",
    "MIN",
    "IAP",
    "CONT",
    "CONTINUED",
    "TRANS",
    "TRANSITION",
    "GATE",
    "RNAV",
    "GPS",
    "VOR",
    "NDB",
    "ILS",
    "RNP",
  ]);

  // First pass: already formatted codes like GTLKE4
  for (const p of rawParts) {
    const tok = p.replace(/[^A-Z0-9]/g, "");
    if (!tok || STOP.has(tok)) continue;
    if (/^[A-Z]{3,10}\d{1,2}$/.test(tok)) return tok;
  }

  // Second pass: base + number word (GTLKE FOUR) or base + digits (GTLKE 4)
  for (let i = 0; i < rawParts.length - 1; i++) {
    const base = rawParts[i].replace(/[^A-Z0-9]/g, "");
    const next = rawParts[i + 1].replace(/[^A-Z0-9]/g, "");
    if (!base || STOP.has(base)) continue;
    if (!/^[A-Z]{3,10}$/.test(base)) continue;

    let suffix = "";
    if (/^\d{1,2}$/.test(next)) suffix = next;
    else if (NUM_WORD_TO_DIGIT[next]) suffix = NUM_WORD_TO_DIGIT[next];
    if (!suffix) continue;

    const full = base.endsWith(suffix) ? base : `${base}${suffix}`;
    if (STOP.has(full)) continue;
    return full;
  }

  return null;
}

function procDisplayFromCode(code: string): string {
  const upper = String(code || '').trim().toUpperCase();
  const m = upper.match(/^([A-Z]{3,})(\d{1,2})$/);
  if (!m) return upper;
  const base = m[1];
  const num = m[2];
  // For long city-style procedure names (PITTSBURGH 5, BUFFALO 8), add a space for readability.
  if (base.length > 5) return `${base} ${num}`;
  return upper;
}

async function fetchTppProcedures(ident: string): Promise<{ tppCycle: string | null; searchUrl: string; sids: ProcedureLink[]; stars: ProcedureLink[] } | null> {
  const id = String(ident || "").trim().toUpperCase();
  if (!id) return null;

  const tppCycle = await getCurrentTppCycle();
  // If we couldn't discover the current cycle, we can still try the results page without a cycle param.
  const base = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/results/";
  const searchUrl = tppCycle
    ? `${base}?cycle=${encodeURIComponent(tppCycle)}&ident=${encodeURIComponent(id)}`
    : `${base}?ident=${encodeURIComponent(id)}`;

  return withLiveCache(`tpp:results:${tppCycle ?? "none"}:${id}`, 30 * 60, async () => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    try {
      const res = await fetch(searchUrl, { signal: ac.signal, cache: "no-store" });
      if (!res.ok) return null;
      const html = await res.text();

      const sids: ProcedureLink[] = [];
      const stars: ProcedureLink[] = [];

      // First attempt: parse by table rows with an explicit DP/STAR type cell (reduces false positives).
      const trRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
      let tr: RegExpExecArray | null;
      while ((tr = trRe.exec(html))) {
        const row = tr[0];
        const typeMatch = row.match(/<td[^>]*>\s*(DP|STAR)\s*<\/td>/i);
        if (!typeMatch) continue;
        const type = (typeMatch[1] || "").toUpperCase();

        const linkRe = /href="(https:\/\/aeronav\.faa\.gov\/d-tpp\/[^\"]+?\.pdf[^\"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        let a: RegExpExecArray | null;
        while ((a = linkRe.exec(row))) {
          const url = a[1];
          const labelHtml = a[2] || "";
          const code = procCodeFromTppLabel(labelHtml);
          if (!code || !url) continue;
          if (/_C\d*\.pdf/i.test(url)) continue; // skip continuation pages
          if (type === "DP") sids.push({ name: procDisplayFromCode(code), url });
          else if (type === "STAR") stars.push({ name: procDisplayFromCode(code), url });
          break; // first good link in this row
        }
      }

      // Fallback: tolerant scan if the strict row parse yielded nothing.
      if (sids.length === 0 && stars.length === 0) {
        const re = /\b(MIN|IAP|DP|STAR|APD)\b[\s\S]{0,200}?href="(https:\/\/aeronav\.faa\.gov\/d-tpp\/[^\"]+?\.pdf[^\"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html))) {
          const type = (m[1] || "").toUpperCase();
          const url = m[2];
          const labelHtml = m[3] || "";
          const code = procCodeFromTppLabel(labelHtml);
          if (!code || !url) continue;
          if (/_C\d*\.pdf/i.test(url)) continue;
          if (type === "DP") sids.push({ name: procDisplayFromCode(code), url });
          else if (type === "STAR") stars.push({ name: procDisplayFromCode(code), url });
        }
      }


      return {
        tppCycle,
        searchUrl,
        sids: uniqByName(sids),
        stars: uniqByName(stars),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  });
}

function asArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function pickAirportRow(rows: any[], ...codes: Array<string | undefined>): any | undefined {
  const wanted = new Set(codes.filter(Boolean).map((s) => String(s).trim().toUpperCase()));
  if (!wanted.size) return undefined;
  return rows.find((r) => wanted.has(String(r?.ARPT_ID ?? '').trim().toUpperCase()));
}

function procedureLinksFromDbRows(rows: Array<{ proc_name?: string | null }>, url: string): ProcedureLink[] {
  return uniqByName(
    rows
      .map((r) => String(r?.proc_name ?? '').trim().toUpperCase())
      .filter(Boolean)
      .map((name) => ({ name, url }))
  );
}

function tokenizeServedAirports(v: any): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/\s+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const input = (searchParams.get("code") ?? "").trim();

  const idsCycle = process.env.IDS_DATA_CYCLE ?? null;
  let cycleInfo: any = null;
  try {
    cycleInfo = await getIdsCycleInfo(idsCycle);
  } catch (e) {
    console.warn("IDS cycle info not found; continuing without it", e);
    cycleInfo = { cycle: idsCycle };
  }

  if (!input) {
    const out: AirportQuickLookResponse = {
      ok: false,
      error: "Missing code parameter.",
      cycle: cycleInfo?.cycle ?? idsCycle ?? "unknown",
      query: { input: "" },
      procedures: { sids: [], stars: [], source: "ids_json" },
    };
    return NextResponse.json(out, { status: 400 });
  }

  const match = bestAirportCodeMatch(input);
  const preferred = preferShortAirportCode(match.input);

  // Load airport coordinates from IDS jsons.
  const apt = await loadIdsJson<any[]>(idsCycle, "apt");

  const faaCode = match.faa?.toUpperCase();
  const icaoCode = match.icao?.toUpperCase();

  // bestAirportCodeMatch already gives us the useful FAA/ICAO candidates for IDS lookups.
  // Do not try to derive airport metadata from faa.json here; that dataset stores preferred routes, not airport code crosswalks.
  const finalIcao = icaoCode;
  const finalFaa = faaCode;

  const aptRows = asArray<any>(apt);
  const aptRow = pickAirportRow(aptRows, finalFaa, finalIcao, preferred);

  const airport = {
    icao: finalIcao,
    faa: finalFaa,
    lat: toNum(aptRow?.LAT_DECIMAL),
    lon: toNum(aptRow?.LONG_DECIMAL),
  };

  // METAR (best-effort)
  const metar = finalIcao ? await fetchMetarRaw(finalIcao) : null;

  // FAA d-TPP procedure list (best-effort). Prefer FAA 3-letter ident for US airports; otherwise ICAO.
  const tppIdent = (finalFaa && /^[A-Z0-9]{3}$/.test(finalFaa) ? finalFaa : finalIcao) ?? preferred;
  const tpp = await fetchTppProcedures(tppIdent);

  // Fallback: prefer live/imported DB procedures, then fall back to IDS sid/star json files.
  let fallbackSids: ProcedureLink[] = [];
  let fallbackStars: ProcedureLink[] = [];

  const airportTokens = Array.from(
    new Set([finalFaa, finalIcao, preferred].filter(Boolean).map((s) => String(s).trim().toUpperCase()))
  );

  try {
    const dbSidRows = (
      await Promise.all(airportTokens.map((code) => findProceduresByAirport(code, "SID")))
    ).flat();
    const dbStarRows = (
      await Promise.all(airportTokens.map((code) => findProceduresByAirport(code, "STAR")))
    ).flat();

    fallbackSids = procedureLinksFromDbRows(dbSidRows, tpp?.searchUrl ?? "");
    fallbackStars = procedureLinksFromDbRows(dbStarRows, tpp?.searchUrl ?? "");
  } catch {
    // ignore DB fallback errors; we'll try file-backed IDS json next
  }

  if (fallbackSids.length === 0 || fallbackStars.length === 0) {
    try {
      const sid = await loadIdsJson<any[]>(idsCycle, "sid");
      const star = await loadIdsJson<any[]>(idsCycle, "star");

      const servedTokens = new Set(airportTokens);

      const fileSids = asArray<any>(sid)
        .filter((r) => {
          const served = tokenizeServedAirports(r?.served_arpt);
          return served.some((s) => servedTokens.has(s));
        })
        .map((r) => ({
          name: sidDisplayFromRow(r),
          url: tpp?.searchUrl ?? "",
        }));

      const fileStars = asArray<any>(star)
        .filter((r) => {
          const served = tokenizeServedAirports(r?.served_arpt);
          return served.some((s) => servedTokens.has(s));
        })
        .map((r) => ({
          name: starDisplayFromRow(r),
          url: tpp?.searchUrl ?? "",
        }));

      if (fallbackSids.length === 0) fallbackSids = uniqByName(fileSids);
      if (fallbackStars.length === 0) fallbackStars = uniqByName(fileStars);
    } catch {
      // ignore
    }
  }


  // For the IDS Airport Quick Look we want the *actual procedure codes* (e.g., GTLKE4, KKIDS1, BLAID2)
  // and let the click handler resolve the correct Aeronav PDF dynamically for the current cycle.
  // If the FAA dTPP scrape yields results, prefer those over IDS-only lists.
  const effectiveIcao = finalIcao ?? (finalFaa ? toIcaoCode(finalFaa) : null);
  const isZobTowered = !!effectiveIcao && ZOB_TOWERED_FIELDS.has(effectiveIcao);

  const tppSids = tpp
    ? uniqByName(
        tpp.sids.map((p) => ({
          name: p.name,
          url: isZobTowered ? p.url : (tpp.searchUrl || p.url),
        }))
      )
    : [];

  const tppStars = tpp
    ? uniqByName(
        tpp.stars.map((p) => ({
          name: p.name,
          url: isZobTowered ? p.url : (tpp.searchUrl || p.url),
        }))
      )
    : [];

  const useTppProcedures = !!tpp && (tppSids.length > 0 || tppStars.length > 0);

  const procedures = {
    tppCycle: tpp?.tppCycle ?? undefined,
    searchUrl: tpp?.searchUrl,
    sids: useTppProcedures ? tppSids : fallbackSids,
    stars: useTppProcedures ? tppStars : fallbackStars,
    source: useTppProcedures ? ("faa_tpp" as const) : ("ids_json" as const),
  };

  const out: AirportQuickLookResponse = {
    ok: true,
    cycle: cycleInfo?.cycle ?? idsCycle ?? "unknown",
    query: {
      input,
      faa: finalFaa,
      icao: finalIcao,
    },
    airport,
    metar: metar ?? undefined,
    procedures,
  };

    return NextResponse.json(out);
  } catch (err: any) {
    // IMPORTANT: Always return JSON so the client never fails with
    // "Unexpected end of JSON input" when it does response.json().
    const message = err?.message ? String(err.message) : String(err);
    console.error("/api/ids/airport error", err);
    let q = "";
    try {
      q = (new URL(req.url).searchParams.get("code") ?? "").trim();
    } catch {
      // ignore
    }
    const idsCycle = process.env.IDS_DATA_CYCLE ?? null;
    return NextResponse.json(
      {
        ok: false,
        error: message,
        cycle: idsCycle ?? "unknown",
        query: { input: q },
      },
      { status: 500 },
    );
  }
}