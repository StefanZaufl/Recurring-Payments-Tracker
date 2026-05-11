import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';
import { setupGuard } from './core/auth/setup.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/users/auth/pages/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadComponent: () => import('./features/users/auth/pages/setup.component').then(m => m.SetupComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/pages/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'transactions',
    canActivate: [authGuard],
    loadComponent: () => import('./features/transactions/pages/transactions.component').then(m => m.TransactionsComponent)
  },
  {
    path: 'transactions/import',
    canActivate: [authGuard],
    loadComponent: () => import('./features/transactions/pages/transaction-import.component').then(m => m.TransactionImportComponent)
  },
  {
    path: 'configure',
    canActivate: [authGuard],
    loadComponent: () => import('./features/configuration/pages/configure.component').then(m => m.ConfigureComponent)
  },
  {
    path: 'recurring-payments/create',
    canActivate: [authGuard],
    loadComponent: () => import('./features/recurring-payments/pages/create-payment.component').then(m => m.CreatePaymentComponent)
  },
  {
    path: 'recurring-payments/additional',
    canActivate: [authGuard],
    loadComponent: () => import('./features/additional-rule-groups/pages/additional-rule-group-editor.component').then(m => m.AdditionalRuleGroupEditorComponent)
  },
  {
    path: 'recurring-payments',
    canActivate: [authGuard],
    loadComponent: () => import('./features/recurring-payments/pages/recurring-payments-list.component').then(m => m.RecurringPaymentsListComponent)
  },
  {
    path: 'predictions',
    canActivate: [authGuard],
    loadComponent: () => import('./features/analytics/pages/upcoming-payments.component').then(m => m.UpcomingPaymentsComponent)
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./features/users/account/pages/account.component').then(m => m.AccountComponent)
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/users/admin/pages/user-management.component').then(m => m.UserManagementComponent)
  }
];
