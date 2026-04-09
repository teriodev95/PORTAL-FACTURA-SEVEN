import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import type { AdminEnv } from './middleware';
import { staffUsers } from '../../db/schema';
import { hashPassword, verifyPassword, createToken } from '../../lib/auth';
import { adminAuth } from './middleware';

const authRoutes = new Hono<AdminEnv>();

// POST /auth/login — public
authRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    if (!email || !password) {
      return c.json({ error: 'Email y contraseña son requeridos' }, 400);
    }

    const db = drizzle(c.env.DB);
    const [user] = await db.select().from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
    if (!user) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
    }

    // Update last_login
    const now = new Date().toISOString();
    await db.update(staffUsers).set({ lastLogin: now }).where(eq(staffUsers.id, user.id));

    const token = await createToken(
      { userId: user.id, email: user.email, role: user.role },
      c.env.JWT_SECRET
    );

    return c.json({
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    return c.json({ error: 'Error al iniciar sesión' }, 500);
  }
});

// POST /auth/seed — public, only works if no users exist
authRoutes.post('/seed', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const existing = await db.select({ id: staffUsers.id }).from(staffUsers).limit(1);
    if (existing.length > 0) {
      return c.json({ error: 'Ya existen usuarios. Seed no permitido.' }, 409);
    }

    const passwordHash = await hashPassword('admin123');
    const now = new Date().toISOString();
    const [created] = await db
      .insert(staffUsers)
      .values({
        email: 'admin@sevendays.com',
        name: 'Administrador',
        role: 'admin',
        passwordHash,
        createdAt: now,
      })
      .returning();

    return c.json({
      data: {
        user: { id: created.id, email: created.email, name: created.name, role: created.role },
      },
    });
  } catch (err) {
    console.error('[Auth Seed Error]', err);
    return c.json({ error: 'Error al crear usuario inicial' }, 500);
  }
});

// GET /auth/me — requires auth
authRoutes.get('/me', adminAuth, async (c) => {
  const user = c.get('user');
  return c.json({ data: user });
});

export { authRoutes };
