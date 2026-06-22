import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService, DashboardStats, Transaction } from '../services/data';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-wrapper animate-fade-in">
      
      <!-- PWA Push Subscription Banner -->
      @if (showPushBanner()) {
        <div class="push-banner glass-card">
          <div class="push-banner-content">
            <span class="banner-icon">🔔</span>
            <div>
              <h4>Real-time Alerts</h4>
              <p>Enable push notifications to get alerted when expenses are added automatically from your emails.</p>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" (click)="subscribeToPush()" [disabled]="isPushLoading()">
            {{ isPushLoading() ? 'Enabling...' : 'Enable Notifications' }}
          </button>
        </div>
      }

      <div class="header-section">
        <div>
          <h2>Welcome back, {{ auth.currentUser() }}!</h2>
          <p class="text-muted">Here is your financial status overview.</p>
        </div>
        <div class="header-actions">
          <span class="badge" [class.badge-income]="auth.currentUserRole() === 'admin'">
            Role: {{ auth.currentUserRole() }}
          </span>
        </div>
      </div>

      <!-- Financial Metrics Summary -->
      <div class="metrics-grid">
        <div class="glass-card metric-card">
          <div class="metric-info">
            <p class="metric-label">Total Balance</p>
            <h3 class="balance-amount" [class.text-income]="stats().balance >= 0" [class.text-expense]="stats().balance < 0">
              Rs. {{ stats().balance | number:'1.2-2' }}
            </h3>
          </div>
          <span class="metric-icon bg-cyan">💼</span>
        </div>

        <div class="glass-card metric-card">
          <div class="metric-info">
            <p class="metric-label">Total Income</p>
            <h3 class="metric-val text-income">
              Rs. {{ stats().total_income | number:'1.2-2' }}
            </h3>
          </div>
          <span class="metric-icon bg-green">📈</span>
        </div>

        <div class="glass-card metric-card">
          <div class="metric-info">
            <p class="metric-label">Total Expenses</p>
            <h3 class="metric-val text-expense">
              Rs. {{ stats().total_expense | number:'1.2-2' }}
            </h3>
          </div>
          <span class="metric-icon bg-rose">📉</span>
        </div>
      </div>

      <!-- Quick Add & Charts Section -->
      <div class="dashboard-grid">
        
        <!-- Left Side: Custom SVG Trend Chart -->
        <div class="glass-card chart-container">
          <div class="card-header">
            <h3>Monthly Cash Flow</h3>
            <p class="text-muted">Income vs Expense trends over last 6 months</p>
          </div>
          <div class="chart-body">
            @if (stats().monthly_trends.length > 0) {
              <!-- Custom Responsive SVG Line Chart -->
              <svg viewBox="0 0 600 240" class="svg-chart">
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--income-green)" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="var(--income-green)" stop-opacity="0.0"/>
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--expense-red)" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="var(--expense-red)" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>

                <!-- Grid Lines -->
                <line x1="40" y1="20" x2="560" y2="20" stroke="rgba(255,255,255,0.05)" />
                <line x1="40" y1="80" x2="560" y2="80" stroke="rgba(255,255,255,0.05)" />
                <line x1="40" y1="140" x2="560" y2="140" stroke="rgba(255,255,255,0.05)" />
                <line x1="40" y1="200" x2="560" y2="200" stroke="rgba(255,255,255,0.1)" />

                <!-- Chart Paths (Cubic Bezier curve mapping) -->
                <!-- Income Path -->
                <path [attr.d]="incomePath()" fill="url(#incomeGrad)" />
                <path [attr.d]="incomeLinePath()" fill="none" stroke="var(--income-green)" stroke-width="3" />
                
                <!-- Expense Path -->
                <path [attr.d]="expensePath()" fill="url(#expenseGrad)" />
                <path [attr.d]="expenseLinePath()" fill="none" stroke="var(--expense-red)" stroke-width="3" />

                <!-- Data points -->
                @for (pt of chartPoints(); track $index) {
                  <!-- Income Dot -->
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.incY" r="4" fill="#fff" stroke="var(--income-green)" stroke-width="2" />
                  <!-- Expense Dot -->
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.expY" r="4" fill="#fff" stroke="var(--expense-red)" stroke-width="2" />
                  <!-- Month Label -->
                  <text [attr.x]="pt.x" y="222" font-size="10" fill="var(--text-secondary)" text-anchor="middle">
                    {{ pt.label }}
                  </text>
                }
              </svg>
            } @else {
              <div class="no-data">No history available yet.</div>
            }
          </div>
          <!-- Legend -->
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-dot bg-green"></span> Income</span>
            <span class="legend-item"><span class="legend-dot bg-rose"></span> Expense</span>
          </div>
        </div>

        <!-- Right Side: Category Breakdown & Quick Entry -->
        <div class="dashboard-side-grid">
          
          <!-- Category Breakdown Progress Cards -->
          <div class="glass-card">
            <h3>Expense by Category</h3>
            <div class="category-list">
              @for (cat of stats().categories; track cat.category) {
                <div class="category-item">
                  <div class="category-info">
                    <span>{{ cat.category }}</span>
                    <span>Rs. {{ cat.amount | number:'1.2-2' }}</span>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" [style.width.%]="getCategoryPercentage(cat.amount)" [style.background]="getCategoryColor(cat.category)"></div>
                  </div>
                </div>
              } @empty {
                <div class="no-data">No expense distributions recorded.</div>
              }
            </div>
          </div>

          <!-- Quick Transaction Entry -->
          <div class="glass-card">
            <h3>Quick Transaction</h3>
            <form (ngSubmit)="submitQuickTransaction()" class="quick-form">
              <div class="form-row">
                <input type="text" class="form-input" placeholder="Title (e.g. Starbucks)" [(ngModel)]="quickTitle" name="title" required />
                <input type="number" class="form-input" placeholder="Amount" [(ngModel)]="quickAmount" name="amount" required min="1" />
              </div>
              <div class="form-row">
                <select class="form-input form-select" [(ngModel)]="quickCategory" name="category" required>
                  <option value="Food">Food</option>
                  <option value="Travel">Travel</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Salary">Salary (Income)</option>
                  <option value="Loan">Loan EMI</option>
                  <option value="Other">Other</option>
                </select>
                <select class="form-input form-select" [(ngModel)]="quickType" name="type" required>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <button type="submit" class="btn btn-primary btn-sm w-full">Record Transaction</button>
            </form>
          </div>
        </div>
      </div>

      <!-- Recent Transactions Section -->
      <div class="recent-section glass-card">
        <div class="recent-header">
          <h3>Recent Activity</h3>
          <button class="btn btn-secondary btn-sm" (click)="viewAllTransactions()">View All</button>
        </div>
        
        <div class="table-container">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Source</th>
                <th>Date</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (tx of stats().recent_transactions; track tx.id) {
                <tr>
                  <td>
                    <div class="tx-title-wrapper">
                      <span class="tx-bullet" [class.bg-green]="tx.type === 'income'" [class.bg-rose]="tx.type === 'expense'"></span>
                      <strong>{{ tx.title }}</strong>
                    </div>
                  </td>
                  <td><span class="badge-category">{{ tx.category }}</span></td>
                  <td>
                    <span class="badge-source" [class]="'source-' + tx.source">{{ tx.source }}</span>
                  </td>
                  <td>{{ tx.date | date:'mediumDate' }}</td>
                  <td class="text-right font-bold" [class.text-income]="tx.type === 'income'" [class.text-expense]="tx.type === 'expense'">
                    {{ tx.type === 'income' ? '+' : '-' }} Rs. {{ tx.amount | number:'1.2-2' }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="no-data">No transactions added yet. Try quick add!</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .push-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-color: var(--primary);
      background: linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(18, 24, 36, 0.7) 100%);
      padding: 1rem 1.5rem;
      animation: pulseBorder 3s infinite;
    }
    @keyframes pulseBorder {
      0%, 100% { border-color: rgba(139, 92, 246, 0.3); }
      50% { border-color: var(--primary); }
    }
    .push-banner-content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .banner-icon {
      font-size: 1.75rem;
    }
    .push-banner h4 {
      font-size: 1rem;
      margin-bottom: 0.15rem;
    }
    .push-banner p {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .btn-sm {
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }
    .metric-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.75rem;
    }
    .metric-label {
      font-size: 0.85rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .metric-val {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 700;
    }
    .metric-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      font-size: 1.5rem;
    }
    .bg-cyan { background: rgba(6, 182, 212, 0.1); color: var(--accent-cyan); }
    .bg-green { background: rgba(16, 185, 129, 0.1); color: var(--income-green); }
    .bg-rose { background: rgba(239, 68, 68, 0.1); color: var(--expense-red); }
    
    .dashboard-grid {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 1.5rem;
    }
    @media (max-width: 900px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }
    .dashboard-side-grid {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .chart-container {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .chart-body {
      padding: 1.5rem 0;
      position: relative;
    }
    .svg-chart {
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .chart-legend {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-top: 0.5rem;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .no-data {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .category-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1rem;
    }
    .category-item {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .category-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .progress-bar-bg {
      height: 6px;
      background: var(--bg-tertiary);
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.8s ease;
    }
    .quick-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .recent-section {
      padding: 1.5rem;
    }
    .recent-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .table-container {
      width: 100%;
      overflow-x: auto;
    }
    .recent-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      text-align: left;
    }
    .recent-table th {
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--card-border);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    .recent-table td {
      padding: 1rem;
      border-bottom: 1px solid var(--card-border);
      vertical-align: middle;
    }
    .recent-table tr:last-child td {
      border-bottom: none;
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
  `]
})
export class DashboardPage implements OnInit {
  private readonly dataService = inject(DataService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // States
  readonly stats = signal<DashboardStats>({
    balance: 0,
    total_income: 0,
    total_expense: 0,
    categories: [],
    monthly_trends: [],
    recent_transactions: []
  });
  
  readonly showPushBanner = signal(false);
  readonly isPushLoading = signal(false);

  // Form Fields
  quickTitle = '';
  quickAmount?: number;
  quickCategory = 'Food';
  quickType = 'expense';

  ngOnInit() {
    this.loadStats();
    this.checkNotificationStatus();
  }

  async loadStats() {
    try {
      const s = await this.dataService.getDashboardStats();
      this.stats.set(s);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    }
  }

  checkNotificationStatus() {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        this.showPushBanner.set(true);
      }
    }
  }

  async subscribeToPush() {
    this.isPushLoading.set(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Fetch VAPID key
        const { public_key } = await this.dataService.getVapidKey();
        
        // Register SW Subscription
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(public_key)
        });

        // Send to Go backend
        await this.dataService.registerPushSubscription(subscription);
        this.showPushBanner.set(false);
      } else {
        console.warn('Notification permission denied.');
      }
    } catch (err) {
      console.error('Failed to subscribe to push notifications', err);
    } finally {
      this.isPushLoading.set(false);
    }
  }

  private urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async submitQuickTransaction() {
    if (!this.quickTitle || !this.quickAmount) return;

    try {
      await this.dataService.createTransaction({
        title: this.quickTitle,
        amount: this.quickAmount,
        category: this.quickCategory,
        type: this.quickType as 'expense' | 'income',
        date: new Date().toISOString()
      });
      
      // Reset form
      this.quickTitle = '';
      this.quickAmount = undefined;
      
      // Refresh stats
      await this.loadStats();
    } catch (err) {
      console.error('Failed to add transaction', err);
    }
  }

  viewAllTransactions() {
    this.router.navigate(['/transactions']);
  }

  getCategoryPercentage(amount: number): number {
    const total = this.stats().total_expense;
    if (total === 0) return 0;
    return (amount / total) * 100;
  }

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'Food': 'var(--accent-rose)',
      'Travel': 'var(--accent-cyan)',
      'Shopping': 'var(--primary)',
      'Utilities': '#eab308',
      'Entertainment': '#ec4899',
      'Other': 'var(--text-muted)'
    };
    return colors[category] || 'var(--primary)';
  }

  // --- SVG Path Calculators ---
  // Coordinates mapping
  chartPoints = computed(() => {
    const trends = this.stats().monthly_trends;
    if (trends.length === 0) return [];
    
    const count = trends.length;
    const paddingLeft = 60;
    const paddingRight = 40;
    const width = 600 - paddingLeft - paddingRight;
    const xStep = count > 1 ? width / (count - 1) : width;

    // Find max value for scaling
    let maxVal = 1000.0;
    for (const t of trends) {
      if (t.income > maxVal) maxVal = t.income;
      if (t.expense > maxVal) maxVal = t.expense;
    }
    // Add 15% buffer
    maxVal = maxVal * 1.15;

    return trends.map((t, idx) => {
      const x = paddingLeft + idx * xStep;
      // Chart height is 240, plotting area Y from 20 to 200 (180px height)
      const incY = 200 - (t.income / maxVal) * 180;
      const expY = 200 - (t.expense / maxVal) * 180;
      return {
        x,
        incY,
        expY,
        label: t.month
      };
    });
  });

  // Calculate SVG line paths using smooth cubic curves
  incomeLinePath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    return this.getCurvePath(pts.map(p => ({ x: p.x, y: p.incY })));
  });

  incomePath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    const line = this.incomeLinePath();
    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    return `${line} L ${lastX} 200 L ${firstX} 200 Z`;
  });

  expenseLinePath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    return this.getCurvePath(pts.map(p => ({ x: p.x, y: p.expY })));
  });

  expensePath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    const line = this.expenseLinePath();
    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    return `${line} L ${lastX} 200 L ${firstX} 200 Z`;
  });

  // Basic Bezier curve generator
  private getCurvePath(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }
}
