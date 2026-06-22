import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../services/data';

@Component({
  selector: 'app-email-sync',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="email-sync-wrapper animate-fade-in">
      <div class="header-section">
        <div>
          <h2>Email Integrations</h2>
          <p class="text-muted">Configure IMAP mailboxes to crawl and parse transaction alerts from HDFC, ICICI, Amazon, and Flipkart.</p>
        </div>
      </div>

      <div class="sync-grid">
        
        <!-- Left Side: IMAP configuration form -->
        <div class="glass-card config-card">
          <h3>IMAP Settings</h3>
          <p class="text-muted card-sub">Register your email account. For Gmail/Outlook, please use an App Password, not your login password.</p>

          @if (errorMessage()) {
            <div class="banner error-banner">⚠️ {{ errorMessage() }}</div>
          }
          @if (successMessage()) {
            <div class="banner success-banner">✅ {{ successMessage() }}</div>
          }

          <form (ngSubmit)="saveConfig()" #configForm="ngForm" class="config-form">
            <div class="form-group">
              <label for="imap_server">IMAP Host Server</label>
              <input type="text" id="imap_server" class="form-input" placeholder="e.g. imap.gmail.com" [(ngModel)]="imapServer" name="imap_server" required />
            </div>

            <div class="form-group">
              <label for="imap_port">IMAP Port (SSL)</label>
              <input type="number" id="imap_port" class="form-input" placeholder="993" [(ngModel)]="imapPort" name="imap_port" required />
            </div>

            <div class="form-group">
              <label for="email">Email Address</label>
              <input type="email" id="email" class="form-input" placeholder="username@gmail.com" [(ngModel)]="email" name="email" required email />
            </div>

            <div class="form-group">
              <label for="password">App Password</label>
              <input type="password" id="password" class="form-input" placeholder="•••• •••• •••• ••••" [(ngModel)]="password" name="password" required />
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="configForm.invalid || isSaving()">
              {{ isSaving() ? 'Saving...' : 'Save Configuration' }}
            </button>
          </form>
        </div>

        <!-- Right Side: Status and Manual Sync trigger -->
        <div class="glass-card status-card">
          <h3>Sync Control</h3>
          <p class="text-muted card-sub">Crawl and process your unread transactions mail notifications.</p>

          <div class="status-box">
            <div class="status-indicator">
              <span class="indicator-dot" [class.dot-active]="isConfigured() && isPermissionGranted()"></span>
              <strong>{{ (isConfigured() && isPermissionGranted()) ? 'Permission Granted & Active' : (!isConfigured() ? 'Not Configured' : 'Sync Paused / Permission Revoked') }}</strong>
            </div>
            @if (isConfigured()) {
              <p class="status-detail">Syncing inbox: <strong>{{ email }}</strong></p>
              
              <div class="permission-toggle">
                <input type="checkbox" id="sync-permission" [checked]="isPermissionGranted()" (change)="togglePermission()" />
                <label for="sync-permission">Allow system to parse emails and automatically record expenses</label>
              </div>
            }
          </div>

          <div class="supported-banks">
            <h4>Supported Alerts:</h4>
            <div class="bank-logos">
              <span class="bank-tag bg-hdfc">HDFC Bank</span>
              <span class="bank-tag bg-icici">ICICI Bank</span>
              <span class="bank-tag bg-amazon">Amazon Pay</span>
              <span class="bank-tag bg-flipkart">Flipkart Orders</span>
            </div>
          </div>

          <div class="sync-actions">
            <button class="btn btn-secondary w-full sync-btn" [disabled]="!isConfigured() || !isPermissionGranted() || isSyncing()" (click)="syncEmails()">
              @if (isSyncing()) {
                <span class="spinner"></span> Synchronizing Inbox...
              } @else {
                🔄 Fetch Transactions Now
              }
            </button>
          </div>

          @if (syncResult()) {
            <div class="sync-result-card animate-fade-in">
              <h4>Sync Finished</h4>
              <p>Processed unread messages. Added <strong>{{ syncResult()?.added_count }}</strong> new expense transactions.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .email-sync-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .sync-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 800px) {
      .sync-grid {
        grid-template-columns: 1fr;
      }
    }
    .card-sub {
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .config-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .banner {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1.25rem;
    }
    .error-banner {
      background: rgba(239, 68, 68, 0.1);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.15);
    }
    .success-banner {
      background: rgba(16, 185, 129, 0.1);
      color: #a7f3d0;
      border: 1px solid rgba(16, 185, 129, 0.15);
    }
    .w-full { width: 100%; }
    .status-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1.5rem;
    }
    .status-box {
      background: var(--bg-secondary);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1rem;
      margin-bottom: 0.4rem;
    }
    .indicator-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: var(--text-muted);
    }
    .indicator-dot.dot-active {
      background-color: var(--income-green);
      box-shadow: 0 0 8px var(--income-green);
    }
    .status-detail {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .permission-toggle {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--card-border);
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .permission-toggle input {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .permission-toggle label {
      cursor: pointer;
      line-height: 1.4;
      user-select: none;
    }
    .supported-banks {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .supported-banks h4 {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    .bank-logos {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .bank-tag {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .bg-hdfc { background: rgba(30, 64, 175, 0.2); color: #93c5fd; }
    .bg-icici { background: rgba(249, 115, 22, 0.2); color: #fdba74; }
    .bg-amazon { background: rgba(234, 179, 8, 0.2); color: #fef08a; }
    .bg-flipkart { background: rgba(6, 182, 212, 0.2); color: #a5f3fc; }
    
    .sync-btn {
      padding: 0.85rem;
      font-size: 1rem;
      font-weight: 600;
    }
    .sync-result-card {
      background: rgba(16, 185, 129, 0.05);
      border: 1px dashed rgba(16, 185, 129, 0.2);
      border-radius: 10px;
      padding: 1rem;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .sync-result-card h4 {
      color: var(--income-green);
      margin-bottom: 0.25rem;
    }
    .spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: var(--primary);
      animation: spin 0.8s linear infinite;
      margin-right: 0.5rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class EmailSyncPage implements OnInit {
  private readonly dataService = inject(DataService);

  // Form Fields
  imapServer = '';
  imapPort = 993;
  email = '';
  password = '';

  // UI Flags
  readonly isConfigured = signal(false);
  readonly isPermissionGranted = signal(false);
  readonly isSaving = signal(false);
  readonly isSyncing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly syncResult = signal<any | null>(null);

  ngOnInit() {
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const config = await this.dataService.getMailConfig();
      if (config) {
        this.imapServer = config.imap_server;
        this.imapPort = config.imap_port;
        this.email = config.email;
        this.isConfigured.set(true);
        this.isPermissionGranted.set(config.is_active);
      }
    } catch (err) {
      this.isConfigured.set(false);
      this.isPermissionGranted.set(false);
    }
  }

  async saveConfig() {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSaving.set(true);

    try {
      await this.dataService.saveMailConfig({
        imap_server: this.imapServer,
        imap_port: this.imapPort,
        email: this.email,
        password: this.password
      });
      this.successMessage.set('IMAP configurations stored successfully.');
      this.isConfigured.set(true);
      this.isPermissionGranted.set(true);
      this.password = '';
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to save configuration.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async togglePermission() {
    const nextVal = !this.isPermissionGranted();
    try {
      await this.dataService.toggleMailConfigActive(nextVal);
      this.isPermissionGranted.set(nextVal);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle email permission status.');
    }
  }

  async syncEmails() {
    this.isSyncing.set(true);
    this.syncResult.set(null);
    try {
      const res = await this.dataService.syncMail();
      this.syncResult.set(res);
    } catch (err: any) {
      alert(err.message || 'Inbox synchronization failed.');
    } finally {
      this.isSyncing.set(false);
    }
  }
}
