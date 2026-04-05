import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { setupGuard } from './core/setup.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadComponent: () => import('./features/setup/setup.component').then(m => m.SetupComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'transactions',
    canActivate: [authGuard],
    loadComponent: () => import('./features/transactions/transactions.component').then(m => m.TransactionsComponent)
  },
  {
    path: 'configure',
    canActivate: [authGuard],
    loadComponent: () => import('./features/configure/configure.component').then(m => m.ConfigureComponent)
  },
  {
    path: 'recurring-payments',
    canActivate: [authGuard],
    loadComponent: () => import('./features/recurring-payments/recurring-payments-list.component').then(m => m.RecurringPaymentsListComponent)
  },
  {
    path: 'predictions',
    canActivate: [authGuard],
    loadComponent: () => import('./features/predictions/upcoming-payments.component').then(m => m.UpcomingPaymentsComponent)
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./features/account/account.component').then(m => m.AccountComponent)
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin/user-management.component').then(m => m.UserManagementComponent)
  }
];
