import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService, RecurringRule } from '../services/data';

@Component({
  selector: 'app-recurring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="recurring-wrapper animate-fade-in">
      <div class="header-section">
        <div>
          <h2>Recurring Transaction Scheduler</h2>
          <p class="text-muted">Set up automated cash flows (e.g. Salary deposits, Loan EMIs, or Utility subscriptions).</p>
        </div>
        <button class="btn btn-primary" (click)="toggleForm()">
          {{ showForm() ? 'Close Form' : 'Create Auto-Rule' }}
        </button>
      </div>

      <!-- Add Rule Form Panel -->
      @if (showForm()) {
        <div class="glass-card form-panel animate-fade-in">
          <h3>Create Auto-Transaction Rule</h3>
          <form (ngSubmit)="onSubmit()" #ruleForm="ngForm" class="rule-form">
            <div class="form-grid">
              <div class="form-group">
                <label for="title">Rule Title / Description</label>
                <input type="text" id="title" class="form-input" placeholder="e.g. Monthly Salary or Home Loan EMI" [(ngModel)]="title" name="title" required minlength="3" />
              </div>
              <div class="form-group">
                <label for="amount">Amount (Rs.)</label>
                <input type="number" id="amount" class="form-input" placeholder="0.00" [(ngModel)]="amount" name="amount" required min="0.1" />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label for="category">Category</label>
                <select id="category" class="form-input form-select" [(ngModel)]="category" name="category" required>
                  <option value="Salary">Salary (Income)</option>
                  <option value="Loan">Loan EMI (Expense)</option>
                  <option value="Food">Food</option>
                  <option value="Travel">Travel</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label for="type">Transaction Type</label>
                <select id="type" class="form-input form-select" [(ngModel)]="type" name="type" required>
                  <option value="income">Income (Deposits)</option>
                  <option value="expense">Expense (Payments)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="frequency">Interval Frequency</label>
                <select id="frequency" class="form-input form-select" [(ngModel)]="frequency" name="frequency" required>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="ruleForm.invalid">Save Rule</button>
              <button type="button" class="btn btn-secondary" (click)="toggleForm()">Cancel</button>
            </div>
          </form>
        </div>
      }

      <!-- List of Active / Inactive Rules -->
      <div class="rules-grid">
        @for (rule of rules(); track rule.id) {
          <div class="glass-card rule-card" [class.rule-inactive]="!rule.is_active">
            <div class="rule-card-header">
              <span class="frequency-tag">{{ rule.frequency }}</span>
              <div class="toggle-switch">
                <input type="checkbox" id="toggle-{{rule.id}}" [checked]="rule.is_active" (change)="toggleRuleActive(rule)" />
                <label for="toggle-{{rule.id}}"></label>
              </div>
            </div>

            <div class="rule-card-body">
              <h4 class="rule-title">{{ rule.title }}</h4>
              <p class="rule-category">Category: <strong>{{ rule.category }}</strong></p>
              
              <h2 class="rule-amount" [class.text-income]="rule.type === 'income'" [class.text-expense]="rule.type === 'expense'">
                {{ rule.type === 'income' ? '+' : '-' }} Rs. {{ rule.amount | number:'1.2-2' }}
              </h2>
            </div>

            <div class="rule-card-footer">
              <span class="last-run">
                Last Run: {{ rule.last_run ? (rule.last_run | date:'mediumDate') : 'Never' }}
              </span>
              <button class="btn-delete" (click)="deleteRule(rule.id)" title="Remove recurring rule">
                Delete
              </button>
            </div>
          </div>
        } @empty {
          <div class="glass-card no-rules">
            <span class="no-rules-icon">📅</span>
            <h3>No Scheduler Rules Set</h3>
            <p>Define recurring templates above. The system will auto-record transactions and push alert notifications when due.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .recurring-wrapper {
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
    .rule-form {
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
    .rules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    .rule-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.5rem;
      position: relative;
    }
    .rule-inactive {
      opacity: 0.5;
      border-style: dashed;
    }
    .rule-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .frequency-tag {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      border: 1px solid var(--card-border);
    }
    .rule-title {
      font-size: 1.15rem;
      margin-bottom: 0.25rem;
      font-family: var(--font-display);
    }
    .rule-category {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
    }
    .rule-amount {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
    }
    .rule-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.5rem;
      border-top: 1px solid var(--card-border);
      padding-top: 0.75rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .btn-delete {
      background: none;
      border: none;
      color: var(--expense-red);
      font-weight: 600;
      cursor: pointer;
      font-size: 0.8rem;
      transition: opacity 0.2s;
    }
    .btn-delete:hover {
      opacity: 0.8;
      text-decoration: underline;
    }
    .no-rules {
      grid-column: 1 / -1;
      text-align: center;
      padding: 4rem 2rem;
    }
    .no-rules-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      display: inline-block;
    }
    .no-rules h3 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    .no-rules p {
      color: var(--text-muted);
      font-size: 0.9rem;
      max-width: 450px;
      margin: 0 auto;
    }

    /* Toggle Switch Style */
    .toggle-switch {
      position: relative;
      width: 44px;
      height: 22px;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-switch label {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--card-border);
      transition: .3s;
      border-radius: 34px;
    }
    .toggle-switch label:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background-color: var(--text-secondary);
      transition: .3s;
      border-radius: 50%;
    }
    .toggle-switch input:checked + label {
      background-color: var(--primary);
      border-color: var(--primary);
    }
    .toggle-switch input:checked + label:before {
      transform: translateX(22px);
      background-color: white;
    }
  `]
})
export class RecurringPage implements OnInit {
  private readonly dataService = inject(DataService);

  // States
  readonly rules = signal<RecurringRule[]>([]);
  readonly showForm = signal(false);

  // Form Fields
  title = '';
  amount?: number;
  category = 'Salary';
  type = 'income';
  frequency = 'monthly';

  ngOnInit() {
    this.loadRules();
  }

  async loadRules() {
    try {
      const rs = await this.dataService.getRecurringRules();
      this.rules.set(rs);
    } catch (err) {
      console.error('Failed to load scheduler rules', err);
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
    this.category = 'Salary';
    this.type = 'income';
    this.frequency = 'monthly';
  }

  async onSubmit() {
    if (!this.title || !this.amount) return;

    try {
      await this.dataService.createRecurringRule({
        title: this.title,
        amount: this.amount,
        category: this.category,
        type: this.type as 'expense' | 'income',
        frequency: this.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly'
      });

      this.toggleForm();
      await this.loadRules();
    } catch (err) {
      console.error('Failed to save scheduler rule', err);
    }
  }

  async toggleRuleActive(rule: RecurringRule) {
    const nextActive = !rule.is_active;
    try {
      await this.dataService.updateRecurringRule(rule.id, { is_active: nextActive });
      await this.loadRules();
    } catch (err) {
      console.error('Failed to toggle scheduler status', err);
    }
  }

  async deleteRule(id: number) {
    if (!confirm('Are you sure you want to delete this automated schedule? This will stop future executions.')) return;

    try {
      await this.dataService.deleteRecurringRule(id);
      await this.loadRules();
    } catch (err) {
      console.error('Failed to delete recurring rule', err);
    }
  }
}
