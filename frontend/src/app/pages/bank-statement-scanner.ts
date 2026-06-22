import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService, ParsedStatementLine } from '../services/data';

interface EditableLine extends ParsedStatementLine {
  selected: boolean;
  dateInput: string;
}

@Component({
  selector: 'app-bank-statement-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="statement-scanner-wrapper animate-fade-in">
      <div class="header-section">
        <div>
          <h2>Bank Statement Scanner</h2>
          <p class="text-muted">Upload or paste a bank statement to extract transactions and import them in bulk.</p>
        </div>
      </div>

      <div class="scanner-grid">
        <div class="glass-card scanner-controls">
          <div class="tabs">
            <button class="tab-btn" [class.active]="activeTab() === 'upload'" (click)="setTab('upload')">
              📄 Upload Statement
            </button>
            <button class="tab-btn" [class.active]="activeTab() === 'paste'" (click)="setTab('paste')">
              📋 Paste Statement Text
            </button>
          </div>

          @if (activeTab() === 'upload') {
            <div class="upload-area" (dragover)="onDragOver($event)" (drop)="onDrop($event)" (click)="fileInput.click()">
              <input type="file" #fileInput style="display: none" (change)="onFileSelected($event)" accept="image/*,.txt,.csv,.pdf,application/pdf" />
              <span class="upload-icon">🏦</span>
              <h4>Drag & drop bank statement PDF, CSV, or image here</h4>
              <p class="text-muted">Supports PDF, CSV, TXT, PNG, and JPG files</p>

              @if (selectedFileName()) {
                <div class="file-name-indicator badge">
                  📄 {{ selectedFileName() }}
                </div>
              }
            </div>
          }

          @if (activeTab() === 'paste') {
            <div class="paste-area">
              <label for="paste-text" class="sr-only">Statement Content</label>
              <textarea
                id="paste-text"
                class="form-input text-area"
                placeholder="Paste bank statement text here...&#10;e.g.&#10;01-06-2026 UPI/SWIGGY FOOD 450.00 12,345.67&#10;02-06-2026 NEFT SALARY CREDIT 75,000.00 87,345.67"
                [(ngModel)]="pastedText"
                rows="10"
              ></textarea>
              <button class="btn btn-primary w-full" [disabled]="!pastedText.trim() || isParsing()" (click)="parsePastedText()">
                {{ isParsing() ? 'Parsing Statement...' : 'Parse Statement Text' }}
              </button>
            </div>
          }

          @if (isParsing() && activeTab() === 'upload') {
            <div class="ocr-progress">
              <div class="spinner"></div>
              <div>
                <h4>Scanning statement...</h4>
                <p class="text-muted">Extracting transaction lines from the document.</p>
              </div>
            </div>
          }
        </div>

        <div class="glass-card result-panel">
          <h3>Import Preview</h3>
          <p class="text-muted card-sub">Review extracted lines, edit as needed, and import selected transactions.</p>

          @if (accountName()) {
            <div class="statement-meta">
              <span class="badge">{{ accountName() }}</span>
              @if (lineCount() > 0) {
                <span class="text-muted">{{ selectedCount() }} of {{ lineCount() }} selected</span>
              }
            </div>
          }

          @if (editableLines().length > 0) {
            <div class="table-actions">
              <button type="button" class="btn btn-secondary btn-sm" (click)="selectAll()">Select All</button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="selectNone()">Select None</button>
            </div>

            <div class="lines-table-wrap">
              <table class="lines-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of editableLines(); track $index) {
                    <tr [class.selected-row]="line.selected">
                      <td>
                        <input type="checkbox" [(ngModel)]="line.selected" [name]="'sel-' + $index" />
                      </td>
                      <td>
                        <input type="date" class="form-input table-input" [(ngModel)]="line.dateInput" [name]="'date-' + $index" />
                      </td>
                      <td>
                        <input type="text" class="form-input table-input" [(ngModel)]="line.title" [name]="'title-' + $index" />
                      </td>
                      <td>
                        <input type="number" class="form-input table-input amount-input" [(ngModel)]="line.amount" [name]="'amount-' + $index" min="0.01" />
                      </td>
                      <td>
                        <select class="form-input form-select table-input" [(ngModel)]="line.type" [name]="'type-' + $index">
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      </td>
                      <td>
                        <select class="form-input form-select table-input" [(ngModel)]="line.category" [name]="'cat-' + $index">
                          <option value="Food">Food</option>
                          <option value="Travel">Travel</option>
                          <option value="Shopping">Shopping</option>
                          <option value="Utilities">Utilities</option>
                          <option value="Entertainment">Entertainment</option>
                          <option value="Salary">Salary</option>
                          <option value="Loan">Loan</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <button
              type="button"
              class="btn btn-primary w-full submit-btn"
              [disabled]="selectedCount() === 0 || isSaving()"
              (click)="saveSelectedTransactions()"
            >
              {{ isSaving() ? 'Importing...' : 'Import ' + selectedCount() + ' Transaction(s)' }}
            </button>
          } @else {
            <div class="no-result">
              <span class="no-result-icon">🏦</span>
              <p>Upload a bank statement or paste statement text on the left to preview transactions for import.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .statement-scanner-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .scanner-grid {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 1.5rem;
    }
    @media (max-width: 1000px) {
      .scanner-grid {
        grid-template-columns: 1fr;
      }
    }
    .scanner-controls {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      min-width: 0;
    }
    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--bg-secondary);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 0.25rem;
    }
    .tab-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      padding: 0.6rem;
      font-size: 0.9rem;
      font-family: var(--font-display);
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn.active {
      background: var(--bg-tertiary);
      color: white;
      box-shadow: var(--shadow-sm);
    }
    .upload-area {
      border: 2px dashed var(--card-border);
      border-radius: 12px;
      padding: 3rem 1.5rem;
      text-align: center;
      cursor: pointer;
      background: rgba(255,255,255,0.01);
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      box-sizing: border-box;
    }
    .upload-area:hover {
      border-color: var(--primary);
      background: rgba(139, 92, 246, 0.02);
    }
    .upload-icon {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    .file-name-indicator {
      margin-top: 1rem;
      background: rgba(139,92,246,0.1);
      color: var(--primary);
      border: 1px solid rgba(139,92,246,0.2);
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .paste-area {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .text-area {
      font-family: monospace;
      font-size: 0.85rem;
      resize: vertical;
      line-height: 1.5;
    }
    .ocr-progress {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(139,92,246,0.05);
      border: 1px solid rgba(139,92,246,0.1);
      padding: 1rem;
      border-radius: 10px;
    }
    .spinner {
      width: 1.5rem;
      height: 1.5rem;
      border: 2px solid rgba(255,255,255,0.1);
      border-radius: 50%;
      border-top-color: var(--primary);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .result-panel {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .card-sub {
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    .statement-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .table-actions {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .btn-sm {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
    }
    .lines-table-wrap {
      overflow-x: auto;
      margin-bottom: 1rem;
      border: 1px solid var(--card-border);
      border-radius: 10px;
    }
    .lines-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .lines-table th,
    .lines-table td {
      padding: 0.5rem;
      border-bottom: 1px solid var(--card-border);
      vertical-align: middle;
    }
    .lines-table th {
      text-align: left;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      font-weight: 600;
    }
    .selected-row {
      background: rgba(139, 92, 246, 0.04);
    }
    .table-input {
      min-width: 0;
      width: 100%;
      padding: 0.35rem 0.5rem;
      font-size: 0.8rem;
    }
    .amount-input {
      min-width: 90px;
    }
    .w-full { width: 100%; }
    .submit-btn {
      margin-top: auto;
      padding: 0.85rem;
    }
    .no-result {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      text-align: center;
      padding: 3rem 1.5rem;
      gap: 1rem;
    }
    .no-result-icon {
      font-size: 3.5rem;
      opacity: 0.5;
    }
    .no-result p {
      max-width: 320px;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `]
})
export class BankStatementScannerPage {
  private readonly dataService = inject(DataService);

  readonly activeTab = signal<'upload' | 'paste'>('upload');
  readonly isParsing = signal(false);
  readonly isSaving = signal(false);
  readonly selectedFileName = signal<string | null>(null);
  readonly accountName = signal<string | null>(null);
  readonly editableLines = signal<EditableLine[]>([]);

  readonly lineCount = computed(() => this.editableLines().length);
  readonly selectedCount = computed(() => this.editableLines().filter(l => l.selected).length);

  pastedText = '';

  setTab(tab: 'upload' | 'paste') {
    this.activeTab.set(tab);
    this.resetResults();
    this.pastedText = '';
  }

  async parsePastedText() {
    if (!this.pastedText.trim()) return;
    this.isParsing.set(true);
    this.resetResults();

    try {
      const res = await this.dataService.parseStatementText(this.pastedText);
      this.populatePreview(res);
    } catch (err: any) {
      alert('Failed to parse statement: ' + err.message);
    } finally {
      this.isParsing.set(false);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.processFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files?.[0]) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  async processFile(file: File) {
    this.selectedFileName.set(file.name);
    this.isParsing.set(true);
    this.resetResults();

    try {
      const res = await this.dataService.parseStatementFile(file);
      this.populatePreview(res);
    } catch (err: any) {
      alert('Failed to parse file: ' + err.message);
    } finally {
      this.isParsing.set(false);
    }
  }

  selectAll() {
    this.editableLines.update(lines => lines.map(l => ({ ...l, selected: true })));
  }

  selectNone() {
    this.editableLines.update(lines => lines.map(l => ({ ...l, selected: false })));
  }

  async saveSelectedTransactions() {
    const selected = this.editableLines().filter(l => l.selected && l.amount > 0 && l.title.trim());
    if (selected.length === 0) return;

    this.isSaving.set(true);
    try {
      const result = await this.dataService.createTransactionsBulk(
        selected.map(line => ({
          title: line.title.trim(),
          amount: line.amount,
          category: line.category,
          type: line.type,
          date: new Date(line.dateInput).toISOString()
        })),
        'statement_scan'
      );

      alert(`Imported ${result.added_count} transaction(s)` +
        (result.skipped_count > 0 ? ` (${result.skipped_count} duplicate(s) skipped)` : '') + '.');
      this.resetResults();
      this.selectedFileName.set(null);
      this.pastedText = '';
    } catch (err: any) {
      alert('Failed to import transactions: ' + err.message);
    } finally {
      this.isSaving.set(false);
    }
  }

  private populatePreview(res: { account_name?: string; lines?: ParsedStatementLine[] }) {
    this.accountName.set(res.account_name || 'Bank Account');
    const lines: EditableLine[] = (res.lines || []).map(line => ({
      ...line,
      selected: true,
      dateInput: this.toDateInput(line.date)
    }));
    this.editableLines.set(lines);
  }

  private toDateInput(dateStr: string): string {
    try {
      return new Date(dateStr).toISOString().substring(0, 10);
    } catch {
      return new Date().toISOString().substring(0, 10);
    }
  }

  private resetResults() {
    this.accountName.set(null);
    this.editableLines.set([]);
  }
}
