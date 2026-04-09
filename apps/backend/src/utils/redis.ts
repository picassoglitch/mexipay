import Redis from 'ioredis';
import logger from './logger';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/** TTL for idempotency keys (24 hours) */
const IDEMPOTENCY_TTL_SECONDS = 86_400;

export interface IdempotencyRecord {
  statusCode: number;
  body: unknown;
}

/**
 * Return an existing cached response for this key, or null if this is a
 * first-time request.  A "PROCESSING" sentinel is written atomically via SET NX
 * so that concurrent duplicate requests see it and should retry/wait.
 */
export async function getIdempotencyRecord(
  key: string,
): Promise<IdempotencyRecord | 'PROCESSING' | null> {
  const raw = await redis.get(idempotencyRedisKey(key));
  if (!raw) return null;
  if (raw === 'PROCESSING') return 'PROCESSING';
  try {
    return JSON.parse(raw) as IdempotencyRecord;
  } catch {
    return null;
  }
}

/**
 * Atomically claim an idempotency key.  Returns true if this process now owns
 * it, false if another process already claimed it.
 */
export async function claimIdempotencyKey(key: string): Promise<boolean> {
  const result = await redis.set(
    idempotencyRedisKey(key),
    'PROCESSING',
    'EX',
    IDEMPOTENCY_TTL_SECONDS,
    'NX',
  );
  return result === 'OK';
}

/**
 * Store the final response so future duplicate requests can get it back.
 */
export async function setIdempotencyRecord(
  key: string,
  record: IdempotencyRecord,
): Promise<void> {
  await redis.set(
    idempotencyRedisKey(key),
    JSON.stringify(record),
    'EX',
    IDEMPOTENCY_TTL_SECONDS,
  );
}

/**
 * Remove a claimed key (call on failure so the client can retry).
 */
export async function releaseIdempotencyKey(key: string): Promise<void> {
  await redis.del(idempotencyRedisKey(key));
}

function idempotencyRedisKey(key: string): string {
  return `idempotency:${key}`;
}
