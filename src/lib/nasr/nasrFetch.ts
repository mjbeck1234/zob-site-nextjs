import 'server-only';

import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const NASR_INDEX = 'https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/';
// The actual ZIPs are hosted on NFDC. The FAA page links to cycle subpages, which then link to NFDC.
// Fetching the ZIP directly from NFDC is both simpler and avoids 404s from incorrectly-resolved FAA-relative URLs.
const NFDC_ZIP_BASE = 'https://nfdc.faa.gov/webContent/28DaySub/';

export type LatestNasrZip = { url: string; fileName: string };

export type NasrZipCandidate = LatestNasrZip & { date: string };

function decodeHtmlAttr(v: string): string {
  // Minimal decoding for href attributes.
  return v.replaceAll('&amp;', '&').trim();
}

function extractZipLinks(html: string): string[] {
  // Collect any direct NFDC ZIP links.
  const hrefs = Array.from(html.matchAll(/href\s*=\s*"([^"]+)"/gi)).map((m) => decodeHtmlAttr(String(m[1] ?? '')));
  const direct = hrefs.filter((h) => /nfdc\.faa\.gov\/webContent\/28DaySub\/.+\.zip$/i.test(h));

  // Some pages may include the URL in plain text.
  const inText = Array.from(html.matchAll(/https:\/\/nfdc\.faa\.gov\/webContent\/28DaySub\/.+?\.zip/gi)).map((m) => String(m[0] ?? ''));

  return uniqBy([...direct, ...inText].filter(Boolean).map((u) => ({ u })), (x) => x.u).map((x) => x.u);
}

function dateFromZipUrl(url: string): string | null {
  const m = url.match(/28DaySubscription_Effective_(\d{4}-\d{2}-\d{2})\.zip/i);
  return m?.[1] ?? null;
}

function uniqBy<T>(items: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/**
 * Returns a descending list of recent NASR 28-day ZIP candidates found on the FAA index page.
 * We prefer extracting the cycle dates from the FAA page, then constructing the canonical NFDC ZIP URL.
 * This is more reliable than trying to resolve whatever href the FAA CMS emits.
 */
export async function findNasrZipCandidates(limit = 10): Promise<NasrZipCandidate[]> {
  const res = await fetch(NASR_INDEX, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch FAA NASR index (${res.status})`);
  const html = await res.text();

  // Strategy:
  // 1) Prefer direct NFDC download links on the index page (archives list has them)
  // 2) Also follow the "Preview" and "Current" subpages and extract their Download links
  // 3) As a fallback, construct candidate URLs in both styles:
  //    - https://.../28DaySub/28DaySubscription_Effective_YYYY-MM-DD.zip
  //    - https://.../28DaySub/YYYY-MM-DD/28DaySubscription_Effective_YYYY-MM-DD.zip

  const urls: string[] = [];
  urls.push(...extractZipLinks(html));

  // Extract preview/current subpage dates and fetch those pages to get their direct Download URLs.
  const subpageDates = uniqBy(
    Array.from(html.matchAll(/NASR_Subscription\/(\d{4}-\d{2}-\d{2})\/?/gi)).map((m) => ({ d: String(m[1] ?? '').trim() })),
    (x) => x.d
  )
    .map((x) => x.d)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  for (const date of subpageDates.slice(0, 4)) {
    try {
      const pageUrl = new URL(`${date}/`, NASR_INDEX).toString();
      const r = await fetch(pageUrl, { cache: 'no-store' });
      if (!r.ok) continue;
      const subHtml = await r.text();
      urls.push(...extractZipLinks(subHtml));
    } catch {
      // ignore
    }
  }

  // If we still didn't find any zip URLs, synthesize candidates from dates.
  const datesFromZipNames = Array.from(html.matchAll(/28DaySubscription_Effective_(\d{4}-\d{2}-\d{2})\.zip/gi)).map(
    (m) => String(m[1] ?? '').trim()
  );

  const allDates = uniqBy([...subpageDates, ...datesFromZipNames].filter(Boolean).map((d) => ({ d })), (x) => x.d)
    .map((x) => x.d)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  for (const date of allDates) {
    const fileName = `28DaySubscription_Effective_${date}.zip`;
    urls.push(new URL(fileName, NFDC_ZIP_BASE).toString());
    urls.push(new URL(`${date}/${fileName}`, NFDC_ZIP_BASE).toString());
  }

  const candidates = uniqBy(urls.map((url) => {
    const d = dateFromZipUrl(url) ?? '0000-00-00';
    const fileName = path.basename(url);
    return { url, fileName, date: d } as NasrZipCandidate;
  }), (x) => x.url)
    .filter((c) => c.date !== '0000-00-00')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, Math.max(1, limit));

  if (!candidates.length) throw new Error('Could not find NASR download links on FAA pages.');
  return candidates;
}

export async function findLatestNasrZip(): Promise<LatestNasrZip> {
  const cands = await findNasrZipCandidates(1);
  const first = cands[0];
  return { url: first.url, fileName: first.fileName };
}

function ensureTmpDir(): string {
  // NOTE: Some hosts mount /tmp as tmpfs (RAM). The NASR ZIP can be large and
  // will OOM the process if written to a memory-backed filesystem.
  // Allow overriding the temp directory to a disk-backed path.
  // Examples:
  //   NASR_TMP_DIR=/var/tmp
  //   NASR_TMP_DIR=./.nasr-cache
  const base = (process.env.NASR_TMP_DIR ?? '').trim() || os.tmpdir();
  const baseAbs = path.isAbsolute(base) ? base : path.join(process.cwd(), base);
  const dir = path.join(baseAbs, 'zob-ids-nasr');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function downloadToTempFile(url: string, fileName: string): Promise<string> {
  const dir = ensureTmpDir();
  const outPath = path.join(dir, fileName);

  const res = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      // Some CDNs behave better when a realistic UA is present.
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      accept: 'application/zip,application/octet-stream,*/*',
    },
  });
  if (!res.ok) throw new Error(`Failed to download ZIP (${res.status}) from ${url}`);
  if (!res.body) throw new Error('No response body while downloading ZIP');

  const nodeStream = Readable.fromWeb(res.body as any);
  await pipeline(nodeStream, fs.createWriteStream(outPath));

  return outPath;
}

export async function saveUploadToTempFile(file: File): Promise<string> {
  const dir = ensureTmpDir();
  const outPath = path.join(dir, file.name);

  const stream = (file as any).stream?.();
  if (stream) {
    const nodeStream = Readable.fromWeb(stream);
    await pipeline(nodeStream, fs.createWriteStream(outPath));
  } else {
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(outPath, buf);
  }

  return outPath;
}
