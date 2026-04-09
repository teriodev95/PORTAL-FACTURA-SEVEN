import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { createEvoClient, type EvoSale } from '../../lib/evo';
import { sales } from '../../db/schema';
import type { Env } from '../../lib/env';

export interface TicketData {
  idSale: number;
  saleDate: string;
  branchId: number;
  memberId: number;
  customerName: string;
  customerRfc: string;
  customerEmail: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    salePrice: number;
    discount: number;
  }[];
  total: number;
  paymentForm: string;
}

export function createTicketService(env: Env) {
  const evo = createEvoClient(env);
  const db = drizzle(env.DB);

  return {
    async getTicket(idSale: number): Promise<TicketData | null> {
      // Try D1 cache first
      const cached = await db
        .select()
        .from(sales)
        .where(eq(sales.idSale, idSale))
        .limit(1);

      if (cached.length > 0) {
        const row = cached[0];
        const items = JSON.parse(row.itemsJson) as TicketData['items'];
        return {
          idSale: row.idSale,
          saleDate: row.saleDate,
          branchId: row.idBranch,
          memberId: row.idMember ?? 0,
          customerName: row.customerName,
          customerRfc: row.customerRfc ?? '',
          customerEmail: row.customerEmail ?? '',
          items,
          total: row.total,
          paymentForm: row.paymentForm,
        };
      }

      // Fallback to EVO API
      const sale = await evo.getSaleById(idSale);
      if (!sale) return null;

      const member = await evo.getMember(sale.idMember);
      const email = member?.contacts?.find((c) => c.contactType === 'E-mail')?.description ?? '';

      const items = sale.saleItens.map((item) => ({
        description: item.description || item.item,
        quantity: item.quantity,
        unitPrice: item.itemValue,
        salePrice: item.saleValue,
        discount: item.discount ?? 0,
      }));

      const total = items.reduce((sum, item) => sum + item.salePrice, 0);

      return {
        idSale: sale.idSale,
        saleDate: sale.saleDate,
        branchId: sale.idBranch,
        memberId: sale.idMember,
        customerName: `${sale.member.firstName} ${sale.member.lastName}`.trim(),
        customerRfc: member?.documentId ?? '',
        customerEmail: email,
        items,
        total,
        paymentForm: '01',
      };
    },
  };
}
