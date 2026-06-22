import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api';

export interface UserSession {
  token: string;
  username: string;
  role: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  // Signals for application state
  readonly token = signal<string | null>(typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' ? localStorage.getItem('token') : null);
  readonly currentUser = signal<string | null>(typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' && localStorage.getItem('token') ? localStorage.getItem('username') : null);
  readonly currentUserRole = signal<string | null>(typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' && localStorage.getItem('token') ? localStorage.getItem('role') : null);
  readonly currentUserEmail = signal<string | null>(typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' && localStorage.getItem('token') ? localStorage.getItem('email') : null);

  async login(username: string, password: string): Promise<void> {
    const session = await this.api.post<UserSession>('/auth/login', { username, password });
    
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('token', session.token);
      localStorage.setItem('username', session.username);
      localStorage.setItem('role', session.role);
      localStorage.setItem('email', session.email);
    }

    this.token.set(session.token);
    this.currentUser.set(session.username);
    this.currentUserRole.set(session.role);
    this.currentUserEmail.set(session.email);

    this.router.navigate(['/dashboard']);
  }

  async register(username: string, password: string, email: string): Promise<void> {
    await this.api.post<any>('/auth/register', { username, password, email });
  }

  logout(): void {
    if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
      localStorage.clear();
    }
    this.token.set(null);
    this.currentUser.set(null);
    this.currentUserRole.set(null);
    this.currentUserEmail.set(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.token();
  }

  isAdmin(): boolean {
    return this.currentUserRole() === 'admin';
  }
}
