import { Request, Response, NextFunction } from 'express';
import {
  claimIdempotencyKey,
  getIdempotencyRecord,
  releaseIdempotencyKey,
  setIdempotencyRecord,
} from '../utils/redis';
import logger from '../utils/logger';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Express middleware that enforces idempotency for mutating endpoints.
 *
 * Flow:
 *  1. If no Idempotency-Key header → pass through (no protection).
 *  2. Check Redis for an existing record with this key.
 *     - If PROCESSING → 409 so the client can retry/wait.
 *     - If a completed record exists → replay the cached response.
 *  3. Atomically claim the key (SET NX) before the handler runs.
 *  4. Wrap res.json() to persist the final response into Redis and release
 *     the PROCESSING lock.
 *  5. On handler error → release the key so the client can retry.
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers[IDEMPOTENCY_HEADER.toLowerCase()] as string | undefined;

  if (!key) {
    next();
    return;
  }

  // Kick off async flow; any thrown error goes to next(err)
  handleIdempotency(key, req, res, next).catch(next);
}

async function handleIdempotency(
  key: string,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const existing = await getIdempotencyRecord(key);

  if (existing === 'PROCESSING') {
    logger.debug('Idempotency key in flight', { key });
    res.status(409).json({ error: 'Request with this Idempotency-Key is already being processed' });
    return;
  }

  if (existing !== null) {
    logger.debug('Replaying cached idempotency response', { key });
    res.status(existing.statusCode).json(existing.body);
    return;
  }

  // Claim the key — if NX fails someone else got here first
  const claimed = await claimIdempotencyKey(key);
  if (!claimed) {
    res.status(409).json({ error: 'Request with this Idempotency-Key is already being processed' });
    return;
  }

  // Intercept res.json to persist the response
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    setIdempotencyRecord(key, { statusCode: res.statusCode, body }).catch((err) =>
      logger.error('Failed to persist idempotency record', { error: (err as Error).message }),
    );
    return originalJson(body);
  };

  // Release lock on unhandled errors in downstream handlers
  res.on('error', () => {
    releaseIdempotencyKey(key).catch(() => undefined);
  });

  next();
}
