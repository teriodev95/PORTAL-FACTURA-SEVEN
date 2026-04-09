import type { Env } from './env';

export class EvoApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: 'daily_limit' | 'upstream_error' = 'upstream_error'
  ) {
    super(message);
  }
}

export function createEvoClient(env: Env) {
  const baseUrl = env.EVO_API_URL;
  const credentials = btoa(`${env.EVO_API_USER}:${env.EVO_API_KEY}`);

  async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = `EVO API error: ${response.status} ${response.statusText}`;

      try {
        const payload = await response.clone().json() as { error?: string; mensagens?: string[] };
        errorMessage = payload.error || payload.mensagens?.[0] || errorMessage;
      } catch {
        // Ignore non-JSON upstream errors and keep the HTTP fallback message.
      }

      const isDailyLimit = errorMessage.toLowerCase().includes('daily request limit reached');
      if (isDailyLimit) {
        throw new EvoApiError(
          'EVO alcanzó su límite diario de consultas. Intenta de nuevo más tarde.',
          response.status,
          'daily_limit'
        );
      }

      throw new EvoApiError(errorMessage, response.status);
    }

    return response.json() as Promise<T>;
  }

  return {
    getSaleById(idSale: number) {
      return request<EvoSale[]>('/api/v1/sales', {
        idSale: String(idSale),
        take: '1',
      }).then((sales) => sales[0] ?? null);
    },
    getMember(idMember: number) {
      return request<EvoMember[]>('/api/v1/members', {
        take: '1',
        idMember: String(idMember),
      }).then((members) => members[0] ?? null);
    },
    getSalesPage(take: number, skip: number) {
      return request<EvoSale[]>('/api/v1/sales', {
        take: String(take),
        skip: String(skip),
      });
    },
  };
}

export interface EvoSaleItem {
  idSaleItem: number;
  idSale: number;
  description: string;
  item: string;
  itemValue: number;
  saleValue: number;
  quantity: number;
  discount: number;
  tax: number | null;
  voucher: string | null;
}

export interface EvoSale {
  idSale: number;
  idMember: number;
  saleDate: string;
  idBranch: number;
  saleItens: EvoSaleItem[];
  member: {
    idMember: number;
    firstName: string;
    lastName: string;
    document: string;
    country: string;
    address: string;
    state: string;
    city: string;
    zipCode: string;
    contacts: {
      contactType: string;
      description: string;
    }[];
  };
}

export interface EvoMember {
  idMember: number;
  firstName: string;
  lastName: string;
  document: string;
  documentId: string;
  branchName: string;
  zipCode: string;
  contacts: {
    contactType: string;
    description: string;
  }[];
}
