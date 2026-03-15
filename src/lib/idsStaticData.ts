import 'server-only';

import path from 'path';
import { readdir, readFile, stat } from 'fs/promises';

import type { IdsDatasetKey } from '@/lib/idsDataset';
import { getIdsDataset } from '@/lib/idsDataset';

/**
 * Server-only helper to load IDS JSON datasets.
 *
 * Priority:
 *  1) Postgres (ids_datasets)
 *  2) Fallback to src/data/jsons
 *
 * Uses in-memory caches to avoid re-reading files / re-pulling large JSON blobs.
 */

type CacheEntry = { ts: number; value: any; mtimeMs?: number; bytes?: number; fullPath?: string };

const g = globalThis as any;
if (!g.__idsJsonCache) g.__idsJsonCache = new Map<string, CacheEntry>();
const cache: Map<string, CacheEntry> = g.__idsJsonCache;

export async function loadIdsJson<T = any>(relPathOrCycle: string | null, maybeDatasetKey?: string): Promise<T> {
  const relPathFromJsonRoot = maybeDatasetKey
    ? (maybeDatasetKey.endsWith('.json') ? maybeDatasetKey : `${maybeDatasetKey}.json`)
    : (relPathOrCycle ?? '');

  if (!relPathFromJsonRoot) {
    throw new Error('loadIdsJson: missing relative path');
  }

  const { rootDir, cycle } = await getIdsJsonRoot(maybeDatasetKey ? relPathOrCycle : null);

  // Some datasets live inside the newest cycle directory (e.g. 2512/apt.json),
  // but "static" datasets often live at the base jsons root (e.g. static/ids.routes.json).
  // So we try cycle-first, then fall back to the base root if needed.
  const candidates: string[] = [];
  candidates.push(path.join(rootDir, relPathFromJsonRoot));

  if (cycle) {
    const baseDir = path.dirname(rootDir);
    const fallback = path.join(baseDir, relPathFromJsonRoot);
    if (fallback !== candidates[0]) candidates.push(fallback);
  }

  // Fast path: unchanged file (check any cached candidate).
  for (const cand of candidates) {
    const key = `${cycle ?? 'root'}::${cand}`;
    const hit = cache.get(key);
    if (hit?.fullPath) {
      try {
        const st = await stat(hit.fullPath);
        if (hit.mtimeMs === st.mtimeMs && hit.bytes === st.size) return hit.value as T;
      } catch {
        // ignore and try reading again
      }
    }
  }

  let usedPath: string | null = null;
  let raw: string | null = null;
  let lastErr: any = null;

  for (const cand of candidates) {
    try {
      raw = await readFile(cand, 'utf8');
      usedPath = cand;
      break;
    } catch (err: any) {
      lastErr = err;
      if (err?.code === 'ENOENT') continue;
      throw err;
    }
  }

  if (!usedPath || raw == null) {
    const tried = candidates.join(', ');
    const msg = `IDS JSON missing: ${relPathFromJsonRoot}. Tried: ${tried}`;
    // Keep original error details for debugging if present.
    throw new Error(msg + (lastErr?.message ? ` :: ${lastErr.message}` : ''));
  }

  const parsed = JSON.parse(raw) as T;

  // Cache by the actual resolved path.
  const key = `${cycle ?? 'root'}::${usedPath}`;
  try {
    const st = await stat(usedPath);
    cache.set(key, { ts: Date.now(), value: parsed, mtimeMs: st.mtimeMs, bytes: st.size, fullPath: usedPath });
  } catch {
    cache.set(key, { ts: Date.now(), value: parsed, fullPath: usedPath });
  }

  return parsed;
}

/**
 * Clear IDS caches (useful after updating files on disk).
 */
export function clearIdsCaches() {
  cache.clear();
  rootInfoMemo.clear();
}

// Back-compat alias used by admin IDS tools.
export function clearIdsJsonCache() {
  clearIdsCaches();
}

export type IdsRootInfo = { rootDir: string; baseDir: string; cycle: string | null };

const ROOT_CACHE_MS = 60_000;
const rootInfoMemo = new Map<string, { ts: number; value: IdsRootInfo }>();

