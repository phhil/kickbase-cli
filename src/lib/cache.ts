import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const CACHE_DIR = join(homedir(), '.config', 'kickbase-cli', 'cache');

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export const TTL = {
  STATIC: 24 * 60 * 60 * 1000,      // 24h: competitions, event types, config
  SEMI_STATIC: 60 * 60 * 1000,      // 1h: player profiles, team data, news
  DYNAMIC: 5 * 60 * 1000,           // 5min: market, rankings, squad
} as const;

let cacheEnabled = true;

export function disableCache(): void {
  cacheEnabled = false;
}

function cacheKeyPath(key: string): string {
  const hash = createHash('md5').update(key).digest('hex');
  return join(CACHE_DIR, `${hash}.json`);
}

export function getCached<T>(key: string): T | null {
  if (!cacheEnabled) return null;
  const path = cacheKeyPath(key);
  if (!existsSync(path)) return null;
  try {
    const entry: CacheEntry = JSON.parse(readFileSync(path, 'utf8'));
    if (Date.now() - entry.timestamp > entry.ttl) return null;
    return entry.data as T;
  } catch {
    return null;
  }
}

export function setCache(key: string, data: any, ttl: number): void {
  if (!cacheEnabled) return;
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const entry: CacheEntry = { data, timestamp: Date.now(), ttl };
  writeFileSync(cacheKeyPath(key), JSON.stringify(entry));
}

export function clearCache(): number {
  if (!existsSync(CACHE_DIR)) return 0;
  let count = 0;
  for (const f of readdirSync(CACHE_DIR)) {
    if (f.endsWith('.json')) {
      unlinkSync(join(CACHE_DIR, f));
      count++;
    }
  }
  return count;
}
