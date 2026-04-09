/**
 * OAuth token verification for Google and Apple sign-in.
 *
 * Flow (mobile-first):
 *   1. Mobile app calls the platform SDK and receives an ID token / identity token.
 *   2. Mobile POSTs that token to /auth/google or /auth/apple.
 *   3. Backend verifies the token with the provider's public keys.
 *   4. We find-or-create a Merchant and issue our own JWT pair.
 *
 * No server-side redirects — all OAuth is handled on the device.
 */

import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

const GOOGLE_CLIENT_IDS = [
  process.env.GOOGLE_CLIENT_ID_WEB,
  process.env.GOOGLE_CLIENT_ID_IOS,
  process.env.GOOGLE_CLIENT_ID_ANDROID,
].filter(Boolean) as string[];

// Reuse the client instance across requests
const googleClient = new OAuth2Client();

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/**
 * Verify a Google ID token and return the user's profile.
 * Throws if the token is invalid, expired, or for the wrong audience.
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  if (GOOGLE_CLIENT_IDS.length === 0) {
    throw new Error('No GOOGLE_CLIENT_ID_* environment variables configured');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_IDS,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Google token payload missing required fields');
  }

  logger.debug('Google token verified', { googleId: payload.sub });

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    emailVerified: payload.email_verified ?? false,
  };
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

// Apple publishes its public keys at this well-known URL
const APPLE_JWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID ?? 'mx.mexipay.app';

export interface AppleProfile {
  appleId: string;
  /** Apple only provides email on the very first sign-in */
  email: string | undefined;
  /** Apple only provides name on the very first sign-in */
  name: string | undefined;
}

/**
 * Verify an Apple identity token and return the user's profile.
 * Throws if the token is invalid, expired, or for the wrong audience.
 */
export async function verifyAppleToken(identityToken: string): Promise<AppleProfile> {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: APPLE_CLIENT_ID,
  });

  if (!payload.sub) {
    throw new Error('Apple token payload missing sub');
  }

  logger.debug('Apple token verified', { appleId: payload.sub });

  return {
    appleId: payload.sub as string,
    email: payload.email as string | undefined,
    name: undefined, // supplied separately from the native SDK response
  };
}
