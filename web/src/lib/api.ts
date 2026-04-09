const API_BASE = import.meta.env.VITE_API_URL || 'https://seven-days-api.clvrt.workers.dev';

async function requestPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data as T;
  } catch { return null; }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || 'Error desconocido', response.status, data.details);
  }

  return data.data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: { field: string; message: string }[]
  ) {
    super(message);
  }
}

export interface TicketData {
  idSale: number;
  saleDate: string;
  branchId: number;
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
}

export interface InvoiceResult {
  id: number;
  uuid: string;
  total: number;
  fechaTimbrado: string;
}

export const api = {
  getTicket: (idSale: number) => request<TicketData>('GET', `/api/tickets/${idSale}`),
  createInvoice: (data: CreateInvoicePayload) => request<InvoiceResult>('POST', '/api/invoices', data),
  getFiscalData: (rfc: string) => requestPublic<FiscalData>(`/api/fiscal/${rfc}`),
  getInvoicePdfUrl: (uuid: string) => `${API_BASE}/api/invoices/${uuid}/pdf`,
  getInvoiceXmlUrl: (uuid: string) => `${API_BASE}/api/invoices/${uuid}/xml`,
};

export interface FiscalData {
  rfc: string;
  legalName: string;
  zip: string;
  taxSystem: string;
  cfdiUse: string | null;
  paymentForm: string | null;
  email: string | null;
}

export interface CreateInvoicePayload {
  idSale: number;
  customer: {
    legal_name: string;
    tax_id: string;
    tax_system: string;
    zip: string;
    email?: string;
  };
  use: string;
  payment_form: string;
}
