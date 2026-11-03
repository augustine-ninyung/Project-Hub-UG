import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isTest } from './config/env.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { apiRouter } from './routes.js';
import { LOCAL_UPLOAD_DIR } from './services/storage.service.js';

export function createApp() {
  const app = express();

  // Number of proxies in front of the API; needed for correct req.ip and rate limiting.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Allow the client origin to embed locally served upload images.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!isTest) app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Development storage fallback (no Supabase credentials configured).
  app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

  app.use('/api/v1', apiLimiter, csrfProtection, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
