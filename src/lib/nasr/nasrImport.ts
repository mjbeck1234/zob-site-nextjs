import 'server-only';

import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import { createInterface } from 'readline';

import type { IdsDatasetKey } from '@/lib/idsDataset';
import { insertProcedures, insertProcedureFixes, insertProcedureAirports, type ProcType } from '@/lib/idsProcedures';
import { insertAirports, insertAirways, insertFixes, insertNav, insertPfrRoutes } from '@/lib/idsCoreData';

export type NasrImportResult = {
  cycle: string;
  stats: Record<string, number>;
};

function inferCycleFromFileName(fileName: string): string {
  // e.g. 28DaySubscription_Effective_2025-12-25.zip -> 2512
  const m = fileName.match(/Effective_(\d{4})-(\d{2})-(\d{2})/i);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    return String(year).slice(-2) + String(month).padStart(2, '0');
  }
  return 'unknown';
}

function dmsToDecimal(dms: string): number {
  // Supports: 34-36-21.290N, 087-16-24.750W, 51-53-00.8980N, 176-38-32.9360W
  const m = dms.match(/^(\d{2,3})-(\d{2})-(\d{2})(?:\.(\d+))?([NSEW])$/);
  if (!m) throw new Error(`Bad DMS: ${dms}`);
  const deg = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(`${m[3]}.${m[4] ?? '0'}`);
  let val = deg + min / 60 + sec / 3600;
  const hemi = m[5];
  if (hemi === 'S' || hemi === 'W') val *= -1;
  return val;
}

const DMS_LAT = /\d{2}-\d{2}-\d{2}\.\d+[NS]/;
const DMS_LON = /\d{3}-\d{2}-\d{2}\.\d+[EW]/;
const DMS_PAIR = new RegExp(`(${DMS_LAT.source})\\s*(${DMS_LON.source})`);

function compactStardpToDecimal(coord: string): number {
  const raw = String(coord ?? '').trim().toUpperCase();
  const hemi = raw[0];
  const digits = raw.slice(1);
  const isLat = hemi === 'N' || hemi === 'S';
  const degLen = isLat ? 2 : 3;

  if (!/^[NSEW]\d+$/.test(raw)) {
    throw new Error(`Bad compact STARDP coord: ${coord}`);
  }

  const minStart = degLen;
  const secStart = degLen + 2;
  const secDigits = digits.slice(secStart);

  if (digits.length < degLen + 5 || digits.length > degLen + 6 || secDigits.length < 3) {
    throw new Error(`Bad compact STARDP coord: ${coord}`);
  }

  const deg = Number(digits.slice(0, degLen));
  const min = Number(digits.slice(minStart, secStart));
  const secWhole = Number(secDigits.slice(0, 2));
  const secFracRaw = secDigits.slice(2);
  const secFrac = secFracRaw ? Number(`0.${secFracRaw}`) : 0;

  let val = deg + min / 60 + (secWhole + secFrac) / 3600;
  if (hemi === 'S' || hemi === 'W') val *= -1;
  return val;
}

async function parseByLines(
  stream: NodeJS.ReadableStream,
  onLine: (line: string) => void | Promise<void>
): Promise<void> {
  // FAA files are traditionally latin1. Keeping it as latin1 avoids breaking odd characters.
  (stream as any).setEncoding?.('latin1');
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    await onLine(line);
  }
}

async function parseFixTxtToDb(stream: NodeJS.ReadableStream): Promise<number> {
  let n = 0;
  let batch: Array<{ fix_id: string; lat: number; lon: number }> = [];

  const flush = async () => {
    if (!batch.length) return;
    await insertFixes(batch);
    batch = [];
  };

  await parseByLines(stream, async (line) => {
    if (!line.startsWith('FIX1')) return;
    const fixId = line.slice(4, 34).trim().split(/\s+/)[0];
    const m = line.match(DMS_PAIR);
    if (!fixId || !m) return;
    const lat = dmsToDecimal(m[1]);
    const lon = dmsToDecimal(m[2]);
    batch.push({ fix_id: String(fixId).trim().toUpperCase(), lat, lon });
    n++;
    // Smaller batches reduce peak memory and avoid oversized SQL packets on small hosts.
    if (batch.length >= 500) await flush();
  });

  await flush();
  return n;
}

