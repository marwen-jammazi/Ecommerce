import os from 'node:os';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import routes from './routes/index.js';
import sanitize from './middleware/sanitize.js';
import { createLimiter } from './middleware/rateLimit.js';
import { stripeWebhook } from './controllers/payment.controller.js';
import { notFound, errorHandler } from './middleware/error.js';
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
const app = express();

app.set('trust proxy', 1); // we run behind Nginx / a load balancer

app.use(helmet());
app.use(
  cors({
    origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(','),
    credentials: true,
  })
);
app.use(compression());

// Stripe webhook needs the RAW body, so it must come before express.json()
app.post('/api/v1/payments/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(sanitize);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', createLimiter({ windowMs: 15 * 60 * 1000, limit: 300, prefix: 'api' }));

app.get('/health', (req, res) => {
  const body = { status: 'ok', uptime: process.uptime() };
  // outside production, show which instance answered (handy to see load balancing)
  if (process.env.NODE_ENV !== 'production') Object.assign(body, { instance: os.hostname(), pid: process.pid });
  res.json(body);
});

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;