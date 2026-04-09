import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

export interface AuthenticatedRequest extends Request {
  merchantId: string;
}

/**
 * Verify Bearer JWT and attach merchantId to the request.
 * Responds 401 on any failure — never leaks token details in logs.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    if (typeof payload.sub !== 'string' || !payload.sub) {
      res.status(401).json({ error: 'Invalid token subject' });
      return;
    }

    if (payload.type !== 'access') {
      res.status(401).json({ error: 'Wrong token type' });
      return;
    }

    (req as AuthenticatedRequest).merchantId = payload.sub;
    next();
  } catch (err) {
    // Log only the error type/message, never the raw token
    const message = err instanceof Error ? err.message : 'unknown';
    logger.warn('JWT verification failed', { reason: message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------------------------------------------------------------------------
// Token factory helpers (used by auth route)
// ---------------------------------------------------------------------------

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function issueTokens(merchantId: string): TokenPair {
  const accessToken = jwt.sign(
    { sub: merchantId, type: 'access' },
    JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m' },
  );

  const refreshToken = jwt.sign(
    { sub: merchantId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d' },
  );

  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): string {
  const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  if (payload.type !== 'refresh' || typeof payload.sub !== 'string') {
    throw new Error('Invalid refresh token');
  }
  return payload.sub;
}
