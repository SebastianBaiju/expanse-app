import { inject } from '@angular/core';
import { Routes, Router, CanActivateFn } from '@angular/router';
import { AuthService } from './services/auth';

// Functional Route Guards
const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isAuthenticated()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};

const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};

const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isAuthenticated()) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login').then(m => m.LoginPage),
    canActivate: [guestGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard').then(m => m.DashboardPage),
    canActivate: [authGuard]
  },
  {
    path: 'transactions',
    loadComponent: () => import('./pages/transactions').then(m => m.TransactionsPage),
    canActivate: [authGuard]
  },
  {
    path: 'recurring',
    loadComponent: () => import('./pages/recurring').then(m => m.RecurringPage),
    canActivate: [authGuard]
  },
  {
    path: 'email-sync',
    loadComponent: () => import('./pages/email-sync').then(m => m.EmailSyncPage),
    canActivate: [authGuard]
  },
  {
    path: 'bill-scanner',
    loadComponent: () => import('./pages/bill-scanner').then(m => m.BillScannerPage),
    canActivate: [authGuard]
  },
  {
    path: 'bank-statement',
    loadComponent: () => import('./pages/bank-statement-scanner').then(m => m.BankStatementScannerPage),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin').then(m => m.AdminPage),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile').then(m => m.ProfilePage),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
