import { Router, Request, Response } from 'express';
import { verifyWebhookSignature, handleWebhook } from '../services/conekta';
import { WebhookEvent } from '../models/database';
import logger from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// POST /webhooks/conekta
//
// Design constraints:
//  • Raw body must be available for HMAC verification — mounted BEFORE
//    express.json() in index.ts using express.raw().
//  • Respond 200 as fast as possible; process asynchronously.
//  • Deduplicate via WebhookEvent.eventId unique constraint.
// ---------------------------------------------------------------------------

router.post('/conekta', async (req: Request, res: Response): Promise<void> => {
  // 1. Respond immediately — Conekta retries if it doesn't see 2xx quickly
  res.status(200).json({ received: true });

  // 2. Process asynchronously so we don't block the response
  processWebhook(req).catch((err) =>
    logger.error('Webhook processing error', { error: (err as Error).message }),
  );
});

async function processWebhook(req: Request): Promise<void> {
  const rawBody = req.body as Buffer;
  const signatureHeader = (req.headers['digest'] as string | undefined) ?? '';

  // Verify signature (throws on mismatch)
  try {
    verifyWebhookSignature(rawBody, signatureHeader);
  } catch (err) {
    logger.warn('Webhook signature verification failed', {
      reason: (err as Error).message,
      ip: req.ip,
    });
    return;
  }

  let event: { id: string; type: string; data: { object: { id: string } } };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    logger.warn('Webhook body is not valid JSON');
    return;
  }

  const { id: eventId, type: eventType } = event;

  if (!eventId || !eventType) {
    logger.warn('Webhook event missing id or type');
    return;
  }

  // Deduplicate — if eventId already recorded, skip
  const existing = await WebhookEvent.findOne({ where: { eventId } });
  if (existing) {
    logger.debug('Duplicate webhook event ignored', { eventId });
    return;
  }

  // Persist raw event for audit trail (payload scrubbed by logger, not here)
  await WebhookEvent.create({ eventId, eventType, payload: event });

  const result = await handleWebhook(event as Parameters<typeof handleWebhook>[0]);
  logger.info('Webhook handled', { eventId, eventType, result });
}

export default router;
