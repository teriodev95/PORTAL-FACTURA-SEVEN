import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import type { AdminEnv } from './middleware';
import { adminAuth, requireAdmin } from './middleware';
import { staffUsers } from '../../db/schema';
import { hashPassword } from '../../lib/auth';

const userRoutes = new Hono<AdminEnv>();

// All user management routes require admin auth + admin role
userRoutes.use('*', adminAuth);
userRoutes.use('*', requireAdmin);

// GET /users — list all staff users
userRoutes.get('/', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const users = await db
      .select({
        id: staffUsers.id,
        email: staffUsers.email,
        name: staffUsers.name,
        role: staffUsers.role,
        createdAt: staffUsers.createdAt,
        lastLogin: staffUsers.lastLogin,
      })
      .from(staffUsers);
    return c.json({ data: users });
  } catch (err) {
    console.error('[User List Error]', err);
    return c.json({ error: 'Error al obtener usuarios' }, 500);
  }
});

// POST /users — create new user
userRoutes.post('/', async (c) => {
  try {
    const { email, name, password, role } = await c.req.json<{
      email: string;
      name: string;
      password: string;
      role?: string;
    }>();

    if (!email || !name || !password) {
      return c.json({ error: 'Email, nombre y contraseña son requeridos' }, 400);
    }

    const validRoles = ['admin', 'viewer'];
    const userRole = role && validRoles.includes(role) ? role : 'viewer';

    const db = drizzle(c.env.DB);

    // Check if email already exists
    const existing = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
    if (existing.length > 0) {
      return c.json({ error: 'Ya existe un usuario con ese email' }, 409);
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    const [created] = await db
      .insert(staffUsers)
      .values({ email, name, role: userRole, passwordHash, createdAt: now })
      .returning();

    return c.json({
      data: { id: created.id, email: created.email, name: created.name, role: created.role, createdAt: created.createdAt },
    });
  } catch (err) {
    console.error('[User Create Error]', err);
    return c.json({ error: 'Error al crear usuario' }, 500);
  }
});

// DELETE /users/:id — delete user (cannot delete self)
userRoutes.delete('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) {
      return c.json({ error: 'ID inválido' }, 400);
    }

    const currentUser = c.get('user');
    if (currentUser.userId === id) {
      return c.json({ error: 'No puedes eliminar tu propia cuenta' }, 400);
    }

    const db = drizzle(c.env.DB);
    const [deleted] = await db.delete(staffUsers).where(eq(staffUsers.id, id)).returning();
    if (!deleted) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    return c.json({ data: { id: deleted.id, email: deleted.email } });
  } catch (err) {
    console.error('[User Delete Error]', err);
    return c.json({ error: 'Error al eliminar usuario' }, 500);
  }
});

export { userRoutes };
