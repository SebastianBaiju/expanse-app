import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../services/data';

@Component({
  selector: 'app-bill-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bill-scanner-wrapper animate-fade-in">
      <div class="header-section">
        <div>
          <h2>Smart Receipt Parser</h2>
          <p class="text-muted">Extract prices, merchants, dates, and categories from uploaded files or pasted receipt text.</p>
        </div>
      </div>

      <div class="scanner-grid">
        
        <!-- Left Column: Paste Text or Upload File -->
        <div class="glass-card scanner-controls">
          <div class="tabs">
            <button class="tab-btn" [class.active]="activeTab() === 'upload'" (click)="setTab('upload')">
              📷 Upload Receipt File
            </button>
            <button class="tab-btn" [class.active]="activeTab() === 'paste'" (click)="setTab('paste')">
              📋 Paste Receipt Text
            </button>
          </div>

          <!-- Tab 1: File Upload -->
          @if (activeTab() === 'upload') {
            <div class="upload-area" (dragover)="onDragOver($event)" (drop)="onDrop($event)" (click)="fileInput.click()">
              <input type="file" #fileInput style="display: none" (change)="onFileSelected($event)" accept="image/*,.txt,.csv,.pdf,application/pdf" />
              <span class="upload-icon">📤</span>
              <h4>Drag & drop receipt image, PDF, or text file here</h4>
              <p class="text-muted">Supports PNG, JPG, JPEG, PDF, and TXT files</p>
              
              @if (selectedFileName()) {
                <div class="file-name-indicator badge">
                  📄 {{ selectedFileName() }}
                </div>
              }
            </div>
          }

          <!-- Tab 2: Paste Text -->
          @if (activeTab() === 'paste') {
            <div class="paste-area">
              <label for="paste-text" class="sr-only">Receipt Content</label>
              <textarea
                id="paste-text"
                class="form-input text-area"
                placeholder="Paste transaction email body, sms receipt, or bill text here...&#10;e.g. Total: Rs 450.00 at Supermarket"
                [(ngModel)]="pastedText"
                rows="8"
              ></textarea>
              <button class="btn btn-primary w-full" [disabled]="!pastedText.trim() || isParsing()" (click)="parsePastedText()">
                {{ isParsing() ? 'Parsing Text...' : 'Parse Pasted Text' }}
              </button>
            </div>
          }

          @if (isParsing() && activeTab() === 'upload') {
            <div class="ocr-progress">
              <div class="spinner"></div>
              <div>
                <h4>OCR Scan in progress...</h4>
                <p class="text-muted">Simulating text extraction heuristics.</p>
              </div>
            </div>
          }
        </div>

        <!-- Right Column: Verification & Saving -->
        <div class="glass-card result-panel">
          <h3>Verification Panel</h3>
          <p class="text-muted card-sub">Verify and refine extracted receipt fields before recording.</p>

          @if (parsedResult()) {
            <form (ngSubmit)="saveTransaction()" #verifyForm="ngForm" class="verification-form animate-fade-in">
              <div class="form-group">
                <label for="res-merchant">Merchant / Title</label>
                <input type="text" id="res-merchant" class="form-input" [(ngModel)]="parsedResult().merchant" name="merchant" required />
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label for="res-amount">Extracted Price (Rs.)</label>
                  <input type="number" id="res-amount" class="form-input" [(ngModel)]="parsedResult().amount" name="amount" required min="0.01" />
                </div>
                <div class="form-group">
                  <label for="res-category">Suggested Category</label>
                  <select id="res-category" class="form-input form-select" [(ngModel)]="parsedResult().category" name="category" required>
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

              <div class="form-group">
                <label for="res-date">Transaction Date</label>
                <input type="date" id="res-date" class="form-input" [(ngModel)]="parsedDate" name="date" required />
              </div>

              <button type="submit" class="btn btn-primary w-full submit-btn" [disabled]="verifyForm.invalid || isSaving()">
                {{ isSaving() ? 'Saving...' : 'Add to Transactions' }}
              </button>
            </form>
          } @else {
            <div class="no-result">
              <span class="no-result-icon">📄</span>
              <p>Upload a file or paste receipt details on the left to activate the parser verification card.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bill-scanner-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .scanner-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 800px) {
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
      overflow: hidden;
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
      box-sizing: border-box;
      display: block;
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
    }
    .card-sub {
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .verification-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 500px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
    .w-full { width: 100%; }
    .submit-btn {
      margin-top: 1rem;
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
      max-width: 255px;
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
      border-0: 0;
    }
  `]
})
export class BillScannerPage {
  private readonly dataService = inject(DataService);

  // States
  readonly activeTab = signal<'upload' | 'paste'>('upload');
  readonly isParsing = signal(false);
  readonly isSaving = signal(false);
  readonly selectedFileName = signal<string | null>(null);
  
  // Data State
  readonly parsedResult = signal<any | null>(null);
  parsedDate = '';
  pastedText = '';

  setTab(tab: 'upload' | 'paste') {
    this.activeTab.set(tab);
    this.parsedResult.set(null);
    this.selectedFileName.set(null);
    this.pastedText = '';
  }

  async parsePastedText() {
    if (!this.pastedText.trim()) return;
    this.isParsing.set(true);
    this.parsedResult.set(null);

    try {
      const res = await this.dataService.parseBillText(this.pastedText);
      this.populateVerificationPanel(res);
    } catch (err: any) {
      alert('Failed to parse text: ' + err.message);
    } finally {
      this.isParsing.set(false);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  async processFile(file: File) {
    this.selectedFileName.set(file.name);
    this.isParsing.set(true);
    this.parsedResult.set(null);

    try {
      const res = await this.dataService.parseBillFile(file);
      this.populateVerificationPanel(res);
    } catch (err: any) {
      alert('Failed to parse file: ' + err.message);
    } finally {
      this.isParsing.set(false);
    }
  }

  private populateVerificationPanel(res: any) {
    this.parsedResult.set(res);
    // Populate YYYY-MM-DD date format
    if (res.date) {
      try {
        const d = new Date(res.date);
        this.parsedDate = d.toISOString().substring(0, 10);
      } catch (e) {
        this.parsedDate = new Date().toISOString().substring(0, 10);
      }
    } else {
      this.parsedDate = new Date().toISOString().substring(0, 10);
    }
  }

  async saveTransaction() {
    if (!this.parsedResult()) return;
    this.isSaving.set(true);

    try {
      await this.dataService.createTransaction({
        title: this.parsedResult().merchant,
        amount: this.parsedResult().amount,
        category: this.parsedResult().category,
        type: 'expense', // bills are inherently expenses
        date: new Date(this.parsedDate).toISOString()
      });

      alert('Receipt transaction recorded successfully!');
      // Reset
      this.parsedResult.set(null);
      this.selectedFileName.set(null);
      this.pastedText = '';
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      this.isSaving.set(false);
    }
  }
}
