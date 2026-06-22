import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../services/data';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-wrapper animate-fade-in">
      <div class="header-section">
        <div>
          <h2>User Profile Management</h2>
          <p class="text-muted">Manage your personal account details, update your email address, or change your secure login credentials.</p>
        </div>
      </div>

      <div class="profile-grid">
        <!-- Card 1: Account Details -->
        <div class="glass-card profile-card">
          <div class="profile-header">
            <div class="avatar-large">
              <span class="material-symbols-outlined">person</span>
            </div>
            <div class="profile-identity">
              <h3>{{ username() }}</h3>
              <span class="badge" [class.badge-admin]="role() === 'admin'">Role: {{ role() }}</span>
            </div>
          </div>

          <form (ngSubmit)="saveDetails()" class="profile-form">
            <h4 style="margin-bottom: 0.25rem; color: var(--primary);">Update Account Details</h4>
            <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 0.75rem;">Modify username and email address.</p>
            @if (detailsSuccessMessage()) {
              <div class="alert alert-success">{{ detailsSuccessMessage() }}</div>
            }
            @if (detailsErrorMessage()) {
              <div class="alert alert-error">{{ detailsErrorMessage() }}</div>
            }

            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" class="form-input" [(ngModel)]="editableUsername" name="username" required placeholder="Enter new username" minlength="3" />
            </div>

            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-input" [(ngModel)]="email" name="email" required placeholder="name@example.com" />
            </div>

            <div class="form-group" style="margin-top: 0.5rem; border-top: 1px solid var(--card-border); padding-top: 1rem;">
              <label class="form-label" style="color: #f59e0b;">Current Password (Required to save changes)</label>
              <input type="password" class="form-input" [(ngModel)]="detailsConfirmPassword" name="detailsConfirmPassword" required placeholder="Enter current password" />
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="detailsLoading()">
              {{ detailsLoading() ? 'Updating Details...' : 'Save Account Details' }}
            </button>
          </form>
        </div>

        <!-- Card 2: Change Password -->
        <div class="glass-card profile-card">
          <form (ngSubmit)="changePassword()" class="profile-form">
            <h4 style="margin-bottom: 0.25rem; color: var(--primary);">Change Secure Password</h4>
            <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 0.75rem;">Update login credentials.</p>
            @if (passwordSuccessMessage()) {
              <div class="alert alert-success">{{ passwordSuccessMessage() }}</div>
            }
            @if (passwordErrorMessage()) {
              <div class="alert alert-error">{{ passwordErrorMessage() }}</div>
            }

            <div class="form-group">
              <label class="form-label">New Password</label>
              <input type="password" class="form-input" [(ngModel)]="newPassword" name="newPassword" required minlength="6" placeholder="Enter new password (min. 6 chars)" />
            </div>

            <div class="form-group">
              <label class="form-label">Confirm New Password</label>
              <input type="password" class="form-input" [(ngModel)]="confirmPassword" name="confirmPassword" required minlength="6" placeholder="Confirm new password" />
            </div>

            <div class="form-group" style="margin-top: 0.5rem; border-top: 1px solid var(--card-border); padding-top: 1rem;">
              <label class="form-label" style="color: #f59e0b;">Current Password (Required to save changes)</label>
              <input type="password" class="form-input" [(ngModel)]="passwordConfirmPassword" name="passwordConfirmPassword" required placeholder="Enter current password" />
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="passwordLoading()">
              {{ passwordLoading() ? 'Updating Password...' : 'Update Password' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .profile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
    }
    .profile-card {
      padding: 2rem;
    }
    .profile-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 1.5rem;
    }
    .avatar-large {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      background: rgba(139, 92, 246, 0.1);
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: 50%;
      color: var(--primary);
    }
    .avatar-large .material-symbols-outlined {
      font-size: 36px;
    }
    .profile-identity {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .profile-identity h3 {
      font-size: 1.5rem;
      margin: 0;
    }
    .badge-admin {
      background: rgba(139, 92, 246, 0.15) !important;
      color: var(--primary) !important;
      border: 1px solid rgba(139, 92, 246, 0.25) !important;
    }
    .profile-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .disabled-input {
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      cursor: not-allowed;
    }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
    }
    .alert-success {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: var(--income-green);
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--expense-red);
    }
  `]
})
export class ProfilePage implements OnInit {
  private readonly dataService = inject(DataService);
  private readonly auth = inject(AuthService);

  readonly username = signal('');
  readonly role = signal('');
  
  // Details Form State
  editableUsername = '';
  email = '';
  detailsConfirmPassword = '';
  readonly detailsLoading = signal(false);
  readonly detailsSuccessMessage = signal<string | null>(null);
  readonly detailsErrorMessage = signal<string | null>(null);

  // Password Form State
  newPassword = '';
  confirmPassword = '';
  passwordConfirmPassword = '';
  readonly passwordLoading = signal(false);
  readonly passwordSuccessMessage = signal<string | null>(null);
  readonly passwordErrorMessage = signal<string | null>(null);

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    try {
      const p = await this.dataService.getProfile();
      this.username.set(p.username);
      this.role.set(p.role);
      
      this.editableUsername = p.username;
      this.email = p.email;
    } catch (err) {
      console.error('Failed to load profile details', err);
      this.detailsErrorMessage.set('Failed to retrieve profile data.');
    }
  }

  async saveDetails() {
    this.detailsSuccessMessage.set(null);
    this.detailsErrorMessage.set(null);

    if (!this.editableUsername) {
      this.detailsErrorMessage.set('Username is required.');
      return;
    }
    if (!this.email) {
      this.detailsErrorMessage.set('Email address is required.');
      return;
    }
    if (!this.detailsConfirmPassword) {
      this.detailsErrorMessage.set('Current password is required to save details.');
      return;
    }

    this.detailsLoading.set(true);

    try {
      const res = await this.dataService.updateProfile(
        this.editableUsername,
        this.email,
        this.detailsConfirmPassword,
        undefined
      );
      
      this.detailsSuccessMessage.set(res.message || 'Account details updated successfully!');
      this.username.set(res.username);
      this.detailsConfirmPassword = '';
      
      // Update session signals in AuthService so header/sidebar updates immediately
      this.auth.updateSessionDetails(res.email, res.username);
    } catch (err: any) {
      this.detailsErrorMessage.set(err.message || 'Failed to update account details.');
    } finally {
      this.detailsLoading.set(false);
    }
  }

  async changePassword() {
    this.passwordSuccessMessage.set(null);
    this.passwordErrorMessage.set(null);

    if (!this.newPassword || !this.confirmPassword) {
      this.passwordErrorMessage.set('New password and password confirmation are required.');
      return;
    }
    if (this.newPassword.length < 6) {
      this.passwordErrorMessage.set('New password must be at least 6 characters long.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordErrorMessage.set('New password and confirm password do not match.');
      return;
    }
    if (!this.passwordConfirmPassword) {
      this.passwordErrorMessage.set('Current password is required to verify changes.');
      return;
    }

    this.passwordLoading.set(true);

    try {
      const res = await this.dataService.updateProfile(
        this.username(),
        this.email,
        this.passwordConfirmPassword,
        this.newPassword
      );
      
      this.passwordSuccessMessage.set(res.message || 'Password changed successfully!');
      
      // Reset sensitive fields
      this.newPassword = '';
      this.confirmPassword = '';
      this.passwordConfirmPassword = '';
    } catch (err: any) {
      this.passwordErrorMessage.set(err.message || 'Failed to update secure password.');
    } finally {
      this.passwordLoading.set(false);
    }
  }
}
