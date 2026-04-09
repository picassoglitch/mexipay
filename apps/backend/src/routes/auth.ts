import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Merchant } from '../models/database';
import { issueTokens, verifyRefreshToken } from '../middleware/auth';
import { verifyGoogleToken, verifyAppleToken } from '../services/oauth';
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

    // Reject OAuth-only accounts trying to use password login
    if (merchant && !merchant.passwordHash) {
      res.status(401).json({
        error: `This account was created with ${merchant.authProvider ?? 'social login'}. Please use that sign-in method.`,
      });
      return;
    }

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

// ---------------------------------------------------------------------------
// Shared OAuth find-or-create helper
// ---------------------------------------------------------------------------

interface OAuthParams {
  provider: 'google' | 'apple';
  providerId: string;
  email: string | undefined;
  name: string | undefined;
}

async function oauthFindOrCreate(
  params: OAuthParams,
): Promise<{ merchant: Merchant; isNew: boolean }> {
  const { provider, providerId, email, name } = params;

  // 1. Find by provider + sub (most reliable — doesn't break if email changes)
  let merchant = await Merchant.findOne({
    where: { authProvider: provider, oauthProviderId: providerId },
  });
  if (merchant) return { merchant, isNew: false };

  // 2. If provider didn't give us an email we can't create an account
  if (!email) {
    throw Object.assign(new Error('Email required to create account'), { statusCode: 422 });
  }

  // 3. Try to link to an existing local account with the same email
  const existing = await Merchant.findOne({ where: { email } });
  if (existing) {
    // Link the OAuth identity to the existing account
    await existing.update({ authProvider: provider, oauthProviderId: providerId });
    return { merchant: existing, isNew: false };
  }

  // 4. Create a brand-new merchant
  merchant = await Merchant.create({
    businessName: name ?? email,
    email,
    passwordHash: null,
    authProvider: provider,
    oauthProviderId: providerId,
  });

  logger.info('New merchant via OAuth', { provider, merchantId: merchant.id });
  return { merchant, isNew: true };
}

function oauthErrorResponse(err: unknown): { status: number; message: string } {
  if (err instanceof Error) {
    const code = (err as Error & { statusCode?: number }).statusCode;
    if (code) return { status: code, message: err.message };
    // Treat any verification error as 401
    if (
      err.message.includes('expired') ||
      err.message.includes('invalid') ||
      err.message.includes('audience') ||
      err.message.includes('issuer')
    ) {
      return { status: 401, message: 'Invalid or expired token' };
    }
  }
  return { status: 500, message: 'Internal server error' };
}

// ---------------------------------------------------------------------------
// POST /auth/google
// ---------------------------------------------------------------------------

const googleSchema = z.object({
  idToken: z.string().min(1),
});

router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }

  try {
    const profile = await verifyGoogleToken(parsed.data.idToken);
    const { merchant, isNew } = await oauthFindOrCreate({
      provider: 'google',
      providerId: profile.googleId,
      email: profile.email,
      name: profile.name,
    });

    const tokens = issueTokens(merchant.id);
    res.status(isNew ? 201 : 200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNew,
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        email: merchant.email,
      },
    });
  } catch (err) {
    const { status, message } = oauthErrorResponse(err);
    logger.warn('Google auth failed', { reason: (err as Error).message });
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/apple
// ---------------------------------------------------------------------------

const appleSchema = z.object({
  identityToken: z.string().min(1),
  /** Apple provides fullName only on the very first sign-in */
  fullName: z
    .object({
      givenName: z.string().nullable().optional(),
      familyName: z.string().nullable().optional(),
    })
    .optional(),
  /** Apple provides email only on the very first sign-in */
  email: z.string().email().optional(),
});

router.post('/apple', async (req: Request, res: Response): Promise<void> => {
  const parsed = appleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'identityToken is required' });
    return;
  }

  try {
    const profile = await verifyAppleToken(parsed.data.identityToken);

    // Apple only sends email/name on first auth — fall back to what the client sent
    const email = profile.email ?? parsed.data.email;
    const { givenName, familyName } = parsed.data.fullName ?? {};
    const name =
      [givenName, familyName].filter(Boolean).join(' ').trim() || email;

    const { merchant, isNew } = await oauthFindOrCreate({
      provider: 'apple',
      providerId: profile.appleId,
      email,
      name,
    });

    const tokens = issueTokens(merchant.id);
    res.status(isNew ? 201 : 200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNew,
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        email: merchant.email,
      },
    });
  } catch (err) {
    const { status, message } = oauthErrorResponse(err);
    logger.warn('Apple auth failed', { reason: (err as Error).message });
    res.status(status).json({ error: message });
  }
});

export default router;
