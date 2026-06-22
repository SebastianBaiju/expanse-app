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
        <!-- Profile details card -->
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

          <form (ngSubmit)="saveProfile()" class="profile-form">
            @if (successMessage()) {
              <div class="alert alert-success">{{ successMessage() }}</div>
            }
            @if (errorMessage()) {
              <div class="alert alert-error">{{ errorMessage() }}</div>
            }

            <div class="form-group">
              <label class="form-label">Username (Immutable)</label>
              <input type="text" class="form-input disabled-input" [value]="username()" disabled />
            </div>

            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-input" [(ngModel)]="email" name="email" required placeholder="name@example.com" />
            </div>

            <div class="form-group">
              <label class="form-label">Change Password (Leave blank to keep current)</label>
              <input type="password" class="form-input" [(ngModel)]="password" name="password" minlength="6" placeholder="Enter new password (min. 6 chars)" />
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="loading()">
              {{ loading() ? 'Saving Changes...' : 'Save Profile Details' }}
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
      grid-template-columns: minmax(320px, 500px);
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
  email = '';
  password = '';

  readonly loading = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    try {
      const p = await this.dataService.getProfile();
      this.username.set(p.username);
      this.role.set(p.role);
      this.email = p.email;
    } catch (err) {
      console.error('Failed to load profile details', err);
      this.errorMessage.set('Failed to retrieve profile data.');
    }
  }

  async saveProfile() {
    if (!this.email) {
      this.errorMessage.set('Email address is required.');
      return;
    }

    this.loading.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    try {
      const res = await this.dataService.updateProfile(this.email, this.password || undefined);
      this.successMessage.set(res.message || 'Profile updated successfully!');
      this.password = '';
      
      // Update session signals in AuthService so header/sidebar update immediately
      this.auth.updateSessionDetails(res.email, res.username);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to update user profile.');
    } finally {
      this.loading.set(false);
    }
  }
}
