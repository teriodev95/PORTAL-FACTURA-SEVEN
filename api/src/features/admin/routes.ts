import { Hono } from 'hono';
import type { AdminEnv } from './middleware';
import { adminAuth } from './middleware';
import { createAdminService } from './service';
import { authRoutes } from './auth-routes';
import { userRoutes } from './user-routes';
import { productRoutes } from './product-routes';

const adminRoutes = new Hono<AdminEnv>();

// Auth routes — login and seed are public, /me uses its own middleware
adminRoutes.route('/auth', authRoutes);

// User management routes — has its own adminAuth + requireAdmin
adminRoutes.route('/users', userRoutes);

// Product catalog routes — has its own adminAuth
adminRoutes.route('/products', productRoutes);

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

adminRoutes.patch('/sales/:idSale/payment', async (c) => {
  try {
    const idSale = Number(c.req.param('idSale'));
    if (isNaN(idSale)) return c.json({ error: 'ID inválido' }, 400);

    const { paymentForm } = await c.req.json<{ paymentForm: string }>();
    const valid = ['01', '02', '03', '04', '06', '08', '28', '29', '99'];
    if (!paymentForm || !valid.includes(paymentForm)) {
      return c.json({ error: 'Forma de pago inválida' }, 400);
    }

    const service = createAdminService(c.env.DB);
    await service.updateSalePaymentForm(idSale, paymentForm);
    return c.json({ data: { idSale, paymentForm } });
  } catch (err) {
    console.error('[Admin Payment Update Error]', err);
    return c.json({ error: 'Error al actualizar forma de pago' }, 500);
  }
});

adminRoutes.get('/fiscal/:rfc', async (c) => {
  try {
    const rfc = c.req.param('rfc');
    const service = createAdminService(c.env.DB);
    const data = await service.getFiscalByRfc(rfc);
    if (!data) return c.json({ data: null });
    return c.json({ data });
  } catch (err) {
    console.error('[Admin Fiscal Get Error]', err);
    return c.json({ error: 'Error al obtener datos fiscales' }, 500);
  }
});

adminRoutes.put('/fiscal', async (c) => {
  try {
    const body = await c.req.json<{
      rfc: string;
      legalName: string;
      zip: string;
      taxSystem: string;
      cfdiUse?: string;
      paymentForm?: string;
      email?: string;
      idSale?: number;
    }>();

    if (!body.rfc || !body.legalName || !body.zip || !body.taxSystem) {
      return c.json({ error: 'RFC, nombre, código postal y régimen fiscal son requeridos' }, 400);
    }

    const service = createAdminService(c.env.DB);
    const data = await service.upsertFiscalData(body);

    // Also update the sale's RFC so it links properly on next open
    if (body.idSale) {
      await service.updateSaleRfc(body.idSale, body.rfc);
    }

    return c.json({ data });
  } catch (err) {
    console.error('[Admin Fiscal Upsert Error]', err);
    return c.json({ error: 'Error al guardar datos fiscales' }, 500);
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
