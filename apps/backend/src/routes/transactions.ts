import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { Op } from 'sequelize';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { Transaction, Merchant } from '../models/database';
import { calculateFee } from '../services/fees';
import { createSPEICharge } from '../services/conekta';
import logger from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// Encryption helpers for CLABE at rest
// ---------------------------------------------------------------------------

const ENCRYPTION_KEY_HEX = process.env.CLABE_ENCRYPTION_KEY ?? '';

function encryptCLABE(clabe: string): string {
  if (!ENCRYPTION_KEY_HEX) {
    // In dev, store as-is but warn
    logger.warn('CLABE_ENCRYPTION_KEY not set — storing CLABE unencrypted (dev only)');
    return clabe;
  }
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clabe, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptCLABE(stored: string): string {
  if (!ENCRYPTION_KEY_HEX) return stored;
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createTxSchema = z.object({
  amountCentavos: z.number().int().min(100, 'Minimum amount is $1.00 MXN'),
  description: z.string().min(1).max(200).optional().default('Pago MexiPay'),
  customerName: z.string().min(1).max(100).optional().default('Cliente'),
  customerEmail: z.string().email().optional().default('cliente@mexipay.mx'),
});

// ---------------------------------------------------------------------------
// POST /transactions/create
// ---------------------------------------------------------------------------

router.post(
  '/create',
  requireAuth,
  idempotency,
  async (req: Request, res: Response): Promise<void> => {
    const { merchantId } = req as AuthenticatedRequest;

    const parsed = createTxSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { amountCentavos, description, customerName, customerEmail } = parsed.data;

    try {
      const fee = calculateFee(amountCentavos);

      // Internal order ID for Conekta metadata
      const internalOrderId = crypto.randomUUID();

      // Create SPEI charge via Conekta (idempotency ensures this runs at most once)
      const spei = await createSPEICharge({
        amountCentavos,
        orderId: internalOrderId,
        customerName,
        customerEmail,
        description,
      });

      // Store CLABE encrypted at rest
      const clabeEncrypted = encryptCLABE(spei.clabe);

      const transaction = await Transaction.create({
        merchantId,
        conektaOrderId: spei.conektaOrderId,
        reference: spei.reference,
        clabeEncrypted,
        amountCentavos,
        feeCentavos: fee.feeCentavos,
        status: 'pending',
        expiresAt: spei.expiresAt,
      });

      logger.info('Transaction created', {
        transactionId: transaction.id,
        merchantId,
        amountCentavos,
        conektaOrderId: spei.conektaOrderId,
      });

      // Return CLABE in response (TLS-protected) — do NOT log
      res.status(201).json({
        transaction: {
          id: transaction.id,
          status: transaction.status,
          amountCentavos: transaction.amountCentavos,
          feeCentavos: transaction.feeCentavos,
          netCentavos: fee.netCentavos,
          feePercent: fee.feePercent,
          reference: transaction.reference,
          clabe: spei.clabe,
          expiresAt: transaction.expiresAt,
          createdAt: transaction.createdAt,
        },
      });
    } catch (err) {
      logger.error('Create transaction error', { error: (err as Error).message, merchantId });
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /transactions
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['pending', 'paid', 'expired', 'failed']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { merchantId } = req as AuthenticatedRequest;

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
      return;
    }

    const { page, limit, status, date } = parsed.data;
    const offset = (page - 1) * limit;

    try {
      const where: Record<string, unknown> = { merchantId };
      if (status) where['status'] = status;
      if (date) {
        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(`${date}T23:59:59.999Z`);
        where['createdAt'] = { [Op.between]: [start, end] };
      }

      const { count, rows } = await Transaction.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        attributes: [
          'id',
          'status',
          'amountCentavos',
          'feeCentavos',
          'reference',
          'paidAt',
          'expiresAt',
          'createdAt',
        ],
      });

      // Fetch merchant for context
      const merchant = await Merchant.findByPk(merchantId, {
        attributes: ['id', 'businessName'],
      });

      res.json({
        data: rows,
        meta: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit),
          merchant,
        },
      });
    } catch (err) {
      logger.error('List transactions error', { error: (err as Error).message, merchantId });
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /transactions/:id
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { merchantId } = req as AuthenticatedRequest;
    const { id } = req.params;

    try {
      const transaction = await Transaction.findOne({
        where: { id, merchantId },
        attributes: [
          'id',
          'status',
          'amountCentavos',
          'feeCentavos',
          'reference',
          'clabeEncrypted',
          'paidAt',
          'expiresAt',
          'createdAt',
          'updatedAt',
        ],
      });

      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      // Decrypt CLABE for the owner only (returned over TLS, never logged)
      const clabe = decryptCLABE(transaction.clabeEncrypted);

      res.json({
        transaction: {
          id: transaction.id,
          status: transaction.status,
          amountCentavos: transaction.amountCentavos,
          feeCentavos: transaction.feeCentavos,
          netCentavos: transaction.amountCentavos - transaction.feeCentavos,
          reference: transaction.reference,
          clabe,
          paidAt: transaction.paidAt,
          expiresAt: transaction.expiresAt,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
        },
      });
    } catch (err) {
      logger.error('Get transaction error', { error: (err as Error).message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
