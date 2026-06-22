import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService, UserAccount } from '../services/data';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-wrapper animate-fade-in">
      <div class="header-section">
        <div>
          <h2>User Accounts Administration</h2>
          <p class="text-muted">Centralized accounts controller. Modify user access permissions, upgrade roles, or remove credentials.</p>
        </div>
      </div>

      <!-- User Creation Form -->
      <div class="glass-card create-user-card">
        <div class="card-header">
          <h3>Create New User Account</h3>
          <p class="text-muted">Directly register a new administrator or standard user account.</p>
        </div>
        <form (ngSubmit)="createUser()" class="admin-form">
          @if (successMessage()) {
            <div class="alert alert-success">{{ successMessage() }}</div>
          }
          @if (errorMessage()) {
            <div class="alert alert-error">{{ errorMessage() }}</div>
          }
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" class="form-input" placeholder="Username" [(ngModel)]="newUsername" name="username" required minlength="3" />
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-input" placeholder="Email Address" [(ngModel)]="newEmail" name="email" required />
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-input" placeholder="Password (min. 6 chars)" [(ngModel)]="newPassword" name="password" required minlength="6" />
            </div>
            <div class="form-group">
              <label class="form-label">Role Designation</label>
              <select class="form-input form-select" [(ngModel)]="newRole" name="role" required>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-sm submit-btn">Create Account</button>
        </form>
      </div>

      <div class="glass-card table-panel">
        <div class="table-header">
          <h3>Registered Users List</h3>
          <span class="badge badge-admin">Admin Dashboard</span>
        </div>

        <div class="table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email Address</th>
                <th>Role Designation</th>
                <th>Registration Date</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr class="user-row">
                  <td>
                    <div class="user-info">
                      <span class="user-avatar">👤</span>
                      <strong>{{ user.username }}</strong>
                    </div>
                  </td>
                  <td>{{ user.email }}</td>
                  <td>
                    <span class="badge" [class.badge-admin]="user.role === 'admin'" [class.badge-user]="user.role === 'user'">
                      {{ user.role }}
                    </span>
                  </td>
                  <td>{{ user.created_at | date:'mediumDate' }}</td>
                  <td class="text-right actions-cell">
                    <button class="btn btn-secondary btn-xs" (click)="toggleRole(user)" [disabled]="isSelf(user)">
                      Switch Role
                    </button>
                    <button class="btn btn-danger btn-xs" (click)="deleteUser(user)" [disabled]="isSelf(user)">
                      Delete
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="no-data">No accounts registered yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .table-panel {
      padding: 0;
      overflow: hidden;
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid var(--card-border);
    }
    .badge-admin {
      background: rgba(139, 92, 246, 0.15);
      color: var(--primary);
      border: 1px solid rgba(139, 92, 246, 0.25);
    }
    .badge-user {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-cyan);
      border: 1px solid rgba(6, 182, 212, 0.25);
    }
    .table-container {
      width: 100%;
      overflow-x: auto;
    }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      text-align: left;
    }
    .admin-table th {
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.85rem 1.5rem;
      border-bottom: 1px solid var(--card-border);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      background: rgba(255, 255, 255, 0.01);
    }
    .admin-table td {
      padding: 1.1rem 1.5rem;
      border-bottom: 1px solid var(--card-border);
      vertical-align: middle;
    }
    .user-row:hover {
      background: rgba(255,255,255,0.01);
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .user-avatar {
      font-size: 1.15rem;
    }
    .text-right { text-align: right; }
    .actions-cell {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .btn-xs {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      border-radius: 6px;
    }
    .btn-xs[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .no-data {
      text-align: center;
      padding: 4rem;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .create-user-card {
      padding: 1.5rem 2rem;
    }
    .admin-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .form-label {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .submit-btn {
      align-self: flex-start;
      padding: 0.6rem 1.5rem;
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
export class AdminPage implements OnInit {
  private readonly dataService = inject(DataService);
  private readonly auth = inject(AuthService);

  readonly users = signal<UserAccount[]>([]);

  // User creation form fields
  newUsername = '';
  newEmail = '';
  newPassword = '';
  newRole = 'user';

  // Alerts
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit() {
    this.loadUsers();
  }

  async loadUsers() {
    try {
      const uList = await this.dataService.getUsers();
      this.users.set(uList);
    } catch (err) {
      console.error('Failed to retrieve user accounts', err);
    }
  }

  isSelf(user: UserAccount): boolean {
    return user.username === this.auth.currentUser();
  }

  async createUser() {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (!this.newUsername || !this.newEmail || !this.newPassword || !this.newRole) {
      this.errorMessage.set('All fields are required.');
      return;
    }

    try {
      await this.dataService.adminCreateUser({
        username: this.newUsername,
        email: this.newEmail,
        password: this.newPassword,
        role: this.newRole
      });

      this.successMessage.set(`Successfully created account for "${this.newUsername}".`);
      
      // Reset form fields
      this.newUsername = '';
      this.newEmail = '';
      this.newPassword = '';
      this.newRole = 'user';

      // Reload users list
      await this.loadUsers();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to create user account.');
    }
  }

  async toggleRole(user: UserAccount) {
    const targetRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await this.dataService.updateUserRole(user.id, targetRole);
      await this.loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle user role.');
    }
  }

  async deleteUser(user: UserAccount) {
    if (!confirm(`Are you sure you want to delete user account "${user.username}"? All associated transactions, IMAP configurations, and subscriptions will be deleted.`)) return;

    try {
      await this.dataService.deleteUser(user.id);
      await this.loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user account.');
    }
  }
}