async function parseNavTxtToDb(stream: NodeJS.ReadableStream): Promise<number> {
  let n = 0;
  let batch: Array<{ nav_id: string; name: string | null; lat: number; lon: number }> = [];

  const flush = async () => {
    if (!batch.length) return;
    await insertNav(batch);
    batch = [];
  };

  await parseByLines(stream, async (line) => {
    if (!line.startsWith('NAV1')) return;

    // NAV1 has a 4-char facility ident starting at column 5 (1-based).
    // Most are 3 chars, but some are 4 (especially outside CONUS / special facilities).
    const navId = line.slice(4, 8).trim();
    if (!navId) return;

    // NAV1 stores latitude/longitude as formatted DMS *and* "all-seconds" fields.
    // The formatted LAT and formatted LON are NOT adjacent in the record (LAT seconds sits between),
    // so we must match them independently (DMS_PAIR will fail on NAV1).
    const latMatch = line.match(DMS_LAT);
    const lonMatch = line.match(DMS_LON);
    if (!latMatch || !lonMatch) return;

    // Name sits immediately after the "MM/DD/YYYY" field in NAV1
    let name = '';
    const dateIdx = line.search(/\d{2}\/\d{2}\/\d{4}/);
    if (dateIdx !== -1) {
      const afterDate = dateIdx + 10;
      name = line.slice(afterDate, afterDate + 30).trim();
    }

    const lat = dmsToDecimal(latMatch[0]);
    const lon = dmsToDecimal(lonMatch[0]);

    batch.push({
      nav_id: navId.toUpperCase(),
      lat,
      lon,
      name: name || null,
    });
    n++;
    // Smaller batches reduce peak memory and avoid oversized SQL packets on small hosts.
    if (batch.length >= 500) await flush();
  });

  await flush();
  return n;
}


async function parseAptTxtToDb(stream: NodeJS.ReadableStream): Promise<number> {
  // Streaming implementation to keep memory low.
  // APT5 begins a new airport record. Runway lines (RWY5) that follow contain coordinates.
  // We average all runway coordinates we see for that airport.

  const airportIdRe = /AIRPORT\s+([A-Z0-9]{2,4})\s+\d{2}\/\d{2}\/\d{4}/;
  const latRe = new RegExp(DMS_LAT.source, 'g');
  const lonRe = new RegExp(DMS_LON.source, 'g');
  let inserted = 0;

  let currentAirport: string | null = null;
  let latSum = 0;
  let lonSum = 0;
  let count = 0;

  let batch: Array<{ arpt_id: string; lat: number; lon: number }> = [];

  const flushBatch = async () => {
    if (!batch.length) return;
    await insertAirports(batch);
    inserted += batch.length;
    batch = [];
  };

  const flushAirport = async () => {
    if (!currentAirport) return;
    const arpt = currentAirport.toUpperCase();
    if (!count) {
      currentAirport = null;
      latSum = 0;
      lonSum = 0;
      count = 0;
      return;
    }

    batch.push({ arpt_id: arpt, lat: latSum / count, lon: lonSum / count });
    if (batch.length >= 2000) await flushBatch();

    currentAirport = null;
    latSum = 0;
    lonSum = 0;
    count = 0;
  };

  await parseByLines(stream, async (line) => {
    if (line.startsWith('APT5')) {
      await flushAirport();
      const m = line.match(airportIdRe);
      currentAirport = m?.[1]?.trim() || null;
      // Reset sums for the new airport
      latSum = 0;
      lonSum = 0;
      count = 0;
      return;
    }

    if (!currentAirport) return;
    if (!line.startsWith('RWY5')) return;

    const lats = line.match(latRe) ?? [];
    const lons = line.match(lonRe) ?? [];
    const n = Math.min(lats.length, lons.length);
    if (n === 0) return;

    for (let i = 0; i < n; i++) {
      try {
        const lat = dmsToDecimal(lats[i]);
        const lon = dmsToDecimal(lons[i]);
        latSum += lat;
        lonSum += lon;
        count += 1;
      } catch {
        // ignore bad coordinate tokens
      }
    }
  });

  await flushAirport();
  await flushBatch();
  return inserted;
}

