import { Injectable, inject } from '@angular/core';
import { ApiService } from './api';

export interface Transaction {
  id: number;
  user_id: number;
  user?: UserAccount;
  title: string;
  amount: number;
  category: string;
  type: 'expense' | 'income';
  date: string;
  source: 'manual' | 'email' | 'bill_scan' | 'statement_scan' | 'auto';
  is_recurring: boolean;
  recurring_rule_id?: number;
  created_at: string;
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface RecurringRule {
  id: number;
  user_id: number;
  title: string;
  amount: number;
  category: string;
  type: 'expense' | 'income';
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  last_run: string;
  is_active: boolean;
  created_at: string;
}

export interface DashboardStats {
  balance: number;
  total_income: number;
  total_expense: number;
  categories: Array<{ category: string; amount: number }>;
  monthly_trends: Array<{ month: string; income: number; expense: number }>;
  recent_transactions: Transaction[];
}

export interface ParsedStatementLine {
  date: string;
  title: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
}

export interface ParsedStatement {
  account_name: string;
  period_start?: string;
  period_end?: string;
  lines: ParsedStatementLine[];
}

export interface UserAccount {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly api = inject(ApiService);

  // --- Transactions API ---
  getDashboardStats(userId?: number): Promise<DashboardStats> {
    const query = userId ? `?user_id=${userId}` : '';
    return this.api.get<DashboardStats>(`/dashboard/stats${query}`);
  }

  getTransactions(type?: string, category?: string, search?: string, page: number = 1, limit: number = 10, userId?: number): Promise<PaginatedTransactions> {
    let query = '';
    const params: string[] = [];
    if (type) params.push(`type=${type}`);
    if (category) params.push(`category=${category}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (userId) params.push(`user_id=${userId}`);
    params.push(`page=${page}`);
    params.push(`limit=${limit}`);
    
    if (params.length > 0) {
      query = `?${params.join('&')}`;
    }
    return this.api.get<PaginatedTransactions>(`/transactions${query}`);
  }

  createTransaction(tx: Omit<Transaction, 'id' | 'user_id' | 'source' | 'is_recurring' | 'created_at'>): Promise<Transaction> {
    return this.api.post<Transaction>('/transactions', tx);
  }

  createTransactionsBulk(
    transactions: Array<Omit<Transaction, 'id' | 'user_id' | 'source' | 'is_recurring' | 'created_at'>>,
    source: Transaction['source'] = 'statement_scan'
  ): Promise<{ added_count: number; skipped_count: number; transactions: Transaction[] }> {
    return this.api.post<{ added_count: number; skipped_count: number; transactions: Transaction[] }>(
      '/transactions/bulk',
      { source, transactions }
    );
  }

  updateTransaction(id: number, tx: Partial<Transaction>): Promise<Transaction> {
    return this.api.put<Transaction>(`/transactions/${id}`, tx);
  }

  deleteTransaction(id: number): Promise<{ message: string }> {
    return this.api.delete<{ message: string }>(`/transactions/${id}`);
  }

  // --- Recurring Rules API ---
  getRecurringRules(): Promise<RecurringRule[]> {
    return this.api.get<RecurringRule[]>('/recurring');
  }

  createRecurringRule(rule: Omit<RecurringRule, 'id' | 'user_id' | 'last_run' | 'is_active' | 'created_at'>): Promise<RecurringRule> {
    return this.api.post<RecurringRule>('/recurring', rule);
  }

  updateRecurringRule(id: number, rule: Partial<RecurringRule>): Promise<RecurringRule> {
    return this.api.put<RecurringRule>(`/recurring/${id}`, rule);
  }

  deleteRecurringRule(id: number): Promise<{ message: string }> {
    return this.api.delete<{ message: string }>(`/recurring/${id}`);
  }

  // --- Web Push API ---
  getVapidKey(): Promise<{ public_key: string }> {
    return this.api.get<{ public_key: string }>('/notifications/vapid-key');
  }

  registerPushSubscription(subscription: any): Promise<{ message: string }> {
    return this.api.post<{ message: string }>('/notifications/subscribe', subscription);
  }

  // --- Email Sync API ---
  getMailConfig(): Promise<any> {
    return this.api.get<any>('/mail/config');
  }

  saveMailConfig(config: any): Promise<{ message: string }> {
    return this.api.post<{ message: string }>('/mail/config', config);
  }

  toggleMailConfigActive(isActive: boolean): Promise<any> {
    return this.api.put<any>('/mail/config/active', { is_active: isActive });
  }

  syncMail(): Promise<{ message: string; added_count: number }> {
    return this.api.post<{ message: string; added_count: number }>('/mail/sync', {});
  }

  // --- Bill Scanner API ---
  parseBillText(text: string): Promise<any> {
    return this.api.post<any>('/bills/parse', { text });
  }

  parseBillFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('bill', file);
    return this.api.postMultipart<any>('/bills/parse', formData);
  }

  // --- Bank Statement Scanner API ---
  parseStatementText(text: string): Promise<ParsedStatement> {
    return this.api.post<ParsedStatement>('/statements/parse', { text });
  }

  parseStatementFile(file: File): Promise<ParsedStatement> {
    const formData = new FormData();
    formData.append('statement', file);
    return this.api.postMultipart<ParsedStatement>('/statements/parse', formData);
  }

  // --- Users API ---
  getUsersList(): Promise<Array<{ id: number; username: string }>> {
    return this.api.get<Array<{ id: number; username: string }>>('/users');
  }

  // --- Admin API ---
  getUsers(): Promise<UserAccount[]> {
    return this.api.get<UserAccount[]>('/admin/users');
  }

  updateUserRole(id: number, role: 'admin' | 'user'): Promise<UserAccount> {
    return this.api.put<UserAccount>(`/admin/users/${id}/role`, { role });
  }

  deleteUser(id: number): Promise<{ message: string }> {
    return this.api.delete<{ message: string }>(`/admin/users/${id}`);
  }

  adminCreateUser(user: any): Promise<UserAccount> {
    return this.api.post<UserAccount>('/admin/users', user);
  }

  // --- Profile API ---
  getProfile(): Promise<{ username: string; email: string; role: string }> {
    return this.api.get<{ username: string; email: string; role: string }>('/profile');
  }

  updateProfile(username: string, email: string, previousPassword: string, newPassword?: string): Promise<{ message: string; email: string; username: string }> {
    return this.api.put<{ message: string; email: string; username: string }>('/profile', {
      username,
      email,
      previous_password: previousPassword,
      new_password: newPassword || undefined
    });
  }
}
