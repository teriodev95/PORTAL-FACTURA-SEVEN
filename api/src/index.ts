import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import { drizzle } from 'drizzle-orm/d1';
import { desc } from 'drizzle-orm';
import type { Env } from './lib/env';
import { tickets } from './features/tickets/routes';
import { invoicesRoutes } from './features/invoices/routes';
import { adminRoutes } from './features/admin/routes';
import { runEvoSync } from './cron/evo-sync';
import { syncLog } from './db/schema';

const app = new Hono<{ Bindings: Env }>();

app.use('*', (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      const allowed = c.env.ALLOWED_ORIGIN || '';
      if (!origin) return allowed;
      if (
        origin === allowed ||
        origin.endsWith('.seven-days-facturacion.pages.dev') ||
        origin.endsWith('.seven-days-admin.pages.dev') ||
        origin === 'https://seven-days-admin.pages.dev'
      ) {
        return origin;
      }
      return allowed;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Admin-Key'],
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

app.use('*', secureHeaders());
app.use('*', logger());

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/tickets', tickets);
app.route('/api/invoices', invoicesRoutes);

app.get('/api/sync/status', async (c) => {
  const db = drizzle(c.env.DB);
  const logs = await db
    .select()
    .from(syncLog)
    .orderBy(desc(syncLog.runAt))
    .limit(10);

  return c.json({ data: logs });
});

app.route('/api/admin', adminRoutes);

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Error interno del servidor' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runEvoSync(env));
  },
};
