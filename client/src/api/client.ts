const API = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

export interface User {
  _id: string;
  email: string;
  name: string;
  settings?: {
    defaultCurrency: string;
    runAutomationsOnImport: boolean;
  };
}

export interface Account {
  _id: string;
  name: string;
  balance: number;
  currency: string;
}

export interface Category {
  _id: string;
  name: string;
  type: 'income' | 'expense';
}

export interface Transaction {
  _id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  date: string;
  memo?: string;
  accountId: Account | string;
  categoryId?: Category | string;
  toAccountId?: Account | string;
}

export const api = {
  signup: (data: { email: string; password: string; name?: string }) =>
    request<User>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<User>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => request<User>('/auth/me'),

  updateSettings: (data: {
    defaultCurrency?: string;
    runAutomationsOnImport?: boolean;
    name?: string;
  }) => request<User>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  previewImport: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API}/import/preview`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === 'string' ? body.error : 'Preview failed');
    }
    return res.json() as Promise<{ jobId: string; preview: ImportPreview }>;
  },

  confirmImport: (jobId: string, runAutomationsOnImport?: boolean) =>
    request<{ imported: number; skipped: number }>('/import/confirm', {
      method: 'POST',
      body: JSON.stringify({ jobId, runAutomationsOnImport }),
    }),

  getAccounts: () => request<Account[]>('/accounts'),

  createAccount: (data: { name: string; balance?: number; currency?: string }) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),

  updateAccount: (
    id: string,
    data: { name?: string; balance?: number; currency?: string }
  ) => request<Account>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteAccount: (id: string) =>
    request<{ ok: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),

  getCategories: (type?: string) =>
    request<Category[]>(`/categories${type ? `?type=${type}` : ''}`),

  createCategory: (data: { name: string; type: 'income' | 'expense' }) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),

  updateCategory: (id: string, data: { name?: string; type?: 'income' | 'expense' }) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' }),

  getTransactions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request<Transaction[]>(`/transactions${qs}`);
  },

  createTransaction: (data: {
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    date: string;
    accountId: string;
    categoryId?: string;
    toAccountId?: string;
    memo?: string;
  }) => request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }),

  getEntities: () => request<EntityWithSummary[]>('/entities'),

  createEntity: (data: {
    name: string;
    direction: 'i_owe' | 'they_owe_me';
    type?: string;
    notes?: string;
  }) => request<Entity>('/entities', { method: 'POST', body: JSON.stringify(data) }),

  getEntityObligations: (entityId: string) =>
    request<ObligationWithRemaining[]>(`/entities/${entityId}/obligations`),

  createManualObligation: (entityId: string, totalDue: number) =>
    request<Obligation>(`/entities/${entityId}/obligations`, {
      method: 'POST',
      body: JSON.stringify({ totalDue }),
    }),

  createPaymentBack: (data: {
    entityId: string;
    amount: number;
    accountId?: string;
    categoryId?: string;
    memo?: string;
    transactionId?: string;
    date?: string;
  }) =>
    request<PaymentBackResult>('/payment-backs', { method: 'POST', body: JSON.stringify(data) }),

  getPaymentBacks: (entityId?: string) => {
    const qs = entityId ? `?entityId=${entityId}` : '';
    return request<PaymentBackRecord[]>(`/payment-backs${qs}`);
  },
};

export interface ImportPreview {
  accounts: number;
  categories: number;
  transactions: number;
  incomeTotal: number;
  expenseTotal: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface Entity {
  _id: string;
  name: string;
  type: string;
  direction: 'i_owe' | 'they_owe_me';
  obligationSummary?: { totalDue: number; paid: number; remaining: number; openCount: number };
}

export interface EntityWithSummary extends Entity {
  obligationSummary: { totalDue: number; paid: number; remaining: number; openCount: number };
}

export interface Obligation {
  _id: string;
  entityId: string;
  totalDue: number;
  paid: number;
  status: 'pending' | 'partial' | 'fulfilled';
}

export interface ObligationWithRemaining extends Obligation {
  remaining: number;
}

export interface PaymentBackAllocation {
  obligationId: string;
  amountApplied: number;
}

export interface PaymentBackResult {
  paymentBack: { _id: string; allocations: PaymentBackAllocation[]; totalAmount: number };
  allocations: PaymentBackAllocation[];
  unallocated: number;
}

export interface PaymentBackRecord {
  _id: string;
  entityId: Entity | string;
  totalAmount: number;
  date: string;
  allocations: { obligationId: Obligation | string; amountApplied: number }[];
}

export function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}
