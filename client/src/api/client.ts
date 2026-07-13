import { FALLBACK_CURRENCY } from "../lib/currencies";

const API = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
  type: "income" | "expense";
}

export interface Transaction {
  _id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  currency?: string;
  memo?: string;
  accountId: Account | string;
  categoryId?: Category | string;
  toAccountId?: Account | string;
  /** Present when this transaction was recorded as a loan inflow/outflow via an entity */
  entityId?: Entity | string;
}

export const api = {
  signup: (data: { email: string; password: string; name?: string }) =>
    request<User>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  me: () => request<User>("/auth/me"),

  updateSettings: (data: {
    defaultCurrency?: string;
    runAutomationsOnImport?: boolean;
    name?: string;
  }) =>
    request<User>("/settings", { method: "PATCH", body: JSON.stringify(data) }),

  previewImport: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/import/preview`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        typeof body.error === "string" ? body.error : "Preview failed",
      );
    }
    return res.json() as Promise<{ jobId: string; preview: ImportPreview }>;
  },

  confirmImport: (jobId: string, runAutomationsOnImport?: boolean) =>
    request<{ imported: number; skipped: number }>("/import/confirm", {
      method: "POST",
      body: JSON.stringify({ jobId, runAutomationsOnImport }),
    }),

  getAccounts: () => request<Account[]>("/accounts"),

  createAccount: (data: {
    name: string;
    balance?: number;
    currency?: string;
  }) =>
    request<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAccount: (
    id: string,
    data: { name?: string; balance?: number; currency?: string },
  ) =>
    request<Account>(`/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteAccount: (id: string) =>
    request<{ ok: boolean }>(`/accounts/${id}`, { method: "DELETE" }),

  getCategories: (type?: string) =>
    request<Category[]>(`/categories${type ? `?type=${type}` : ""}`),

  createCategory: (data: { name: string; type: "income" | "expense" }) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCategory: (
    id: string,
    data: { name?: string; type?: "income" | "expense" },
  ) =>
    request<Category>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/categories/${id}`, { method: "DELETE" }),

  getTransactions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Transaction[]>(`/transactions${qs}`);
  },

  searchTransactions: (query: string) =>
    request<Transaction[]>(`/transactions/search?q=${encodeURIComponent(query)}`),

  createTransaction: (data: {
    type: "income" | "expense" | "transfer";
    amount: number;
    date: string;
    accountId: string;
    categoryId?: string;
    toAccountId?: string;
    entityId?: string;
    currency?: string;
    memo?: string;
  }) =>
    request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteTransaction: (id: string) =>
    request<{ ok: boolean }>(`/transactions/${id}`, { method: "DELETE" }),

  getEntities: (direction?: "i_owe" | "they_owe_me") =>
    request<EntityWithBalances[]>(
      `/entities${direction ? `?direction=${direction}` : ""}`,
    ),

  createEntity: (data: {
    name: string;
    direction: "i_owe" | "they_owe_me";
    currency?: string;
    type?: string;
    notes?: string;
    initialAmount?: number;
  }) =>
    request<Entity>("/entities", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAutomations: () => request<Automation[]>("/automations"),

  createAutomation: (data: {
    name: string;
    percentage: number;
    targetEntityId?: string;
    newEntityName?: string;
    entityType?: string;
    entityCurrency?: string;
  }) =>
    request<Automation>("/automations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAutomation: (
    id: string,
    data: { name?: string; percentage?: number; active?: boolean },
  ) =>
    request<Automation>(`/automations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteAutomation: (id: string) =>
    request<{ ok: boolean }>(`/automations/${id}`, { method: "DELETE" }),

  createLoanTransaction: (data: {
    entityId: string;
    type:
      | "loan_given"
      | "loan_received"
      | "repayment_made"
      | "repayment_received";
    amount: number;
    currency?: string;
    memo?: string;
    accountId?: string;
  }) =>
    request<{ loan: LoanTransaction; balancesByCurrency: CurrencyBalance[] }>(
      "/loans",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  getLoanTransactions: (params?: { from?: string; to?: string; entityId?: string }) => {
    const qs = params ? `?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null) as [string, string][]))}` : "";
    return request<LoanTransaction[]>(`/loans${qs}`);
  },

  getLoanBalances: (direction?: "i_owe" | "they_owe_me") =>
    request<EntityWithBalances[]>(
      `/loans/balances${direction ? `?direction=${direction}` : ""}`,
    ),

  getAllObligations: (params?: { from?: string; to?: string }) => {
    const qs = params ? `?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null) as [string, string][]))}` : "";
    return request<Obligation[]>(`/entities/obligations${qs}`);
  },

  getEntityObligations: (entityId: string) =>
    request<ObligationWithRemaining[]>(`/entities/${entityId}/obligations`),

  getEntityActivity: (entityId: string) =>
    request<{
      entity: Entity;
      activity: EntityActivityItem[];
      summary: {
        byCurrency: Array<
          | { currency: string; remaining: number; totalDue: number; paid: number; openCount: number }
          | { currency: string; balance: number }
        >;
      };
    }>(`/entities/${entityId}/activity`),

  createManualObligation: (
    entityId: string,
    totalDue: number,
    currency?: string,
  ) =>
    request<Obligation>(`/entities/${entityId}/obligations`, {
      method: "POST",
      body: JSON.stringify({ totalDue, currency }),
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
    request<PaymentBackResult>("/payment-backs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPaymentBacks: (entityId?: string) => {
    const qs = entityId ? `?entityId=${entityId}` : "";
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

export interface CurrencyBalance {
  currency: string;
  balance: number;
}

export interface Entity {
  _id: string;
  name: string;
  type: string;
  direction: "i_owe" | "they_owe_me";
  currency: string;
  balancesByCurrency?: CurrencyBalance[];
}

export interface EntityWithBalances extends Entity {
  balancesByCurrency: CurrencyBalance[];
}

/** @deprecated use EntityWithBalances */
export interface EntityWithSummary extends EntityWithBalances {
  obligationSummary?: {
    totalDue: number;
    paid: number;
    remaining: number;
    openCount: number;
  };
}

/** @deprecated use EntityWithBalances */
export interface EntityWithLoanBalance extends EntityWithBalances {
  loanBalance?: number;
}

export interface Automation {
  _id: string;
  name: string;
  percentage: number;
  active: boolean;
  targetEntityId: Entity | string;
}

export interface LoanTransaction {
  _id: string;
  entityId: string | { _id: string; name: string; direction: string };
  type: "loan_given" | "loan_received" | "repayment_made" | "repayment_received";
  amount: number;
  currency: string;
  date: string;
  memo?: string;
}

export interface EntityActivityItem {
  _id: string;
  date: string;
  type: "add" | "pay";
  amount: number;
  currency: string;
  label: string;
  memo?: string;
}

export interface Obligation {
  _id: string;
  entityId: string;
  totalDue: number;
  paid: number;
  currency?: string;
  status: "pending" | "partial" | "fulfilled";
  createdAt?: string;
}

export interface ObligationWithRemaining extends Obligation {
  remaining: number;
}

export interface PaymentBackAllocation {
  obligationId: string;
  amountApplied: number;
}

export interface PaymentBackResult {
  paymentBack: {
    _id: string;
    allocations: PaymentBackAllocation[];
    totalAmount: number;
  };
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

export function formatMoney(cents: number, currency = FALLBACK_CURRENCY) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
