const API_BASE = import.meta.env.VITE_API_URL || 'https://seven-days-api.clvrt.workers.dev';

function getToken(): string | null {
	if (typeof window === 'undefined') return null;
	return sessionStorage.getItem('admin_token');
}

export class ApiError extends Error {
	constructor(message: string, public status: number) {
		super(message);
	}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const token = getToken();
	if (!token) throw new ApiError('No autenticado', 401);

	const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
	if (body) headers['Content-Type'] = 'application/json';

	const res = await fetch(`${API_BASE}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined
	});

	let data: any;
	try {
		data = await res.json();
	} catch {
		throw new ApiError('Error de conexion con el servidor', res.status);
	}
	if (!res.ok) throw new ApiError(data.error || 'Error', res.status);
	return data.data as T;
}

async function requestNoAuth<T>(method: string, path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = {};
	if (body) headers['Content-Type'] = 'application/json';

	const res = await fetch(`${API_BASE}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined
	});

	let data: any;
	try {
		data = await res.json();
	} catch {
		throw new ApiError('Error de conexion con el servidor', res.status);
	}
	if (!res.ok) throw new ApiError(data.error || 'Error', res.status);
	return data.data as T;
}

// Types
export interface DashboardData {
	invoicesToday: { count: number; total: number };
	invoicesMonth: { count: number; total: number };
	lastSync: {
		runAt: string;
		verdict: string;
		salesFetched: number;
		errors: string | null;
	} | null;
	availableSales: number;
}

export interface Invoice {
	id: number;
	uuid: string;
	evoSaleId: number;
	customerName: string;
	customerRfc: string;
	customerEmail: string | null;
	total: number;
	status: string;
	fechaTimbrado: string | null;
	createdAt: string;
	cancelledAt: string | null;
}

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	pages: number;
}

export interface SaleRow {
	idSale: number;
	customerName: string;
	total: number;
	saleDate: string;
	invoiceUuid: string | null;
	invoiceStatus: string | null;
}

export interface SyncLogRow {
	id: number;
	runAt: string;
	brtHour: number;
	insideWindow: boolean;
	salesFetched: number;
	salesInserted: number;
	salesUpdated: number;
	pagesRequested: number;
	rateLimited: boolean;
	durationMs: number;
	errors: string | null;
	verdict: string;
}

export interface UserInfo {
	id: number;
	name: string;
	email: string;
	role: string;
	lastLoginAt: string | null;
}

export interface LoginResponse {
	token: string;
	user: UserInfo;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
	const res = await requestNoAuth<LoginResponse>('POST', '/api/admin/auth/login', { email, password });
	if (res.token) {
		sessionStorage.setItem('admin_token', res.token);
	}
	return res;
}

export function logout() {
	sessionStorage.removeItem('admin_token');
}

export function isAuthenticated(): boolean {
	return !!getToken();
}

export async function getMe(): Promise<UserInfo> {
	return request<UserInfo>('GET', '/api/admin/auth/me');
}

export async function seedAdmin(): Promise<{ message: string }> {
	return requestNoAuth<{ message: string }>('POST', '/api/admin/auth/seed');
}

export const admin = {
	dashboard: () => request<DashboardData>('GET', '/api/admin/dashboard'),
	invoices: (params?: string) =>
		request<PaginatedResult<Invoice>>('GET', `/api/admin/invoices${params ? '?' + params : ''}`),
	cancelInvoice: (uuid: string, motivo: string) =>
		request<Invoice>('POST', `/api/admin/invoices/${uuid}/cancel`, { motivo }),
	sales: (params?: string) =>
		request<PaginatedResult<SaleRow>>('GET', `/api/admin/sales${params ? '?' + params : ''}`),
	syncLogs: (limit = 20) => request<SyncLogRow[]>('GET', `/api/admin/sync?limit=${limit}`),
	getPdfUrl: (uuid: string) => `${API_BASE}/api/invoices/${uuid}/pdf`,
	getXmlUrl: (uuid: string) => `${API_BASE}/api/invoices/${uuid}/xml`,
	getUsers: () => request<UserInfo[]>('GET', '/api/admin/users'),
	createUser: (data: { name: string; email: string; password: string; role: string }) =>
		request<UserInfo>('POST', '/api/admin/users', data),
	deleteUser: (id: number) => request<void>('DELETE', `/api/admin/users/${id}`)
};
