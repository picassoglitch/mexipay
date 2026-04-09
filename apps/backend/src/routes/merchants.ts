import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Merchant } from '../models/database';
import { requireAuth, AuthenticatedRequest, issueTokens } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  businessName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a digit'),
});

// ---------------------------------------------------------------------------
// POST /merchants/register
// ---------------------------------------------------------------------------

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { businessName, email, password } = parsed.data;

  try {
    const existing = await Merchant.findOne({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const merchant = await Merchant.create({ businessName, email, passwordHash });
    const tokens = issueTokens(merchant.id);

    logger.info('Merchant registered', { merchantId: merchant.id });

    res.status(201).json({
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        email: merchant.email,
        createdAt: merchant.createdAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    logger.error('Registration error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /merchants/me
// ---------------------------------------------------------------------------

router.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { merchantId } = req as AuthenticatedRequest;

    try {
      const merchant = await Merchant.findByPk(merchantId, {
        attributes: ['id', 'businessName', 'email', 'isActive', 'createdAt'],
      });

      if (!merchant) {
        res.status(404).json({ error: 'Merchant not found' });
        return;
      }

      res.json({ merchant });
    } catch (err) {
      logger.error('Fetch merchant error', { error: (err as Error).message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
