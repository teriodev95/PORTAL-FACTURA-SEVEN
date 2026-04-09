import { z } from 'zod';

export const ticketSearchSchema = z.object({
  idSale: z.coerce.number().int().positive('El ID de venta debe ser un número positivo'),
});

export type TicketSearchInput = z.infer<typeof ticketSearchSchema>;
