import { normalizeAirportCode, toFaaIdent, toIcaoCode, ZOB_TOWERED_FIELDS } from "@/lib/dtpp/zobFields";

type ProcEntry = {
  pdfUrl: string;
  pdfName: string;
  title: string;
};

type AirportProcCache = {
  cycle: string;
  fetchedAt: number;
  entries: ProcEntry[];
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

declare global {
  // eslint-disable-next-line no-var
  var __dtppCycleCache: { cycle: string; fetchedAt: number } | undefined;
  // eslint-disable-next-line no-var
  var __dtppAirportCache: Record<string, AirportProcCache> | undefined;
}

function now() {
  return Date.now();
}

function getAirportCacheStore(): Record<string, AirportProcCache> {
  if (!globalThis.__dtppAirportCache) globalThis.__dtppAirportCache = {};
  return globalThis.__dtppAirportCache;
}

export function buildFaaDtppResultsUrl(cycle: string, faaIdent: string): string {
  const c = encodeURIComponent(cycle);
  const ident = encodeURIComponent(faaIdent);
  // This is the FAA d-TPP results page for the airport (fallback when we can't resolve a specific PDF).
  return `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/results/?cycle=${c}&ident=${ident}`;
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ac.signal,
      // Avoid Next fetch caching surprises for always-fresh cycle changes
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

export async function getCurrentDtppCycle(): Promise<string> {
  const env = (process.env.AERONAV_DTPP_CYCLE || process.env.DTPP_CYCLE || "").trim();
  if (env) return env;

  const cached = globalThis.__dtppCycleCache;
  if (cached && now() - cached.fetchedAt < CACHE_TTL_MS) return cached.cycle;

  // Scrape the FAA d-TPP results landing page to find the current edition link.
  // The HTML contains a link like: https://aeronav.faa.gov/d-tpp/2602/xml_data/d-TPP_Metafile.xml
  const landing = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/results/";
  const res = await fetchWithTimeout(landing, 12000);
  if (!res.ok) throw new Error(`Failed to fetch FAA d-TPP landing page: ${res.status}`);
  const html = await res.text();

  // Prefer the metafile XML link because it always contains the cycle number.
  const m = html.match(/https:\/\/aeronav\.faa\.gov\/d-tpp\/(\d{4})\/xml_data\/d-TPP_Metafile\.xml/i);
  const cycle = m?.[1];
  if (!cycle) {
    // Fallback: any /d-tpp/####/ occurrence
    const m2 = html.match(/\/d-tpp\/(\d{4})\//i);
    if (!m2?.[1]) throw new Error("Could not detect current d-TPP cycle.");
    globalThis.__dtppCycleCache = { cycle: m2[1], fetchedAt: now() };
    return m2[1];
  }

  globalThis.__dtppCycleCache = { cycle, fetchedAt: now() };
  return cycle;
}

function normalizeProcQuery(proc: string): string {
  return String(proc || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function stripRunwayOrSuffix(s: string): string {
  // Keep it simple: PDFs are like 00084GTLKE.PDF. Procedures usually include words like "FOUR (RNAV)".
  // We'll match by the PDF basename (letters) instead.
  return s.replace(/\(.*?\)/g, "").trim();
}

function procKeyCandidates(proc: string): string[] {
  const p = stripRunwayOrSuffix(normalizeProcQuery(proc));
  const tokens = p.split(/\s+/).filter(Boolean);
  const first = (tokens[0] || "").replace(/[^A-Z0-9]/g, "");
  const firstNoDigits = first.replace(/\d+$/g, "");
  const out = new Set<string>();
  if (first) out.add(first);
  if (firstNoDigits) out.add(firstNoDigits);
  // Also consider a pure letters version
  if (firstNoDigits) out.add(firstNoDigits.replace(/[^A-Z]/g, ""));
  return Array.from(out);
}

function parseAirportResultsForPdfs(html: string, cycle: string): ProcEntry[] {
  // Pull out all direct PDF links for this cycle.
  // Example link in HTML: https://aeronav.faa.gov/d-tpp/2602/00084GTLKE.PDF
  const re = new RegExp(`https:\\/\\/aeronav\\.faa\\.gov\\/d-tpp\\/${cycle}\\/[^\"\']+\\.PDF`, "gi");
  const urls = html.match(re) ?? [];

  // Also attempt to capture nearby chart titles.
  // We'll do a loose approach: find all anchor tags with a PDF href and use the text content as title.
  const anchorRe = new RegExp(
    `<a[^>]+href=["'](https:\\/\\/aeronav\\.faa\\.gov\\/d-tpp\\/${cycle}\\/([^"']+\\.PDF))["'][^>]*>([^<]{1,200})<\\/a>`,
    "gi"
  );

  const byUrl: Record<string, { pdfName: string; title: string }> = {};
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const url = m[1];
    const pdfName = m[2];
    const title = (m[3] || "").trim();
    if (!byUrl[url]) byUrl[url] = { pdfName, title };
  }

  const out: ProcEntry[] = [];
  for (const u of urls) {
    const pdfName = byUrl[u]?.pdfName ?? u.split("/").pop() ?? "";
    const title = byUrl[u]?.title ?? pdfName;
    out.push({ pdfUrl: u, pdfName, title });
  }
  // De-dupe
  const seen = new Set<string>();
  return out.filter((e) => {
    if (!e.pdfUrl) return false;
    if (seen.has(e.pdfUrl)) return false;
    seen.add(e.pdfUrl);
    return true;
  });
}

async function getAirportProcEntries(cycle: string, faaIdent: string): Promise<ProcEntry[]> {
  const store = getAirportCacheStore();
  const key = `${cycle}:${faaIdent}`;

  const cached = store[key];
  if (cached && now() - cached.fetchedAt < CACHE_TTL_MS) return cached.entries;

  const url = buildFaaDtppResultsUrl(cycle, faaIdent);
  const res = await fetchWithTimeout(url, 12000);
  if (!res.ok) throw new Error(`FAA d-TPP results fetch failed: ${res.status}`);
  const html = await res.text();
  const entries = parseAirportResultsForPdfs(html, cycle);

  store[key] = { cycle, fetchedAt: now(), entries };
  return entries;
}

function pdfBaseFromName(pdfName: string): string {
  // 00084GTLKE.PDF -> GTLKE
  return String(pdfName || "")
    .toUpperCase()
    .replace(/\.PDF$/i, "")
    .replace(/^\d+/, "")
    .replace(/[^A-Z0-9]/g, "");
}

export type ResolveChartResult = {
  ok: boolean;
  cycle: string | null;
  url: string;
  kind: "pdf" | "faa";
  airport: { input: string; icao: string; faa: string };
  proc: { input: string; candidates: string[] };
};

export async function resolveChartLink(opts: {
  airport: string;
  proc: string;
}): Promise<ResolveChartResult> {
  const airportInput = normalizeAirportCode(opts.airport);
  const icao = toIcaoCode(airportInput);
  const faa = toFaaIdent(airportInput);
  const procInput = String(opts.proc || "");
  const procCandidates = procKeyCandidates(procInput);

  let cycle: string | null = null;
  try {
    cycle = await getCurrentDtppCycle();
  } catch {
    // If we can't detect cycle, we can still fall back to FAA page without cycle.
    cycle = null;
  }

  const fallbackUrl = cycle ? buildFaaDtppResultsUrl(cycle, faa) : `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/`;

  // Only allow direct PDFs for the ZOB towered fields list.
  if (!ZOB_TOWERED_FIELDS.has(icao)) {
    return {
      ok: true,
      cycle,
      url: fallbackUrl,
      kind: "faa",
      airport: { input: airportInput, icao, faa },
      proc: { input: procInput, candidates: procCandidates },
    };
  }

  if (!cycle) {
    return {
      ok: true,
      cycle,
      url: fallbackUrl,
      kind: "faa",
      airport: { input: airportInput, icao, faa },
      proc: { input: procInput, candidates: procCandidates },
    };
  }

  try {
    const entries = await getAirportProcEntries(cycle, faa);

    // Find best match by comparing candidate tokens to the PDF basename and/or the anchor title.
    let best: ProcEntry | null = null;
    let bestScore = -1;
    for (const e of entries) {
      const base = pdfBaseFromName(e.pdfName);
      const title = String(e.title || "").toUpperCase();
      for (const c of procCandidates) {
        const cc = c.toUpperCase();
        let score = 0;
        if (base === cc) score += 100;
        if (title.includes(cc)) score += 40;
        if (base.includes(cc) || cc.includes(base)) score += 25;
        if (score > bestScore) {
          bestScore = score;
          best = e;
        }
      }
    }

    if (best && bestScore >= 40) {
      return {
        ok: true,
        cycle,
        url: best.pdfUrl,
        kind: "pdf",
        airport: { input: airportInput, icao, faa },
        proc: { input: procInput, candidates: procCandidates },
      };
    }

    return {
      ok: true,
      cycle,
      url: fallbackUrl,
      kind: "faa",
      airport: { input: airportInput, icao, faa },
      proc: { input: procInput, candidates: procCandidates },
    };
  } catch {
    return {
      ok: true,
      cycle,
      url: fallbackUrl,
      kind: "faa",
      airport: { input: airportInput, icao, faa },
      proc: { input: procInput, candidates: procCandidates },
    };
  }
}
