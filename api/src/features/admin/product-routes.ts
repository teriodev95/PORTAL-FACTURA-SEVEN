import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { AdminEnv } from './middleware';
import { adminAuth } from './middleware';
import { productCatalog } from '../../db/schema';

const productRoutes = new Hono<AdminEnv>();

productRoutes.use('*', adminAuth);

// GET /products — list all catalog entries
productRoutes.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(productCatalog).all();
  return c.json({ data: rows });
});

// POST /products — create entry
productRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    evoPattern: string;
    satProductKey: string;
    satDescription: string;
  }>();

  if (!body.evoPattern || !body.satProductKey || !body.satDescription) {
    return c.json({ error: 'evoPattern, satProductKey y satDescription son requeridos' }, 400);
  }

  const db = drizzle(c.env.DB);
  const row = await db
    .insert(productCatalog)
    .values({
      evoPattern: body.evoPattern,
      satProductKey: body.satProductKey,
      satDescription: body.satDescription,
    })
    .returning()
    .get();

  return c.json({ data: row }, 201);
});

// DELETE /products/:id — delete entry
productRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ error: 'ID inválido' }, 400);
  }

  const db = drizzle(c.env.DB);
  const deleted = await db
    .delete(productCatalog)
    .where(eq(productCatalog.id, id))
    .returning()
    .get();

  if (!deleted) {
    return c.json({ error: 'Entrada no encontrada' }, 404);
  }

  return c.json({ data: { ok: true } });
});

export { productRoutes };
