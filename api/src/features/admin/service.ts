import { drizzle } from 'drizzle-orm/d1';
import { eq, like, and, or, gte, lte, isNull, isNotNull, desc, sql, count } from 'drizzle-orm';
import { invoices, sales, syncLog } from '../../db/schema';
import { createSwClient } from '../../lib/sw';
import type { Env } from '../../lib/env';

interface PaginationParams {
  page: number;
  limit: number;
}

interface InvoiceListParams extends PaginationParams {
  status?: string;
  rfc?: string;
  search?: string;
  from?: string;
  to?: string;
}

interface SalesListParams extends PaginationParams {
  search?: string;
  invoiced?: boolean;
}

export function createAdminService(db: D1Database) {
  const orm = drizzle(db);

  return {
    async getDashboard() {
      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);

      const [todayStats] = await orm
        .select({
          count: count(),
          total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
        })
        .from(invoices)
        .where(like(invoices.createdAt, `${today}%`));

      const [monthStats] = await orm
        .select({
          count: count(),
          total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
        })
        .from(invoices)
        .where(like(invoices.createdAt, `${month}%`));

      const lastSyncRows = await orm
        .select()
        .from(syncLog)
        .orderBy(desc(syncLog.runAt))
        .limit(1);

      const [availableResult] = await orm
        .select({ count: count() })
        .from(sales)
        .leftJoin(invoices, eq(sales.idSale, invoices.evoSaleId))
        .where(isNull(invoices.id));

      return {
        invoicesToday: { count: todayStats.count, total: todayStats.total },
        invoicesMonth: { count: monthStats.count, total: monthStats.total },
        lastSync: lastSyncRows[0] ?? null,
        availableSales: availableResult.count,
      };
    },

    async getInvoices(params: InvoiceListParams) {
      const { page, limit, status, rfc, search, from, to } = params;
      const conditions = [];

      if (status) conditions.push(eq(invoices.status, status));
      if (rfc) conditions.push(eq(invoices.customerRfc, rfc));
      if (search) conditions.push(like(invoices.customerName, `%${search}%`));
      if (from) conditions.push(gte(invoices.createdAt, from));
      if (to) conditions.push(lte(invoices.createdAt, `${to}T23:59:59`));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult] = await orm
        .select({ count: count() })
        .from(invoices)
        .where(where);

      const items = await orm
        .select()
        .from(invoices)
        .where(where)
        .orderBy(desc(invoices.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);

      const total = totalResult.count;

      return {
        items,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    },

    async cancelInvoice(uuid: string, motivo: string, env: Env) {
      const [invoice] = await orm
        .select()
        .from(invoices)
        .where(eq(invoices.uuid, uuid))
        .limit(1);

      if (!invoice) {
        throw new Error('Factura no encontrada');
      }

      if (invoice.status === 'cancelled') {
        throw new Error('La factura ya está cancelada');
      }

      const sw = createSwClient(env);
      const cancelResult = await sw.cancelInvoice(uuid, 'SDA1012207SA', motivo);

      const acuse = cancelResult.data?.acuse ?? '';
      const now = new Date().toISOString();

      await orm
        .update(invoices)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancelAcuse: acuse,
        })
        .where(eq(invoices.uuid, uuid));

      const [updated] = await orm
        .select()
        .from(invoices)
        .where(eq(invoices.uuid, uuid))
        .limit(1);

      return updated;
    },

    async getSales(params: SalesListParams) {
      const { page, limit, search, invoiced } = params;
      const conditions = [];

      if (search) {
        const numericSearch = Number(search);
        if (!isNaN(numericSearch) && numericSearch > 0) {
          conditions.push(
            or(
              like(sales.customerName, `%${search}%`),
              eq(sales.idSale, numericSearch),
            ),
          );
        } else {
          conditions.push(like(sales.customerName, `%${search}%`));
        }
      }

      if (invoiced === true) {
        conditions.push(isNotNull(invoices.id));
      } else if (invoiced === false) {
        conditions.push(isNull(invoices.id));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const baseQuery = orm
        .select({
          idSale: sales.idSale,
          idMember: sales.idMember,
          idBranch: sales.idBranch,
          saleDate: sales.saleDate,
          customerName: sales.customerName,
          customerRfc: sales.customerRfc,
          customerEmail: sales.customerEmail,
          itemsJson: sales.itemsJson,
          total: sales.total,
          syncedAt: sales.syncedAt,
          invoiceUuid: invoices.uuid,
          invoiceStatus: invoices.status,
        })
        .from(sales)
        .leftJoin(invoices, eq(sales.idSale, invoices.evoSaleId));

      const [totalResult] = await orm
        .select({ count: count() })
        .from(sales)
        .leftJoin(invoices, eq(sales.idSale, invoices.evoSaleId))
        .where(where);

      const items = await baseQuery
        .where(where)
        .orderBy(desc(sales.saleDate))
        .limit(limit)
        .offset((page - 1) * limit);

      const total = totalResult.count;

      return {
        items,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    },

    async getSyncLogs(limit: number) {
      return orm
        .select()
        .from(syncLog)
        .orderBy(desc(syncLog.runAt))
        .limit(limit);
    },
  };
}