async function parseAwyTxtToDb(stream: NodeJS.ReadableStream): Promise<number> {
  // Stream the file and write each airway as we finish it.
  // The AWY2 records are typically grouped by airway id.

  let currentAwy: string | null = null;
  let tokens: string[] = [];

  let batch: Array<{ awy_id: string; airway_string: string }> = [];
  let inserted = 0;

  const flushBatch = async () => {
    if (!batch.length) return;
    await insertAirways(batch);
    inserted += batch.length;
    batch = [];
  };

  const flushAwy = async () => {
    if (!currentAwy || !tokens.length) {
      currentAwy = null;
      tokens = [];
      return;
    }
    batch.push({ awy_id: currentAwy.toUpperCase(), airway_string: tokens.join('..') });
    if (batch.length >= 2000) await flushBatch();
    currentAwy = null;
    tokens = [];
  };

  await parseByLines(stream, async (line) => {
    if (!line.startsWith('AWY2')) return;

    const mAwy = line.slice(4).match(/^([A-Z0-9]{1,6})/);
    const awyId = mAwy?.[1]?.trim();
    if (!awyId) return;

    const mTok = line.match(/\*([A-Z0-9]{1,10})\*/);
    const tok = mTok?.[1]?.trim();
    if (!tok) return;

    if (currentAwy && awyId !== currentAwy) {
      await flushAwy();
    }

    if (!currentAwy) currentAwy = awyId;

    if (tokens[tokens.length - 1] !== tok) tokens.push(tok);
  });

  await flushAwy();
  await flushBatch();
  return inserted;
}

async function parsePfrTxtToDb(stream: NodeJS.ReadableStream): Promise<number> {
  let n = 0;
  let outBatch: Array<{ origin: string; dest: string; route_string: string; route_type: string | null; area: string | null }> = [];

  let cur: { origin: string; dest: string; tokens: string[] } | null = null;

  async function flush() {
    if (!cur) return;
    const mid = cur.tokens.filter(Boolean).join(' ');
    const route = [cur.origin, mid, cur.dest].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    outBatch.push({
      origin: cur.origin.toUpperCase().replace(/^K/, ''),
      dest: cur.dest.toUpperCase().replace(/^K/, ''),
      route_string: route,
      route_type: null,
      area: null,
    });
    n++;
    // Keep this conservative; PFR can be huge.
    if (outBatch.length >= 250) {
      const tmp = outBatch;
      outBatch = [];
      // Prefer flush in bulk to keep query overhead low.
      // (This is the big dataset; keeping it out of JS memory is the goal.)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      await insertPfrRoutes(tmp);
    }
    cur = null;
  }

  await parseByLines(stream, async (line) => {
    if (line.startsWith('PFR1')) {
      await flush();
      const origin = line.slice(4, 7).trim();
      const dest = line.slice(9, 12).trim();
      if (!origin || !dest) return;
      cur = { origin, dest, tokens: [] };
      return;
    }

    if (!cur) return;
    if (!line.startsWith('PFR2')) return;

    // Most PFR2 lines include a sequence number + token: 1005FJC, 3310V39, 1010T299, 1010LAAYK
    const mTok = line.match(/\b\d{4}([A-Z0-9]{2,10})\b/);
    if (!mTok) return;
    const tok = mTok[1].trim();
    if (!tok) return;
    cur.tokens.push(tok);
  });

  await flush();
  if (outBatch.length) await insertPfrRoutes(outBatch);
  return n;
}

