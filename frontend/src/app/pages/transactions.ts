import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService, Transaction } from '../services/data';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="transactions-wrapper animate-fade-in">
      <div class="header-section">
        <div>
          <h2>Transactions Ledger</h2>
          <p class="text-muted">Manage all your manual and automated transaction entries.</p>
        </div>
        <button class="btn btn-primary" (click)="toggleForm()">
          {{ showForm() ? 'Close Form' : 'Add Transaction' }}
        </button>
      </div>

      <!-- Add/Edit Form Panel -->
      @if (showForm()) {
        <div class="glass-card form-panel animate-fade-in">
          <h3>Add New Transaction</h3>
          <form (ngSubmit)="onSubmit()" #txForm="ngForm" class="tx-form">
            <div class="form-grid">
              <div class="form-group">
                <label for="title">Title / Merchant</label>
                <input type="text" id="title" class="form-input" placeholder="e.g. Amazon Purchase" [(ngModel)]="title" name="title" required minlength="3" />
              </div>
              <div class="form-group">
                <label for="amount">Amount (Rs.)</label>
                <input type="number" id="amount" class="form-input" placeholder="0.00" [(ngModel)]="amount" name="amount" required min="0.01" />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label for="category">Category</label>
                <select id="category" class="form-input form-select" [(ngModel)]="category" name="category" required>
                  <option value="Food">Food</option>
                  <option value="Travel">Travel</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Salary">Salary (Income)</option>
                  <option value="Loan">Loan</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label for="type">Type</label>
                <select id="type" class="form-input form-select" [(ngModel)]="type" name="type" required>
                  <option value="expense">Expense</option>
                  <option value="income">Income / Salary</option>
                </select>
              </div>
              <div class="form-group">
                <label for="date">Transaction Date</label>
                <input type="date" id="date" class="form-input" [(ngModel)]="date" name="date" required />
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="txForm.invalid">Record</button>
              <button type="button" class="btn btn-secondary" (click)="toggleForm()">Cancel</button>
            </div>
          </form>
        </div>
      }

      <!-- Filters Panel -->
      <div class="glass-card filters-panel">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" class="form-input" placeholder="Search transactions..." [(ngModel)]="searchKeyword" (ngModelChange)="onFilterChange()" />
        </div>

        <div class="filter-controls">
          <div class="filter-group">
            <span class="filter-label">Type</span>
            <div class="tab-buttons">
              <button class="tab-btn" [class.active]="filterType() === ''" (click)="setFilterType('')">All</button>
              <button class="tab-btn" [class.active]="filterType() === 'income'" (click)="setFilterType('income')">Income</button>
              <button class="tab-btn" [class.active]="filterType() === 'expense'" (click)="setFilterType('expense')">Expense</button>
            </div>
          </div>

          <div class="filter-group">
            <span class="filter-label">Category</span>
            <select class="form-input form-select select-sm" [(ngModel)]="filterCategory" (ngModelChange)="onFilterChange()">
              <option value="">All Categories</option>
              <option value="Food">Food</option>
              <option value="Travel">Travel</option>
              <option value="Shopping">Shopping</option>
              <option value="Utilities">Utilities</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Salary">Salary</option>
              <option value="Loan">Loan</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Transactions List -->
      <div class="glass-card ledger-panel">
        <div class="table-container">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>User</th>
                <th>Category</th>
                <th>Source</th>
                <th>Date</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (tx of transactions(); track tx.id) {
                <tr class="tx-row animate-fade-in">
                  <td>
                    <div class="tx-title-wrapper">
                      <span class="tx-bullet" [class.bg-green]="tx.type === 'income'" [class.bg-rose]="tx.type === 'expense'"></span>
                      <strong>{{ tx.title }}</strong>
                    </div>
                  </td>
                  <td>
                    <span class="user-name-tag">{{ tx.user?.username || 'System' }}</span>
                  </td>
                  <td><span class="badge-category">{{ tx.category }}</span></td>
                  <td>
                    <span class="badge-source" [class]="'source-' + tx.source">{{ tx.source }}</span>
                  </td>
                  <td>{{ tx.date | date:'mediumDate' }}</td>
                  <td class="text-right font-bold" [class.text-income]="tx.type === 'income'" [class.text-expense]="tx.type === 'expense'">
                    {{ tx.type === 'income' ? '+' : '-' }} Rs. {{ tx.amount | number:'1.2-2' }}
                  </td>
                  <td class="text-right">
                    <button class="btn-icon" (click)="deleteTransaction(tx.id)" title="Delete transaction">🗑️</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="no-data">No transactions match your search/filter parameters.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        @if (totalPages() > 1) {
          <div class="pagination-container">
            <button class="btn btn-secondary btn-sm" [disabled]="currentPage() === 1" (click)="goToPage(currentPage() - 1)">
              ◀ Prev
            </button>
            <span class="pagination-info">
              Page <strong>{{ currentPage() }}</strong> of <strong>{{ totalPages() }}</strong> ({{ totalTransactions() }} entries)
            </span>
            <button class="btn btn-secondary btn-sm" [disabled]="currentPage() === totalPages()" (click)="goToPage(currentPage() + 1)">
              Next ▶
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .transactions-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .form-panel {
      padding: 1.75rem;
      border-color: rgba(139, 92, 246, 0.2);
    }
    .tx-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      margin-top: 1rem;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
    }
    .form-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }
    .filters-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2rem;
      padding: 1.25rem 1.5rem;
    }
    @media (max-width: 768px) {
      .filters-panel {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
      }
    }
    .search-box {
      position: relative;
      flex: 1;
    }
    .search-icon {
      position: absolute;
      left: 0.85rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .search-box .form-input {
      padding-left: 2.5rem;
    }
    .filter-controls {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    @media (max-width: 480px) {
      .filter-controls {
        flex-direction: column;
        align-items: stretch;
      }
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .filter-label {
      font-size: 0.85rem;
      color: var(--text-secondary);
      font-family: var(--font-display);
      font-weight: 500;
    }
    .tab-buttons {
      display: flex;
      background: var(--bg-tertiary);
      border: 1px solid var(--card-border);
      padding: 0.2rem;
      border-radius: 8px;
    }
    .tab-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      padding: 0.35rem 0.85rem;
      font-size: 0.85rem;
      font-family: var(--font-display);
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .tab-btn.active {
      background: var(--primary);
      color: white;
    }
    .select-sm {
      min-width: 140px;
      padding: 0.5rem 2rem 0.5rem 1rem;
      font-size: 0.85rem;
    }
    .ledger-panel {
      padding: 0;
      overflow: hidden;
    }
    .table-container {
      width: 100%;
      overflow-x: auto;
    }
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      text-align: left;
    }
    .ledger-table th {
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid var(--card-border);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      background: rgba(255, 255, 255, 0.01);
    }
    .ledger-table td {
      padding: 1.1rem 1.25rem;
      border-bottom: 1px solid var(--card-border);
      vertical-align: middle;
    }
    .tx-row:hover {
      background: rgba(255, 255, 255, 0.01);
    }
    .tx-title-wrapper {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .tx-bullet {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .user-name-tag {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      border: 1px solid var(--card-border);
    }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .badge-category {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.8rem;
    }
    .badge-source {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .source-manual { background: rgba(139, 92, 246, 0.1); color: var(--primary); }
    .source-email { background: rgba(6, 182, 212, 0.1); color: var(--accent-cyan); }
    .source-bill_scan { background: rgba(244, 63, 94, 0.1); color: var(--accent-rose); }
    .source-statement_scan { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    .source-auto { background: rgba(16, 185, 129, 0.1); color: var(--income-green); }
    .btn-icon {
      background: none;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s, transform 0.2s;
    }
    .btn-icon:hover {
      opacity: 1;
      transform: scale(1.15);
    }
    .pagination-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--card-border);
      background: rgba(255, 255, 255, 0.01);
      font-family: var(--font-display);
    }
    .pagination-info {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .btn-sm {
      padding: 0.4rem 0.85rem;
      font-size: 0.8rem;
    }
    .no-data {
      text-align: center;
      padding: 4rem;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    
    /* Responsive columns logic: Hide User, Source, Date on very narrow mobile viewports */
    @media (max-width: 768px) {
      .ledger-table th:nth-child(2), /* User */
      .ledger-table td:nth-child(2),
      .ledger-table th:nth-child(4), /* Source */
      .ledger-table td:nth-child(4),
      .ledger-table th:nth-child(5), /* Date */
      .ledger-table td:nth-child(5) {
        display: none;
      }
    }
  `]
})
export class TransactionsPage implements OnInit {
  private readonly dataService = inject(DataService);

  // States
  readonly transactions = signal<Transaction[]>([]);
  readonly showForm = signal(false);

  // Pagination states
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly totalTransactions = signal(0);
  readonly totalPages = signal(0);

  // Filters
  readonly filterType = signal<string>('');
  filterCategory = '';
  searchKeyword = '';

  // Form Fields
  title = '';
  amount?: number;
  category = 'Food';
  type = 'expense';
  date = new Date().toISOString().substring(0, 10); // format YYYY-MM-DD

  ngOnInit() {
    this.loadTransactions();
  }

  async loadTransactions() {
    try {
      const result = await this.dataService.getTransactions(
        this.filterType(),
        this.filterCategory,
        this.searchKeyword,
        this.currentPage(),
        this.pageSize()
      );
      this.transactions.set(result.transactions);
      this.totalTransactions.set(result.total);
      this.totalPages.set(Math.ceil(result.total / this.pageSize()));
    } catch (err) {
      console.error('Failed to load transactions list', err);
    }
  }

  toggleForm() {
    this.showForm.update(val => !val);
    if (!this.showForm()) {
      this.resetForm();
    }
  }

  resetForm() {
    this.title = '';
    this.amount = undefined;
    this.category = 'Food';
    this.type = 'expense';
    this.date = new Date().toISOString().substring(0, 10);
  }

  setFilterType(t: string) {
    this.filterType.set(t);
    this.currentPage.set(1);
    this.loadTransactions();
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.loadTransactions();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadTransactions();
  }

  async onSubmit() {
    if (!this.title || !this.amount || !this.date) return;

    try {
      await this.dataService.createTransaction({
        title: this.title,
        amount: this.amount,
        category: this.category,
        type: this.type as 'expense' | 'income',
        date: new Date(this.date).toISOString()
      });

      this.toggleForm();
      this.currentPage.set(1); // Go back to first page to see the new transaction
      await this.loadTransactions();
    } catch (err) {
      console.error('Failed to register transaction', err);
    }
  }

  async deleteTransaction(id: number) {
    if (!confirm('Are you sure you want to delete this transaction record?')) return;

    try {
      await this.dataService.deleteTransaction(id);
      await this.loadTransactions();
    } catch (err) {
      console.error('Failed to delete transaction', err);
    }
  }
}