export async function getIdsJsonRoot(cycleOverride: string | null = null): Promise<IdsRootInfo> {
  const now = Date.now();
  const memoKey = cycleOverride ?? "__auto__";
  const memo = rootInfoMemo.get(memoKey);
  if (memo && now - memo.ts < ROOT_CACHE_MS) {
    return memo.value;
  }

  const baseDir = process.env.IDS_DATA_DIR
    ? path.resolve(process.env.IDS_DATA_DIR)
    : path.join(process.cwd(), "src", "data", "jsons");

  // If an override cycle is provided, prefer it if the directory exists.
  if (cycleOverride) {
    const overrideDir = path.join(baseDir, cycleOverride);
    try {
      const st = await stat(overrideDir);
      if (st.isDirectory()) {
        const info: IdsRootInfo = { rootDir: overrideDir, baseDir, cycle: cycleOverride };
        rootInfoMemo.set(memoKey, { ts: now, value: info });
        return info;
      }
    } catch {
      // ignore; fall through to auto-detect
    }
  }

  const cycleEnv = String(process.env.IDS_DATA_CYCLE ?? "").trim();
  const explicitCycle = cycleEnv ? cycleEnv : null;

  const resolved = await resolveCycleDir(baseDir, explicitCycle);
  rootInfoMemo.set(memoKey, { ts: now, value: resolved });
  return resolved;
}
async function resolveCycleDir(baseDir: string, explicitCycle: string | null): Promise<IdsRootInfo> {
  // If explicitly set, prefer it.
  if (explicitCycle) {
    const candidate = path.join(baseDir, explicitCycle);
    try {
      const st = await stat(candidate);
      if (st.isDirectory()) return { rootDir: candidate, baseDir, cycle: explicitCycle };
    } catch {
      // ignore and fall back
    }
  }

  // Auto-detect newest numeric folder (e.g. 2512).
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    const cycles = entries
      .filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => Number(b) - Number(a));
    if (cycles.length) {
      return { rootDir: path.join(baseDir, cycles[0]), baseDir, cycle: cycles[0] };
    }
  } catch {
    // ignore
  }

  return { rootDir: baseDir, baseDir, cycle: null };
}

const DATASET_FALLBACK_PATH: Record<IdsDatasetKey, string> = {
  apt: 'apt.json',
  nav: 'nav.json',
  fixes: 'fixes.json',
  awy: 'awy.json',
  sid: 'sid.json',
  star: 'star.json',
  faa: 'faa.json',
};


export async function getIdsCycleInfo(cycleOverride: string | null = null): Promise<IdsRootInfo> {
  return getIdsJsonRoot(cycleOverride);
}

export async function loadIdsDataset<T = any>(dataset: IdsDatasetKey): Promise<{ source: 'db' | 'file'; cycle: string | null; data: T }> {
  // DB is optional. If it's down/misconfigured, fall back to files.
  try {
    const row = await getIdsDataset(dataset);
    if (row) return { source: 'db', cycle: row.cycle, data: row.data as T };
  } catch {
    // ignore
  }

  const relPath = DATASET_FALLBACK_PATH[dataset];
  const data = await loadIdsJson<T>(relPath);
  return { source: 'file', cycle: (await getIdsJsonRoot()).cycle, data };
}

/**
 * Small TTL cache for live network fetches (VATSIM, vNAS, etc).
 */

export type LiveCacheMeta = { key: string; createdAt: number; expiresAt: number };

type LiveEntry = { createdAt: number; expiresAt: number; value: any };
if (!g.__idsLiveCache) g.__idsLiveCache = new Map<string, LiveEntry>();
const liveCache: Map<string, LiveEntry> = g.__idsLiveCache;

export function getLiveCacheMeta(key: string): LiveCacheMeta | null {
  const hit = liveCache.get(key);
  if (!hit) return null;
  return { key, createdAt: hit.createdAt, expiresAt: hit.expiresAt };
}

export async function withLiveCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = liveCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await fn();
  liveCache.set(key, { createdAt: now, expiresAt: now + ttlSeconds * 1000, value });
  return value;
}


export async function getIdsDataStatus(): Promise<Array<{ relPath: string; absPath: string; exists: boolean; sizeBytes: number; updatedAt: string | null }>> {
  const root = await getIdsJsonRoot();
  const rels = Object.values(DATASET_FALLBACK_PATH);
  const rows: Array<{ relPath: string; absPath: string; exists: boolean; sizeBytes: number; updatedAt: string | null }> = [];

  for (const relPath of rels) {
    const candidates = [path.join(root.rootDir, relPath)];
    const fallback = path.join(root.baseDir, relPath);
    if (fallback !== candidates[0]) candidates.push(fallback);

    let matched = false;
    for (const absPath of candidates) {
      try {
        const st = await stat(absPath);
        rows.push({
          relPath,
          absPath,
          exists: true,
          sizeBytes: Number(st.size || 0),
          updatedAt: st.mtime ? st.mtime.toISOString() : null,
        });
        matched = true;
        break;
      } catch {
        // try next candidate
      }
    }

    if (!matched) rows.push({ relPath, absPath: candidates[0], exists: false, sizeBytes: 0, updatedAt: null });
  }

  return rows;
}
