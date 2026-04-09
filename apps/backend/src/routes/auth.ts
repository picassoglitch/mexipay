import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Merchant } from '../models/database';
import { issueTokens, verifyRefreshToken } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const merchant = await Merchant.findOne({ where: { email, isActive: true } });

    // Constant-time comparison even on not-found path
    const dummyHash = '$2b$10$invalidhashtopreventtimingattack1234567890123456789012';
    const hashToCheck = merchant?.passwordHash ?? dummyHash;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!merchant || !valid) {
      logger.warn('Failed login attempt', { email });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const tokens = issueTokens(merchant.id);
    logger.info('Merchant logged in', { merchantId: merchant.id });

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        email: merchant.email,
      },
    });
  } catch (err) {
    logger.error('Login error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  try {
    const merchantId = verifyRefreshToken(parsed.data.refreshToken);

    const merchant = await Merchant.findOne({ where: { id: merchantId, isActive: true } });
    if (!merchant) {
      res.status(401).json({ error: 'Merchant not found or inactive' });
      return;
    }

    const tokens = issueTokens(merchantId);
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    logger.warn('Token refresh failed', { reason: (err as Error).message });
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

export default router;
