import { createMiddleware } from 'hono/factory';
import type { Env } from '../../lib/env';

export const adminAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const key = c.req.header('X-Admin-Key');

  if (!key) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const encoder = new TextEncoder();
  const a = encoder.encode(key);
  const b = encoder.encode(c.env.ADMIN_KEY);
  if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  await next();
});
