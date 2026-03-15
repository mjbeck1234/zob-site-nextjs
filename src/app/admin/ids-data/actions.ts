'use server';

import fs from 'fs/promises';
import { revalidatePath } from 'next/cache';

import { requireSiteAdminOnly } from '@/lib/auth/admin';
import { upsertIdsDataset } from '@/lib/idsDataset';
import { resetIdsProcedures } from '@/lib/idsProcedures';
import { resetIdsCoreTables } from '@/lib/idsCoreData';
import { importSupplementalNavdata, type NavdataScope } from '@/lib/navdata/supplementalImport';
import { findNasrZipCandidates, downloadToTempFile, saveUploadToTempFile } from '@/lib/nasr/nasrFetch';
import { ingestNasrZipFromPath } from '@/lib/nasr/nasrImport';

export type RefreshResult = {
  ok: boolean;
  message: string;
  cycle?: string;
  stats?: Record<string, number>;
  fileName?: string;
};

function safeScope(v: any): NavdataScope {
  const s = String(v ?? '').trim();
  if (s === 'global' || s === 'north_america' || s === 'region') return s;
  return 'region';
}

async function ingestZipAtPath(zipPath: string, fileNameForCycle: string): Promise<RefreshResult> {
  // Stream-parse the NASR ZIP and upsert each dataset immediately to keep memory low.
  // Overwrite procedure tables each import (STARDP can be large; keep it normalized)
  // Overwrite core point/airway/PFR tables each import as well.
  try {
    await resetIdsCoreTables();
    await resetIdsProcedures();

    const { cycle, stats } = await ingestNasrZipFromPath(zipPath, async (dataset, data, cyc) => {
      await upsertIdsDataset({ dataset, cycle: cyc, data });
      // Encourage GC of large arrays
      (data as any[]).length = 0;
    });

    // Revalidate the admin page + IDS routes (if any are statically cached)
    revalidatePath('/admin/ids-data');
    revalidatePath('/ids');

    return {
      ok: true,
      message: `Imported NASR datasets (${cycle}).`,
      cycle,
      stats,
    };
  } finally {
    // Important on hosts where tmp dir is memory-backed: always delete the ZIP.
    try {
      await fs.unlink(zipPath);
    } catch {
      // ignore
    }
  }
}


export async function refreshNasrFromFaaAction(): Promise<RefreshResult> {
  await requireSiteAdminOnly();

  try {
    // Some FAA index pages contain stale filenames; try a few recent candidates.
    const candidates = await findNasrZipCandidates(8);

    let lastErr: any = null;
    for (const c of candidates) {
      try {
        const zipPath = await downloadToTempFile(c.url, c.fileName);
        const res = await ingestZipAtPath(zipPath, c.fileName);
        return { ...res, fileName: c.fileName };
      } catch (e: any) {
        lastErr = e;
        // Try the next candidate (often fixes 404 on the newest filename).
        continue;
      }
    }

    throw lastErr ?? new Error('Failed to refresh NASR datasets.');
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Failed to refresh NASR datasets.' };
  }
}

export async function uploadNasrZipAction(formData: FormData): Promise<RefreshResult> {
  await requireSiteAdminOnly();

  const f = formData.get('zip');
  if (!f || !(f instanceof File)) {
    return { ok: false, message: 'No ZIP file uploaded.' };
  }

  try {
    const zipPath = await saveUploadToTempFile(f);
    const res = await ingestZipAtPath(zipPath, f.name);
    return { ...res, fileName: f.name };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Failed to import uploaded ZIP.' };
  }
}

export async function uploadSupplementalNavdataAction(formData: FormData): Promise<RefreshResult> {
  await requireSiteAdminOnly();

  const scope = safeScope(formData.get('scope'));
  const airportsCsv = formData.get('airports_csv');
  const earthFix = formData.get('earth_fix');
  const earthNav = formData.get('earth_nav');

  const MAX_BYTES = 50 * 1024 * 1024; // 50MB
  const files: Array<[string, any]> = [
    ['airports_csv', airportsCsv],
    ['earth_fix', earthFix],
    ['earth_nav', earthNav],
  ];

  const hasAny = files.some(([, f]) => f && f instanceof File && f.size > 0);
  if (!hasAny) {
    return { ok: false, message: 'Choose at least one supplemental navdata file to import.' };
  }

  try {
    for (const [name, f] of files) {
      if (f && f instanceof File && f.size > MAX_BYTES) {
        return { ok: false, message: `${name} is too large (${Math.round(f.size / 1024 / 1024)}MB). Limit is 50MB.` };
      }
    }

    const [airportsCsvText, earthFixDatText, earthNavDatText] = await Promise.all([
      airportsCsv instanceof File ? airportsCsv.text() : Promise.resolve(null),
      earthFix instanceof File ? earthFix.text() : Promise.resolve(null),
      earthNav instanceof File ? earthNav.text() : Promise.resolve(null),
    ]);

    const { inserted } = await importSupplementalNavdata({
      scope,
      airportsCsvText,
      earthFixDatText,
      earthNavDatText,
    });

    revalidatePath('/admin/ids-data');
    revalidatePath('/ids');

    return {
      ok: true,
      message: `Imported supplemental navdata (${scope}).`,
      stats: inserted,
    };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Failed to import supplemental navdata.' };
  }
}
