import { Hono } from 'hono';
import type { Env } from '../../lib/env';
import { EvoApiError } from '../../lib/evo';
import { ticketSearchSchema } from './schema';
import { createTicketService } from './service';

const tickets = new Hono<{ Bindings: Env }>();

tickets.get('/:idSale', async (c) => {
  const parsed = ticketSearchSchema.safeParse({ idSale: c.req.param('idSale') });
  if (!parsed.success) {
    return c.json({ error: 'Ingresa un número de ticket válido' }, 400);
  }

  try {
    const service = createTicketService(c.env);
    const ticket = await service.getTicket(parsed.data.idSale);

    if (!ticket) {
      return c.json({ error: 'No encontramos una venta con ese número de ticket. Verifica que sea correcto.' }, 404);
    }

    return c.json({ data: ticket });
  } catch (err) {
    console.error('[Ticket Error]', err);
    if (err instanceof EvoApiError && err.code === 'daily_limit') {
      return c.json({ error: err.message }, 503);
    }

    return c.json({ error: 'No pudimos consultar la información en este momento. Intenta de nuevo.' }, 502);
  }
});

export { tickets };
