import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../../lib/env';
import { createSwClient, type CfdiJson, type CfdiConcepto, type CfdiTraslado } from '../../lib/sw';
import { createTicketService } from '../tickets/service';
import { invoices, productCatalog, customerFiscal } from '../../db/schema';
import type { ProductCatalogEntry } from '../../db/schema';
import { SAT_PRODUCT_KEY_DEFAULT, SAT_UNIT_KEY, SAT_UNIT_NAME, type CreateInvoiceInput } from './schema';

const EMISOR_RFC = 'SDA1012207SA';
const EMISOR_NOMBRE = 'SEVEN DAYS ALL SPORT';
const EMISOR_REGIMEN = '601';
const LUGAR_EXPEDICION = '58260';
const IVA_RATE = 0.16;

/** Round to 2 decimal places (returns number, not string). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toFixed2(n: number): string {
  return n.toFixed(2);
}

function toFixed6(n: number): string {
  return n.toFixed(6);
}

/**
 * Returns the current date-time in Mexico Central Time (UTC-6) formatted as
 * YYYY-MM-DDTHH:mm:ss.  Workers don't reliably support Intl timezone APIs,
 * so we apply a manual −6 h offset (CST, matching LugarExpedicion CP 58260).
 */
function getMexicoCentralDate(): string {
  const now = new Date();
  const utcMs = now.getTime();
  const mxMs = utcMs - 6 * 60 * 60 * 1000; // UTC-6
  const mx = new Date(mxMs);

  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = mx.getUTCFullYear();
  const MM = pad(mx.getUTCMonth() + 1);
  const dd = pad(mx.getUTCDate());
  const hh = pad(mx.getUTCHours());
  const mm = pad(mx.getUTCMinutes());
  const ss = pad(mx.getUTCSeconds());

  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`;
}

/** Match item description against product catalog entries. Returns first match or default key. */
function resolveSatProductKey(description: string, catalog: ProductCatalogEntry[]): string {
  const upper = description.toUpperCase();
  for (const entry of catalog) {
    if (upper.includes(entry.evoPattern.toUpperCase())) {
      return entry.satProductKey;
    }
  }
  return SAT_PRODUCT_KEY_DEFAULT;
}

function buildCfdiJson(
  input: CreateInvoiceInput,
  items: { description: string; quantity: number; unitPrice: number; salePrice: number; discount: number; satProductKey: string }[]
): CfdiJson {
  let subtotal = 0;
  let totalDescuento = 0;

  const conceptos: CfdiConcepto[] = items.map((item) => {
    // EVO prices INCLUDE IVA. We need to extract the subtotal (base) from the
    // IVA-inclusive amount.
    // salePrice = line total with IVA (price × qty already included)
    // unitPrice = original line total with IVA (before discount)
    // discount = total discount amount for the line (IVA-inclusive)
    //
    // For CFDI we need prices WITHOUT IVA:
    //   base per unit = (unitPrice / qty) / 1.16
    //   discount without IVA = discount / 1.16
    const lineTotal = item.discount > 0 ? item.unitPrice : item.salePrice;
    const precioConIva = round2(lineTotal / item.quantity);
    const precio = round2(precioConIva / 1.16);
    const importe = round2(precio * item.quantity);
    const descuento = item.discount > 0 ? round2(item.discount / 1.16) : 0;
    const baseImpuesto = round2(importe - descuento);
    const ivaImporte = round2(baseImpuesto * IVA_RATE);

    subtotal += importe;
    totalDescuento += descuento;

    const traslado: CfdiTraslado = {
      Base: toFixed2(baseImpuesto),
      Impuesto: '002',
      TipoFactor: 'Tasa',
      TasaOCuota: '0.160000',
      Importe: toFixed2(ivaImporte),
    };

    return {
      ClaveProdServ: item.satProductKey,
      Cantidad: String(item.quantity),
      ClaveUnidad: SAT_UNIT_KEY,
      Unidad: SAT_UNIT_NAME,
      Descripcion: item.description,
      ValorUnitario: toFixed2(precio),
      Importe: toFixed2(importe),
      Descuento: descuento > 0 ? toFixed2(descuento) : undefined,
      ObjetoImp: '02' as const,
      Impuestos: {
        Traslados: [traslado],
      },
    };
  });

  // Global totals are sums of already-rounded per-concepto values so that
  // SAT validation (sum of concepto.Importe === SubTotal) always passes.
  const baseTotal = round2(subtotal - totalDescuento);
  const ivaTotal = round2(baseTotal * IVA_RATE);
  const total = round2(baseTotal + ivaTotal);

  const cfdi: CfdiJson = {
    Version: '4.0',
    FormaPago: input.payment_form,
    Serie: 'F',
    Fecha: getMexicoCentralDate(),
    Sello: '',
    NoCertificado: '',
    Certificado: '',
    SubTotal: toFixed2(subtotal),
    Descuento: totalDescuento > 0 ? toFixed2(totalDescuento) : undefined,
    Moneda: 'MXN',
    Total: toFixed2(total),
    TipoDeComprobante: 'I',
    Exportacion: '01',
    MetodoPago: 'PUE',
    LugarExpedicion: LUGAR_EXPEDICION,
    Emisor: {
      Rfc: EMISOR_RFC,
      Nombre: EMISOR_NOMBRE,
      RegimenFiscal: EMISOR_REGIMEN,
    },
    Receptor: {
      Rfc: input.customer.tax_id,
      Nombre: input.customer.legal_name,
      DomicilioFiscalReceptor: input.customer.zip,
      RegimenFiscalReceptor: input.customer.tax_system,
      UsoCFDI: input.use,
    },
    Conceptos: conceptos,
    Impuestos: {
      TotalImpuestosTrasladados: toFixed2(ivaTotal),
      Traslados: [
        {
          Base: toFixed2(baseTotal),
          Impuesto: '002',
          TipoFactor: 'Tasa',
          TasaOCuota: '0.160000',
          Importe: toFixed2(ivaTotal),
        },
      ],
    },
  };

  return cfdi;
}

export function createInvoiceService(env: Env) {
  const sw = createSwClient(env);
  const ticketService = createTicketService(env);
  const db = drizzle(env.DB);

  return {
    async createInvoice(input: CreateInvoiceInput) {
      const existing = await db
        .select()
        .from(invoices)
        .where(eq(invoices.evoSaleId, input.idSale))
        .get();

      if (existing) {
        throw new Error('Ya existe una factura para esta venta');
      }

      const ticket = await ticketService.getTicket(input.idSale);
      if (!ticket) {
        throw new Error('Ticket no encontrado');
      }

      // Resolve SAT product key for each item from the product catalog
      const catalogEntries = await db.select().from(productCatalog).all();
      const itemsWithKey = ticket.items.map((item) => ({
        ...item,
        satProductKey: resolveSatProductKey(item.description, catalogEntries),
      }));

      const cfdiJson = buildCfdiJson(input, itemsWithKey);
      const swResult = await sw.issueInvoice(cfdiJson);
      const data = swResult.data!;

      const record = await db
        .insert(invoices)
        .values({
          uuid: data.uuid,
          evoSaleId: input.idSale,
          evoMemberId: ticket.memberId,
          customerName: input.customer.legal_name,
          customerRfc: input.customer.tax_id,
          customerEmail: input.customer.email || null,
          total: parseFloat(cfdiJson.Total),
          status: 'valid',
          cfdiXml: data.cfdi,
          fechaTimbrado: data.fechaTimbrado,
        })
        .returning()
        .get();

      // Save/update customer fiscal data for future autofill (fire-and-forget)
      try {
        await db.insert(customerFiscal).values({
          rfc: input.customer.tax_id,
          legalName: input.customer.legal_name,
          zip: input.customer.zip,
          taxSystem: input.customer.tax_system,
          cfdiUse: input.use,
          paymentForm: input.payment_form,
          email: input.customer.email || null,
          updatedAt: new Date().toISOString(),
        }).onConflictDoUpdate({
          target: customerFiscal.rfc,
          set: {
            legalName: input.customer.legal_name,
            zip: input.customer.zip,
            taxSystem: input.customer.tax_system,
            cfdiUse: input.use,
            paymentForm: input.payment_form,
            email: input.customer.email || null,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error('[Fiscal upsert error]', err);
      }

      return {
        id: record.id,
        uuid: data.uuid,
        total: parseFloat(cfdiJson.Total),
        fechaTimbrado: data.fechaTimbrado,
      };
    },

    async getXml(uuid: string): Promise<string | null> {
      const record = await db
        .select()
        .from(invoices)
        .where(eq(invoices.uuid, uuid))
        .get();

      if (record?.cfdiXml) return record.cfdiXml;

      // Fallback: fetch from SW datawarehouse
      try {
        return await sw.downloadXml(uuid);
      } catch {
        return null;
      }
    },

    async getPdf(uuid: string): Promise<Uint8Array | null> {
      const xml = await this.getXml(uuid);
      if (!xml) return null;
      return sw.generatePdf(xml);
    },

    async getInvoiceBySaleId(idSale: number) {
      return db
        .select()
        .from(invoices)
        .where(eq(invoices.evoSaleId, idSale))
        .get();
    },
  };
}