async function ingestStardpTxtToDb(
  stream: NodeJS.ReadableStream
): Promise<{ sidProcs: string[]; starProcs: string[]; sidCount: number; starCount: number; fixCount: number; airportCount: number }> {
  // STARDP format differs:
  //  - SID records are prefixed with 'D' and are typically PROC.TRANS (e.g. ACCRA5.ACCRA)
  //  - STAR records are prefixed with 'S' and are typically TRANS.PROC (e.g. PUCKY.PUCKY1)
  // This implementation is intentionally streaming to keep memory low.

  const procRe = /([A-Z0-9]{2,10}\.[A-Z0-9]{2,10})/;
  const coordRe = /([NS]\d{7,8})([EW]\d{8,9})/;
  const fixRe = /([NS]\d{7,8})([EW]\d{8,9})\s*([A-Z0-9]{3,6})?/;
  const aptRe = /N\d{7,8}W\d{8,9}([A-Z0-9]{3,4})\s*$/;

  const seenProc = new Set<string>();
  const sidProcSet = new Set<string>();
  const starProcSet = new Set<string>();

  let currentProc: string | null = null;
  let currentOrd = 0;
  let lastPointKey: string | null = null;

  let procBatch: Array<{ proc: string; proc_type: ProcType; proc_name: string; transition: string | null }> = [];
  let fixBatch: Array<{ proc: string; ord: number; fix: string; lat: number; lon: number }> = [];
  let aptBatch: Array<{ proc: string; airport: string }> = [];

  let fixCount = 0;
  let airportCount = 0;

  const flush = async () => {
    if (procBatch.length) {
      await insertProcedures(procBatch);
      procBatch = [];
    }
    if (fixBatch.length) {
      await insertProcedureFixes(fixBatch);
      fixBatch = [];
    }
    if (aptBatch.length) {
      await insertProcedureAirports(aptBatch);
      aptBatch = [];
    }
  };

  await parseByLines(stream, async (line) => {
    const first = line[0];
    if (first !== 'D' && first !== 'S') return;

    const procFull = line.match(procRe)?.[1]?.toUpperCase();
    if (!procFull) return;

    // If the file is grouped by procedure (typical), this avoids keeping per-proc maps.
    if (currentProc !== procFull) {
      currentProc = procFull;
      currentOrd = 0;
      lastPointKey = null;
    }

    const procType: ProcType = first === 'D' ? 'SID' : 'STAR';
    const parts = procFull.split('.');
    const left = (parts[0] ?? '').toUpperCase();
    const right = (parts[1] ?? '').toUpperCase();

    const procName = procType === 'SID' ? left : right;
    const transition = procType === 'SID' ? right : left;

    if (!seenProc.has(procFull)) {
      seenProc.add(procFull);
      procBatch.push({
        proc: procFull,
        proc_type: procType,
        proc_name: procName,
        transition: transition || null,
      });
    }

    if (procType === 'SID') sidProcSet.add(procName);
    else starProcSet.add(procName);

    // Airports served (AA record)
    if (line[10] === 'A' && line[11] === 'A') {
      const apt = line.match(aptRe)?.[1]?.toUpperCase();
      if (apt) {
        aptBatch.push({ proc: procFull, airport: apt });
        airportCount++;
      }
      if (procBatch.length >= 400 || aptBatch.length >= 1500) await flush();
      return;
    }

    // Procedure path points. STARDP includes both named fixes and anonymous terminal points;
    // keep the raw coordinates so the map can continue all the way through the procedure.
    const coord = line.match(coordRe);
    if (!coord) {
      if (procBatch.length >= 400) await flush();
      return;
    }

    const lat = compactStardpToDecimal(coord[1]);
    const lon = compactStardpToDecimal(coord[2]);
    const namedFix = line.match(fixRe)?.[3]?.toUpperCase() || null;
    const pointKey = namedFix
      ? `FIX:${namedFix}`
      : `COORD:${coord[1]}:${coord[2]}`;

    if (lastPointKey === pointKey) return; // cheap consecutive dedupe (within a proc block)

    currentOrd += 1;
    lastPointKey = pointKey;

    const fix = namedFix || `PT${String(currentOrd).padStart(2, '0')}`;

    fixBatch.push({ proc: procFull, ord: currentOrd, fix, lat, lon });
    fixCount++;

    if (procBatch.length >= 400 || fixBatch.length >= 2500 || aptBatch.length >= 1500) {
      await flush();
    }
  });

  await flush();

  return {
    sidProcs: Array.from(sidProcSet).sort(),
    starProcs: Array.from(starProcSet).sort(),
    sidCount: sidProcSet.size,
    starCount: starProcSet.size,
    fixCount,
    airportCount,
  };
}


