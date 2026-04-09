import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const invoices = sqliteTable('invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull().unique(),
  evoSaleId: integer('evo_sale_id').notNull(),
  evoMemberId: integer('evo_member_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerRfc: text('customer_rfc').notNull(),
  customerEmail: text('customer_email'),
  total: real('total').notNull(),
  status: text('status').notNull().default('valid'),
  cfdiXml: text('cfdi_xml'),
  fechaTimbrado: text('fecha_timbrado'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const sales = sqliteTable('sales', {
  idSale: integer('id_sale').primaryKey(),
  idMember: integer('id_member'),
  idBranch: integer('id_branch').notNull(),
  saleDate: text('sale_date').notNull(),
  customerName: text('customer_name').notNull(),
  customerRfc: text('customer_rfc'),
  customerEmail: text('customer_email'),
  itemsJson: text('items_json').notNull(),
  total: real('total').notNull(),
  syncedAt: text('synced_at').notNull(),
});

export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runAt: text('run_at').notNull(),
  brtHour: integer('brt_hour').notNull(),
  insideWindow: integer('inside_window', { mode: 'boolean' }).notNull(),
  salesFetched: integer('sales_fetched').notNull(),
  salesInserted: integer('sales_inserted').notNull(),
  salesUpdated: integer('sales_updated').notNull(),
  pagesRequested: integer('pages_requested').notNull(),
  rateLimited: integer('rate_limited', { mode: 'boolean' }).notNull(),
  durationMs: integer('duration_ms').notNull(),
  errors: text('errors'),
  verdict: text('verdict').notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
export type SyncLogEntry = typeof syncLog.$inferSelect;
