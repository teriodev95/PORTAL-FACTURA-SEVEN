import { createMiddleware } from 'hono/factory';
import type { Env } from '../../lib/env';
import { verifyToken } from '../../lib/auth';

export type AdminEnv = {
  Bindings: Env;
  Variables: { user: { userId: number; email: string; role: string } };
};

export const adminAuth = createMiddleware<AdminEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ error: 'Token inválido o expirado' }, 401);
    }
    c.set('user', payload);
    await next();
    return;
  }

  // Fallback: X-Admin-Key for backwards compatibility
  const key = c.req.header('X-Admin-Key');
  if (key) {
    const encoder = new TextEncoder();
    const a = encoder.encode(key);
    const b = encoder.encode(c.env.ADMIN_KEY);
    if (a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b)) {
      c.set('user', { userId: 0, email: 'admin@legacy', role: 'admin' });
      await next();
      return;
    }
  }

  return c.json({ error: 'No autorizado' }, 401);
});

export const requireAdmin = createMiddleware<AdminEnv>(async (c, next) => {
  const user = c.get('user');
  if (user?.role !== 'admin') {
    return c.json({ error: 'Se requieren permisos de administrador' }, 403);
  }
  await next();
});
