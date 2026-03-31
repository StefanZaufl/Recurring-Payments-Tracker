import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'upload',
    loadComponent: () => import('./features/file-upload/file-upload.component').then(m => m.FileUploadComponent)
  },
  {
    path: 'recurring-payments',
    loadComponent: () => import('./features/recurring-payments/recurring-payments-list.component').then(m => m.RecurringPaymentsListComponent)
  },
  {
    path: 'predictions',
    loadComponent: () => import('./features/predictions/upcoming-payments.component').then(m => m.UpcomingPaymentsComponent)
  }
];
