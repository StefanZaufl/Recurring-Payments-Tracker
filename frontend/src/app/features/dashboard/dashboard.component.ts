import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsService } from '../../api/generated';
import { AnnualOverview } from '../../api/generated/model/annualOverview';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, BaseChartDirective],
  template: `
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Annual Overview</h1>
        <div class="flex items-center gap-2">
          <button (click)="changeYear(-1)"
                  class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            &larr;
          </button>
          <span class="px-3 py-1.5 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-md min-w-[5rem] text-center">
            {{ selectedYear }}
          </span>
          <button (click)="changeYear(1)"
                  class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            &rarr;
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && !overview" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <h3 class="mt-2 text-sm font-semibold text-gray-900">No data available</h3>
        <p class="mt-1 text-sm text-gray-500">Upload a CSV file to see your annual overview.</p>
        <div class="mt-4">
          <a routerLink="/upload"
             class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Upload CSV
          </a>
        </div>
      </div>

      <!-- Dashboard content -->
      <div *ngIf="!loading && overview">
        <!-- Summary cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div class="bg-white rounded-lg shadow p-5">
            <p class="text-sm font-medium text-gray-500">Total Income</p>
            <p class="mt-1 text-2xl font-bold text-green-600">{{ formatCurrency(overview.totalIncome) }}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-5">
            <p class="text-sm font-medium text-gray-500">Total Expenses</p>
            <p class="mt-1 text-2xl font-bold text-red-600">{{ formatCurrency(overview.totalExpenses) }}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-5">
            <p class="text-sm font-medium text-gray-500">Recurring Expenses</p>
            <p class="mt-1 text-2xl font-bold text-orange-600">{{ formatCurrency(overview.totalRecurringExpenses) }}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-5">
            <p class="text-sm font-medium text-gray-500">Annual Surplus</p>
            <p class="mt-1 text-2xl font-bold"
               [class.text-green-600]="overview.totalIncome - overview.totalExpenses >= 0"
               [class.text-red-600]="overview.totalIncome - overview.totalExpenses < 0">
              {{ formatCurrency(overview.totalIncome - overview.totalExpenses) }}
            </p>
          </div>
        </div>

        <!-- Charts row -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <!-- Monthly income vs expenses bar chart -->
          <div class="lg:col-span-2 bg-white rounded-lg shadow p-5">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Monthly Income vs Expenses</h2>
            <div class="h-72">
              <canvas baseChart
                      [datasets]="barChartData.datasets"
                      [labels]="barChartData.labels"
                      [options]="barChartOptions"
                      type="bar">
              </canvas>
            </div>
          </div>

          <!-- Category pie chart -->
          <div class="bg-white rounded-lg shadow p-5">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h2>
            <div *ngIf="overview.byCategory.length > 0" class="h-72 flex items-center justify-center">
              <canvas baseChart
                      [datasets]="pieChartData.datasets"
                      [labels]="pieChartData.labels"
                      [options]="pieChartOptions"
                      type="doughnut">
              </canvas>
            </div>
            <div *ngIf="overview.byCategory.length === 0" class="h-72 flex items-center justify-center">
              <p class="text-sm text-gray-500">No categorized recurring payments yet.</p>
            </div>
          </div>
        </div>

        <!-- Recurring payments table -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-5 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Recurring Payments Summary</h2>
          </div>
          <div *ngIf="overview.recurringPayments.length === 0" class="p-5">
            <p class="text-sm text-gray-500">No recurring payments detected. Upload bank transactions to detect patterns.</p>
          </div>
          <div *ngIf="overview.recurringPayments.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th class="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly</th>
                  <th class="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Annual</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let payment of overview.recurringPayments" class="hover:bg-gray-50">
                  <td class="px-5 py-3 text-sm font-medium text-gray-900">{{ payment.name }}</td>
                  <td class="px-5 py-3 text-sm text-gray-500">
                    <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                      {{ payment.category }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-sm text-right text-red-600 font-medium">{{ formatCurrency(payment.monthlyAmount) }}</td>
                  <td class="px-5 py-3 text-sm text-right text-red-600 font-medium">{{ formatCurrency(payment.annualAmount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  selectedYear = new Date().getFullYear();
  loading = false;
  overview: AnnualOverview | null = null;

  private readonly monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  barChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `€${value}`
        }
      }
    }
  };

  pieChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  pieChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } }
    }
  };

  private readonly categoryColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  changeYear(delta: number): void {
    this.selectedYear += delta;
    this.loadData();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  private loadData(): void {
    this.loading = true;
    this.analyticsService.getAnnualOverview(this.selectedYear).subscribe({
      next: (data) => {
        this.overview = data;
        this.buildBarChart(data);
        this.buildPieChart(data);
        this.loading = false;
      },
      error: () => {
        this.overview = null;
        this.loading = false;
      }
    });
  }

  private buildBarChart(data: AnnualOverview): void {
    this.barChartData = {
      labels: this.monthLabels,
      datasets: [
        {
          label: 'Income',
          data: data.monthlyBreakdown.map(m => m.income),
          backgroundColor: '#10B981'
        },
        {
          label: 'Expenses',
          data: data.monthlyBreakdown.map(m => m.expenses),
          backgroundColor: '#EF4444'
        }
      ]
    };
  }

  private buildPieChart(data: AnnualOverview): void {
    this.pieChartData = {
      labels: data.byCategory.map(c => c.category),
      datasets: [{
        data: data.byCategory.map(c => c.total),
        backgroundColor: data.byCategory.map((_, i) => this.categoryColors[i % this.categoryColors.length])
      }]
    };
  }
}
