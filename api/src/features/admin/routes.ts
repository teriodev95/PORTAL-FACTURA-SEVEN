import { Hono } from 'hono';
import type { AdminEnv } from './middleware';
import { adminAuth } from './middleware';
import { createAdminService } from './service';
import { authRoutes } from './auth-routes';
import { userRoutes } from './user-routes';

const adminRoutes = new Hono<AdminEnv>();

// Auth routes — login and seed are public, /me uses its own middleware
adminRoutes.route('/auth', authRoutes);

// User management routes — has its own adminAuth + requireAdmin
adminRoutes.route('/users', userRoutes);

// All remaining routes require authentication
adminRoutes.use('*', adminAuth);

adminRoutes.get('/dashboard', async (c) => {
  try {
    const service = createAdminService(c.env.DB);
    const data = await service.getDashboard();
    return c.json({ data });
  } catch (err) {
    console.error('[Admin Dashboard Error]', err);
    return c.json({ error: 'Error al obtener el dashboard' }, 500);
  }
});

adminRoutes.get('/invoices', async (c) => {
  try {
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
    const status = c.req.query('status');
    const rfc = c.req.query('rfc');
    const search = c.req.query('search');
    const from = c.req.query('from');
    const to = c.req.query('to');

    const service = createAdminService(c.env.DB);
    const data = await service.getInvoices({ page, limit, status, rfc, search, from, to });
    return c.json({ data });
  } catch (err) {
    console.error('[Admin Invoices Error]', err);
    return c.json({ error: 'Error al obtener facturas' }, 500);
  }
});

adminRoutes.post('/invoices/:uuid/cancel', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const body = await c.req.json<{ motivo?: string }>().catch(() => ({ motivo: undefined }));
    const validMotivos = ['01', '02', '03', '04'] as const;
    if (!body.motivo || !validMotivos.includes(body.motivo as typeof validMotivos[number])) {
      return c.json({ error: 'Motivo de cancelación inválido. Valores permitidos: 01, 02, 03, 04' }, 400);
    }
    const motivo = body.motivo;

    const service = createAdminService(c.env.DB);
    const data = await service.cancelInvoice(uuid, motivo, c.env);
    return c.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al cancelar factura';
    console.error('[Admin Cancel Error]', message);

    if (message.includes('no encontrada')) {
      return c.json({ error: message }, 404);
    }
    if (message.includes('ya está cancelada')) {
      return c.json({ error: message }, 409);
    }
    return c.json({ error: message }, 500);
  }
});

adminRoutes.get('/sales', async (c) => {
  try {
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
    const search = c.req.query('search');
    const invoicedParam = c.req.query('invoiced');
    const invoiced = invoicedParam === 'true' ? true : invoicedParam === 'false' ? false : undefined;

    const service = createAdminService(c.env.DB);
    const data = await service.getSales({ page, limit, search, invoiced });
    return c.json({ data });
  } catch (err) {
    console.error('[Admin Sales Error]', err);
    return c.json({ error: 'Error al obtener ventas' }, 500);
  }
});

adminRoutes.get('/sync', async (c) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
    const service = createAdminService(c.env.DB);
    const data = await service.getSyncLogs(limit);
    return c.json({ data });
  } catch (err) {
    console.error('[Admin Sync Error]', err);
    return c.json({ error: 'Error al obtener logs de sincronización' }, 500);
  }
});

export { adminRoutes };
