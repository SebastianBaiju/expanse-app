import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrapper">
      <div class="glass-card auth-card animate-fade-in">
        <div class="auth-header">
          <div class="logo">
            <span class="logo-icon">💳</span>
            <h2>WalletFlow</h2>
          </div>
          <p class="subtitle">
            {{ isLoginMode() ? 'Sign in to your account' : 'Create a new wallet account' }}
          </p>
        </div>

        @if (errorMessage()) {
          <div class="error-banner">
            <span>⚠️</span>
            <p>{{ errorMessage() }}</p>
          </div>
        }

        @if (successMessage()) {
          <div class="success-banner">
            <span>✅</span>
            <p>{{ successMessage() }}</p>
          </div>
        }

        <form (ngSubmit)="onSubmit()" #authForm="ngForm">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              class="form-input"
              placeholder="Enter username"
              [(ngModel)]="username"
              required
              minlength="3"
            />
          </div>

          @if (!isLoginMode()) {
            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                class="form-input"
                placeholder="you@example.com"
                [(ngModel)]="email"
                required
                email
              />
            </div>
          }

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              class="form-input"
              placeholder="••••••••"
              [(ngModel)]="password"
              required
              minlength="6"
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            [disabled]="authForm.invalid || isLoading()"
          >
            @if (isLoading()) {
              <span class="spinner"></span> Processing...
            } @else {
              {{ isLoginMode() ? 'Sign In' : 'Create Account' }}
            }
          </button>
        </form>

        <div class="auth-footer">
          <button class="btn-text" (click)="toggleMode()">
            {{ isLoginMode() ? "Don't have an account? Sign Up" : "Already have an account? Sign In" }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
                  radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.15) 0%, transparent 40%),
                  var(--bg-primary);
      padding: 1.5rem;
    }
    .auth-card {
      width: 100%;
      max-width: 420px;
      padding: 2.5rem;
    }
    .auth-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .logo-icon {
      font-size: 2rem;
    }
    .logo h2 {
      font-size: 1.75rem;
      background: linear-gradient(135deg, #a78bfa 0%, #06b6d4 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.025em;
    }
    .subtitle {
      color: var(--text-secondary);
      font-size: 0.95rem;
    }
    .error-banner, .success-banner {
      display: flex;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
      align-items: flex-start;
      line-height: 1.4;
    }
    .error-banner {
      background: rgba(239, 68, 68, 0.1);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .success-banner {
      background: rgba(16, 185, 129, 0.1);
      color: #a7f3d0;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .w-full {
      width: 100%;
      margin-top: 1.5rem;
    }
    .auth-footer {
      text-align: center;
      margin-top: 1.5rem;
    }
    .btn-text {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    .btn-text:hover {
      color: var(--primary);
    }
    .spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Form bindings
  username = '';
  email = '';
  password = '';

  // Mode & UI States
  readonly isLoginMode = signal(true);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  constructor() {
    // If already authenticated, redirect to dashboard
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  toggleMode() {
    this.isLoginMode.update(mode => !mode);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.username = '';
    this.email = '';
    this.password = '';
  }

  async onSubmit() {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isLoading.set(true);

    try {
      if (this.isLoginMode()) {
        await this.auth.login(this.username, this.password);
      } else {
        await this.auth.register(this.username, this.password, this.email);
        this.successMessage.set('Account created successfully! Please sign in.');
        this.isLoginMode.set(true);
        this.password = '';
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Authentication failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
