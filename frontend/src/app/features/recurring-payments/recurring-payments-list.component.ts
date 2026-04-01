import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecurringPaymentsService, CategoriesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-recurring-payments-list',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Recurring Payments</h1>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" [(ngModel)]="showInactive"
                   class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                   (change)="applyFilter()">
            Show inactive
          </label>
          <select [(ngModel)]="filterFrequency" (change)="applyFilter()"
                  class="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="">All frequencies</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && filteredPayments.length === 0" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
        <h3 class="mt-2 text-sm font-semibold text-gray-900">No recurring payments found</h3>
        <p class="mt-1 text-sm text-gray-500">Upload bank transactions to detect recurring payment patterns.</p>
        <div class="mt-4">
          <a routerLink="/upload"
             class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Upload CSV
          </a>
        </div>
      </div>

      <!-- Payments table -->
      <div *ngIf="!loading && filteredPayments.length > 0" class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
              <th class="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr *ngFor="let payment of filteredPayments"
                class="hover:bg-gray-50"
                [class.opacity-50]="!payment.isActive">
              <td class="px-5 py-3 text-sm font-medium text-gray-900">{{ payment.name }}</td>
              <td class="px-5 py-3 text-sm text-gray-500">
                <span *ngIf="payment.categoryName"
                      class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {{ payment.categoryName }}
                </span>
                <span *ngIf="!payment.categoryName" class="text-gray-400 text-xs">Uncategorized</span>
              </td>
              <td class="px-5 py-3 text-sm text-gray-500">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      [ngClass]="{
                        'bg-purple-50 text-purple-700': payment.frequency === 'MONTHLY',
                        'bg-amber-50 text-amber-700': payment.frequency === 'QUARTERLY',
                        'bg-teal-50 text-teal-700': payment.frequency === 'YEARLY'
                      }">
                  {{ payment.frequency }}
                </span>
              </td>
              <td class="px-5 py-3 text-sm text-right font-medium"
                  [class.text-green-600]="payment.isIncome"
                  [class.text-red-600]="!payment.isIncome">
                {{ payment.isIncome ? '+' : '-' }}{{ formatCurrency(abs(payment.averageAmount)) }}
              </td>
              <td class="px-5 py-3 text-sm">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      [ngClass]="{
                        'bg-green-50 text-green-700': payment.isIncome,
                        'bg-red-50 text-red-700': !payment.isIncome
                      }">
                  {{ payment.isIncome ? 'Income' : 'Expense' }}
                </span>
              </td>
              <td class="px-5 py-3 text-sm">
                <button (click)="toggleActive(payment)"
                        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer"
                        [ngClass]="{
                          'bg-green-50 text-green-700': payment.isActive,
                          'bg-gray-100 text-gray-500': !payment.isActive
                        }">
                  {{ payment.isActive ? 'Active' : 'Inactive' }}
                </button>
              </td>
              <td class="px-5 py-3 text-sm">
                <select [ngModel]="payment.categoryId || ''"
                        (ngModelChange)="updateCategory(payment, $event)"
                        class="text-xs border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  <option value="">None</option>
                  <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class RecurringPaymentsListComponent implements OnInit {
  payments: RecurringPaymentDto[] = [];
  filteredPayments: RecurringPaymentDto[] = [];
  categories: CategoryDto[] = [];
  loading = false;
  showInactive = false;
  filterFrequency = '';

  constructor(
    private recurringPaymentsService: RecurringPaymentsService,
    private categoriesService: CategoriesService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  applyFilter(): void {
    this.filteredPayments = this.payments.filter(p => {
      if (!this.showInactive && !p.isActive) return false;
      if (this.filterFrequency && p.frequency !== this.filterFrequency) return false;
      return true;
    });
  }

  toggleActive(payment: RecurringPaymentDto): void {
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      isActive: !payment.isActive
    }).subscribe({
      next: (updated) => {
        Object.assign(payment, updated);
        this.applyFilter();
      }
    });
  }

  updateCategory(payment: RecurringPaymentDto, categoryId: string): void {
    this.recurringPaymentsService.updateRecurringPayment(payment.id, {
      categoryId: categoryId || undefined
    }).subscribe({
      next: (updated) => Object.assign(payment, updated)
    });
  }

  private loadData(): void {
    this.loading = true;
    forkJoin({
      payments: this.recurringPaymentsService.getRecurringPayments(),
      categories: this.categoriesService.getCategories()
    }).subscribe({
      next: ({ payments, categories }) => {
        this.payments = payments;
        this.categories = categories;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
