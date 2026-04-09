import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sequelize } from './models/database';
import { redis } from './utils/redis';
import logger from './utils/logger';

import authRouter from './routes/auth';
import merchantsRouter from './routes/merchants';
import transactionsRouter from './routes/transactions';
import webhooksRouter from './routes/webhooks';

const PORT = Number(process.env.PORT ?? 3000);

const app = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

app.use(helmet());
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts' },
});

app.use(globalLimiter);

// ---------------------------------------------------------------------------
// Body parsers
//
// Webhook route MUST receive the raw Buffer for HMAC verification.
// All other routes use JSON.
// ---------------------------------------------------------------------------

app.use('/webhooks/conekta', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '256kb' }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/auth', authLimiter, authRouter);
app.use('/merchants', merchantsRouter);
app.use('/transactions', transactionsRouter);
app.use('/webhooks', webhooksRouter);

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// 404 + global error handler
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  try {
    await redis.connect();

    await sequelize.authenticate();
    logger.info('Database connection established');

    // In dev auto-sync; in production use migrations
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      logger.info('Database synced (dev mode)');
    }

    app.listen(PORT, () => {
      logger.info(`MexiPay backend listening on port ${PORT}`, {
        env: process.env.NODE_ENV ?? 'development',
      });
    });
  } catch (err) {
    logger.error('Startup failed', { error: (err as Error).message });
    process.exit(1);
  }
}

start();

export default app;
