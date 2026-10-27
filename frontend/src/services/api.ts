const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface Account {
  id: string;
  name: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string | null;
  reference_id: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    current_page: number;
    page_size: number;
    total_records: number;
    total_pages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
    const err: any = new Error(errorMsg);
    err.code = json?.error?.code || 'UNKNOWN_ERROR';
    err.details = json?.error?.details;
    err.status = res.status;
    throw err;
  }

  return json.data;
}

export const api = {
  checkHealth: async () => {
    return request<{ status: string; timestamp: string }>('/health');
  },

  getAccounts: async (page = 1, limit = 50) => {
    return request<PaginatedResponse<Account>>(`/accounts?page=${page}&limit=${limit}`);
  },

  getAccountById: async (id: string) => {
    return request<Account>(`/accounts/${id}`);
  },

  getAccountBalance: async (id: string) => {
    return request<{ account_id: string; balance: number; name: string }>(`/accounts/${id}/balance`);
  },

  createAccount: async (name: string) => {
    return request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  addTransaction: async (data: {
    account_id: string;
    type: 'credit' | 'debit';
    amount: number;
    description?: string;
    reference_id: string;
  }) => {
    return request<{ transaction: Transaction; new_balance: number }>(
      `/accounts/${data.account_id}/transactions`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  getTransactions: async (
    accountId: string,
    params: { page?: number; limit?: number; type?: 'credit' | 'debit' } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.type) query.set('type', params.type);

    return request<PaginatedResponse<Transaction>>(
      `/accounts/${accountId}/transactions?${query.toString()}`
    );
  },

  verifyIntegrity: async (accountId: string) => {
    return request<{
      account_id: string;
      stored_balance: number;
      calculated_balance: number;
      consistent: boolean;
    }>(`/accounts/${accountId}/verify-integrity`);
  },

  createTransfer: async (data: {
    source_account_id: string;
    destination_account_id: string;
    amount: number;
    description?: string;
    reference_id: string;
  }) => {
    return request<{
      transfer: any;
      source_new_balance: number;
      destination_new_balance: number;
    }>('/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  seedData: async () => {
    return request<{ accounts_created: Account[] }>('/seed', {
      method: 'POST',
    });
  },
};