export async function ingestNasrZipFromPath(
  zipPath: string,
  onDataset: (dataset: IdsDatasetKey, data: any[], cycle: string) => Promise<void> | void,
): Promise<{ cycle: string; stats: Record<string, number> }> {
  if (!fs.existsSync(zipPath)) throw new Error(`ZIP not found at ${zipPath}`);

  const cycle = inferCycleFromFileName(path.basename(zipPath));
  const stats: Record<string, number> = {};

  // Some NASR zips vary casing and/or include files in subfolders.
  // Normalize to the base filename uppercased
  const targets = new Set(['APT.TXT', 'NAV.TXT', 'FIX.TXT', 'AWY.TXT', 'PFR.TXT', 'STARDP.TXT']);

  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: any, zipfile: any) => {
      if (err || !zipfile) return reject(err);

      const next = () => zipfile.readEntry();
      zipfile.readEntry();

      zipfile.on('entry', (entry: any) => {
        const base = path.posix.basename(entry.fileName);
        const key = base.toUpperCase();
        if (!targets.has(key)) return next();

        zipfile.openReadStream(entry, async (err2: any, stream: any) => {
          if (err2 || !stream) {
            zipfile.close();
            return reject(err2);
          }

          try {
            if (key === 'FIX.TXT') {
              const n = await parseFixTxtToDb(stream);
              stats.fixes = n;
              // Keep ids_datasets metadata updated without storing the huge array.
              await onDataset('fixes', [], cycle);
            } else if (key === 'NAV.TXT') {
              const n = await parseNavTxtToDb(stream);
              stats.nav = n;
              await onDataset('nav', [], cycle);
            } else if (key === 'APT.TXT') {
              const n = await parseAptTxtToDb(stream);
              stats.apt = n;
              await onDataset('apt', [], cycle);
            } else if (key === 'AWY.TXT') {
              const n = await parseAwyTxtToDb(stream);
              stats.awy = n;
              await onDataset('awy', [], cycle);
            } else if (key === 'PFR.TXT') {
              const n = await parsePfrTxtToDb(stream);
              stats.faa = n;
              await onDataset('faa', [], cycle);
            } else if (key === 'STARDP.TXT') {
              const res = await ingestStardpTxtToDb(stream);

              // Store just the list of procedure names (not the huge fix sequences) as the SID/STAR datasets.
              // The actual fix sequences live in ids_procedures / ids_procedure_fixes.
              stats.sid = res.sidCount;
              stats.star = res.starCount;
              stats.stardp_fixes = res.fixCount;
              stats.stardp_airports = res.airportCount;

              await onDataset('sid', res.sidProcs as any[], cycle);
              await onDataset('star', res.starProcs as any[], cycle);
            }
          } catch (e) {
            zipfile.close();
            return reject(e);
          } finally {
            next();
          }
        });
      });

      zipfile.on('end', () => {
        zipfile.close();
        resolve();
      });

      zipfile.on('error', (e: any) => {
        zipfile.close();
        reject(e);
      });
    });
  });

  return { cycle, stats };
}
