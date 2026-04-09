import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { Transaction } from '../models/database';

// ---------------------------------------------------------------------------
// Conekta API client
// ---------------------------------------------------------------------------

const CONEKTA_API_URL = process.env.CONEKTA_API_URL ?? 'https://api.conekta.io';
const CONEKTA_API_KEY = process.env.CONEKTA_API_KEY ?? '';
const CONEKTA_WEBHOOK_SECRET = process.env.CONEKTA_WEBHOOK_SECRET ?? '';

/** SPEI orders expire after 72 hours by default */
const DEFAULT_EXPIRY_HOURS = 72;

function createClient(): AxiosInstance {
  return axios.create({
    baseURL: CONEKTA_API_URL,
    headers: {
      Authorization: `Bearer ${CONEKTA_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.conekta-v2.1.0+json',
    },
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SPEICharge {
  conektaOrderId: string;
  /** CLABE the merchant's customer must wire to */
  clabe: string;
  reference: string;
  expiresAt: Date;
}

interface ConektaOrder {
  id: string;
  charges: {
    data: Array<{
      id: string;
      payment_method: {
        type: string;
        clabe?: string;
        reference?: string;
        expires_at?: number;
      };
    }>;
  };
}

interface ConektaWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      status?: string;
      charges?: {
        data: Array<{
          id: string;
          status: string;
          payment_method: {
            type: string;
          };
        }>;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// createSPEICharge
// ---------------------------------------------------------------------------

/**
 * Create a Conekta SPEI order and return the CLABE + reference the customer
 * should wire to.
 *
 * CLABE is returned but MUST NOT be logged by callers.
 */
export async function createSPEICharge(params: {
  amountCentavos: number;
  orderId: string;
  customerName: string;
  customerEmail: string;
  description: string;
}): Promise<SPEICharge> {
  const { amountCentavos, orderId, customerName, customerEmail, description } = params;

  const expiresAtUnix =
    Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_HOURS * 3600;

  const payload = {
    currency: 'MXN',
    metadata: { internal_order_id: orderId },
    customer_info: {
      name: customerName,
      email: customerEmail,
    },
    line_items: [
      {
        name: description,
        unit_price: amountCentavos,
        quantity: 1,
      },
    ],
    charges: [
      {
        payment_method: {
          type: 'spei',
          expires_at: expiresAtUnix,
        },
      },
    ],
  };

  logger.info('Creating Conekta SPEI order', {
    orderId,
    amountCentavos,
    description,
  });

  const client = createClient();
  const response = await client.post<ConektaOrder>('/orders', payload);
  const order = response.data;

  const charge = order.charges?.data?.[0];
  const pm = charge?.payment_method;

  if (!pm?.clabe || !pm?.reference) {
    logger.error('Conekta SPEI order missing CLABE/reference', {
      conektaOrderId: order.id,
    });
    throw new Error('Conekta did not return CLABE or reference for SPEI charge');
  }

  // Log success WITHOUT the CLABE (PII)
  logger.info('Conekta SPEI order created', {
    conektaOrderId: order.id,
    orderId,
  });

  return {
    conektaOrderId: order.id,
    clabe: pm.clabe,
    reference: pm.reference,
    expiresAt: new Date((pm.expires_at ?? expiresAtUnix) * 1000),
  };
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Conekta webhook request.
 *
 * Conekta computes: HMAC-SHA256(rawBody, webhookSecret) and sends it
 * base64-encoded in the `Digest` header as `sha256=<base64>`.
 *
 * Throws if the signature is invalid.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): void {
  if (!CONEKTA_WEBHOOK_SECRET) {
    logger.warn('CONEKTA_WEBHOOK_SECRET not set — skipping signature verification');
    return;
  }

  const expected = crypto
    .createHmac('sha256', CONEKTA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64');

  // Header format: "sha256=<base64>"
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new Error('Webhook signature mismatch');
  }
}

// ---------------------------------------------------------------------------
// handleWebhook
// ---------------------------------------------------------------------------

export type WebhookResult =
  | { action: 'paid'; conektaOrderId: string }
  | { action: 'expired'; conektaOrderId: string }
  | { action: 'ignored'; reason: string };

/**
 * Parse a verified Conekta webhook event and return a structured action.
 * Updates the Transaction record in the database accordingly.
 */
export async function handleWebhook(event: ConektaWebhookEvent): Promise<WebhookResult> {
  const { type, data } = event;
  const obj = data?.object;
  const conektaOrderId: string = obj?.id ?? '';

  logger.info('Processing Conekta webhook', { eventId: event.id, type, conektaOrderId });

  switch (type) {
    case 'order.paid': {
      const updated = await Transaction.update(
        { status: 'paid', paidAt: new Date() },
        { where: { conektaOrderId, status: 'pending' } },
      );
      if (updated[0] === 0) {
        logger.warn('No pending transaction found for paid order', { conektaOrderId });
      }
      return { action: 'paid', conektaOrderId };
    }

    case 'order.expired': {
      await Transaction.update(
        { status: 'expired' },
        { where: { conektaOrderId, status: 'pending' } },
      );
      return { action: 'expired', conektaOrderId };
    }

    default:
      return { action: 'ignored', reason: `unhandled event type: ${type}` };
  }
}
