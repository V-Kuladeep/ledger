export type TransactionType = 'credit' | 'debit';

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
  type: TransactionType;
  amount: number;
  description: string | null;
  reference_id: string;
  created_at: string;
}

export interface Transfer {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  reference_id: string;
  description: string | null;
  debit_transaction_id: string;
  credit_transaction_id: string;
  created_at: string;
}

export interface CreateAccountDTO {
  name: string;
}

export interface CreateTransactionDTO {
  account_id?: string;
  type: TransactionType;
  amount: number;
  description?: string;
  reference_id: string;
}

export interface CreateTransferDTO {
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  description?: string;
  reference_id: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface TransactionHistoryQuery extends PaginationParams {
  type?: TransactionType;
}

export interface PaginationMetadata {
  current_page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMetadata;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
