import { Hono } from 'hono';
import type { Env } from '../../lib/env';
import { createInvoiceSchema } from './schema';
import { createInvoiceService } from './service';

const invoicesRoutes = new Hono<{ Bindings: Env }>();

function friendlyError(err: unknown): { message: string; status: 400 | 404 | 409 | 500 | 502 } {
  const raw = err instanceof Error ? err.message : String(err);
  console.error('[Invoice Error]', raw);

  // Duplicado
  if (raw.includes('Ya existe')) {
    return { message: 'Este ticket ya fue facturado. Si necesitas una nueva factura, primero cancela la anterior.', status: 409 };
  }
  if (raw.includes('Ticket no encontrado')) {
    return { message: 'No encontramos la venta asociada a este ticket. Verifica el número e intenta de nuevo.', status: 404 };
  }

  // SAT / CFDI 4.0 validation errors from SW
  if (raw.includes('CFDI40139') || (raw.includes('nombre') && raw.includes('emisor'))) {
    return { message: 'Error en los datos del emisor. Contacta al gimnasio.', status: 500 };
  }
  if (raw.includes('CFDI40145') || raw.includes('CFDI40148') || (raw.includes('Nombre') && raw.includes('receptor'))) {
    return { message: 'El nombre o razón social no coincide con el RFC en el SAT. Escríbelo exactamente como aparece en tu constancia de situación fiscal (mayúsculas, sin acentos, sin régimen societario).', status: 400 };
  }
  if (raw.includes('CFDI40158') || raw.includes('CFDI40152') || (raw.includes('RegimenFiscal') && raw.includes('Receptor'))) {
    return { message: 'El régimen fiscal no corresponde con tu tipo de persona (física o moral). Verifica tu constancia de situación fiscal.', status: 400 };
  }
  if (raw.includes('CFDI40150') || raw.includes('CFDI40147') || (raw.includes('domicilio') && raw.includes('receptor'))) {
    return { message: 'El código postal no coincide con tu domicilio fiscal registrado en el SAT.', status: 400 };
  }
  if (raw.includes('CFDI40130') || raw.includes('Información Global')) {
    return { message: 'Para facturar a público en general se requiere información global. Contacta al gimnasio.', status: 400 };
  }
  if (raw.includes('CFDI40153') || raw.includes('UsoCFDI')) {
    return { message: 'El uso de CFDI seleccionado no es válido para tu régimen fiscal. Revisa tu constancia.', status: 400 };
  }

  // SW generic validation
  if (raw.includes('estructura') || raw.includes('301')) {
    return { message: 'Error en la estructura del comprobante. Contacta al gimnasio.', status: 500 };
  }
  if (raw.includes('Certificado') || raw.includes('certificate')) {
    return { message: 'Error con el certificado de sello digital del emisor. Contacta al gimnasio.', status: 500 };
  }

  // RFC format
  if (raw.includes('tax_id') || raw.includes('RFC')) {
    return { message: 'El RFC no tiene un formato válido. Verifica que sean 12 caracteres (persona moral) o 13 (persona física), sin espacios ni guiones.', status: 400 };
  }

  // Discount errors
  if (raw.includes('discount') || raw.includes('Descuento')) {
    return { message: 'El descuento de un concepto supera el precio original. Contacta al gimnasio para revisar los montos.', status: 400 };
  }

  // SW auth/connectivity
  if (raw.includes('SW:') || raw.includes('Autenticación') || raw.includes('timbrar')) {
    return { message: 'El servicio de facturación no está disponible en este momento. Intenta de nuevo en unos minutos.', status: 502 };
  }
  if (raw.includes('EVO')) {
    return { message: 'No pudimos conectar con el sistema del gimnasio. Intenta de nuevo en unos minutos.', status: 502 };
  }

  return { message: 'Ocurrió un error inesperado. Si el problema persiste, contacta al gimnasio.', status: 500 };
}

invoicesRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Los datos enviados no tienen un formato válido. Intenta de nuevo.' }, 400);
  }

  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    const fieldMessages: Record<string, string> = {
      'idSale': 'El número de ticket es requerido',
      'customer.legal_name': 'Ingresa tu nombre o razón social',
      'customer.tax_id': 'Ingresa un RFC válido (12 o 13 caracteres, sin espacios)',
      'customer.tax_system': 'Selecciona tu régimen fiscal',
      'customer.zip': 'Ingresa tu código postal fiscal (5 dígitos)',
      'customer.email': 'El correo electrónico no tiene un formato válido',
      'use': 'Selecciona el uso del CFDI',
      'payment_form': 'Selecciona cómo realizaste tu pago',
    };

    return c.json({
      error: 'Revisa los campos marcados y corrige la información',
      details: parsed.error.issues.map((i) => {
        const field = i.path.join('.');
        return {
          field,
          message: fieldMessages[field] || i.message,
        };
      }),
    }, 400);
  }

  const service = createInvoiceService(c.env);

  try {
    const result = await service.createInvoice(parsed.data);
    return c.json({ data: result }, 201);
  } catch (err) {
    const { message, status } = friendlyError(err);
    return c.json({ error: message }, status);
  }
});

invoicesRoutes.get('/:uuid/pdf', async (c) => {
  const uuid = c.req.param('uuid');
  const service = createInvoiceService(c.env);

  try {
    const pdf = await service.getPdf(uuid);
    if (!pdf) {
      return c.json({ error: 'No encontramos la factura solicitada.' }, 404);
    }

    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura-${uuid}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[PDF Download Error]', err);
    return c.json({ error: 'No fue posible generar el PDF. Intenta de nuevo.' }, 500);
  }
});

invoicesRoutes.get('/:uuid/xml', async (c) => {
  const uuid = c.req.param('uuid');
  const service = createInvoiceService(c.env);

  try {
    const xml = await service.getXml(uuid);
    if (!xml) {
      return c.json({ error: 'No encontramos la factura solicitada.' }, 404);
    }

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="factura-${uuid}.xml"`,
      },
    });
  } catch (err) {
    console.error('[XML Download Error]', err);
    return c.json({ error: 'No fue posible descargar el XML. Intenta de nuevo.' }, 500);
  }
});

invoicesRoutes.get('/by-sale/:idSale', async (c) => {
  const idSale = Number(c.req.param('idSale'));
  if (isNaN(idSale) || idSale <= 0) {
    return c.json({ error: 'El número de ticket no es válido' }, 400);
  }

  const service = createInvoiceService(c.env);
  const invoice = await service.getInvoiceBySaleId(idSale);

  if (!invoice) {
    return c.json({ error: 'No se ha generado factura para este ticket' }, 404);
  }

  return c.json({ data: invoice });
});

export { invoicesRoutes };
