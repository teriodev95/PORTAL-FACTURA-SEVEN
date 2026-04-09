import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../../lib/env';
import { customerFiscal } from '../../db/schema';

const fiscalRoutes = new Hono<{ Bindings: Env }>();

// GET /api/fiscal/:rfc — returns saved fiscal data or 404
fiscalRoutes.get('/:rfc', async (c) => {
  const rfc = c.req.param('rfc').toUpperCase();
  const db = drizzle(c.env.DB);

  const row = await db
    .select()
    .from(customerFiscal)
    .where(eq(customerFiscal.rfc, rfc))
    .get();

  if (!row) {
    return c.json({ error: 'Datos fiscales no encontrados' }, 404);
  }

  return c.json({ data: row });
});

export { fiscalRoutes };
