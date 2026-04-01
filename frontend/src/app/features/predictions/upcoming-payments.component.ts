import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsService } from '../../api/generated';
import { PredictionResponse } from '../../api/generated/model/predictionResponse';

@Component({
  selector: 'app-upcoming-payments',
  imports: [CommonModule, RouterLink, BaseChartDirective],
  template: `
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Predictions</h1>

      <!-- Loading -->
      <div *ngIf="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <!-- Error state -->
      <div *ngIf="!loading && error" class="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
        <div class="flex items-center">
          <svg class="h-5 w-5 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
          </svg>
          <p class="text-red-800 text-sm">{{ error }}</p>
        </div>
        <button (click)="loadData()" class="mt-3 text-sm text-red-700 underline hover:text-red-900">Try again</button>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && !error && !predictions" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <h3 class="mt-2 text-sm font-semibold text-gray-900">No predictions available</h3>
        <p class="mt-1 text-sm text-gray-500">Upload bank transactions to generate payment predictions.</p>
        <div class="mt-4">
          <a routerLink="/upload"
             class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Upload CSV
          </a>
        </div>
      </div>

      <div *ngIf="!loading && predictions">
        <!-- Monthly forecast chart -->
        <div class="bg-white rounded-lg shadow p-5 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Monthly Forecast (Next 6 Months)</h2>
          <div class="h-72">
            <canvas baseChart
                    [datasets]="forecastChartData.datasets"
                    [labels]="forecastChartData.labels"
                    [options]="forecastChartOptions"
                    type="bar">
            </canvas>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Monthly predictions table -->
          <div class="bg-white rounded-lg shadow">
            <div class="px-5 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Monthly Predictions</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                    <th class="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Income</th>
                    <th class="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                    <th class="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Surplus</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr *ngFor="let pred of predictions.predictions" class="hover:bg-gray-50">
                    <td class="px-5 py-3 text-sm font-medium text-gray-900">{{ formatMonth(pred.month) }}</td>
                    <td class="px-5 py-3 text-sm text-right text-green-600 font-medium">{{ formatCurrency(pred.expectedIncome) }}</td>
                    <td class="px-5 py-3 text-sm text-right text-red-600 font-medium">{{ formatCurrency(pred.expectedExpenses) }}</td>
                    <td class="px-5 py-3 text-sm text-right font-medium"
                        [class.text-green-600]="pred.expectedSurplus >= 0"
                        [class.text-red-600]="pred.expectedSurplus < 0">
                      {{ formatCurrency(pred.expectedSurplus) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Upcoming payments list -->
          <div class="bg-white rounded-lg shadow">
            <div class="px-5 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Upcoming Payments</h2>
            </div>
            <div *ngIf="predictions.upcomingPayments.length === 0" class="p-5">
              <p class="text-sm text-gray-500">No upcoming payments predicted.</p>
            </div>
            <ul *ngIf="predictions.upcomingPayments.length > 0" class="divide-y divide-gray-200">
              <li *ngFor="let payment of predictions.upcomingPayments" class="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ payment.name }}</p>
                  <p class="text-xs text-gray-500">{{ formatDate(payment.date) }}</p>
                </div>
                <span class="text-sm font-medium"
                      [class.text-green-600]="payment.amount > 0"
                      [class.text-red-600]="payment.amount <= 0">
                  {{ formatCurrency(payment.amount) }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UpcomingPaymentsComponent implements OnInit {
  loading = false;
  error: string | null = null;
  predictions: PredictionResponse | null = null;

  forecastChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  forecastChartOptions: ChartConfiguration<'bar'>['options'] = {
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

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  formatMonth(month: string): string {
    // month is "YYYY-MM" format
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-AT', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.analyticsService.getPredictions(6).subscribe({
      next: (data) => {
        this.predictions = data;
        this.buildForecastChart(data);
        this.loading = false;
      },
      error: (err) => {
        this.predictions = null;
        this.error = err.error?.message || 'Failed to load predictions. Please try again.';
        this.loading = false;
      }
    });
  }

  private buildForecastChart(data: PredictionResponse): void {
    this.forecastChartData = {
      labels: data.predictions.map(p => this.formatMonth(p.month)),
      datasets: [
        {
          label: 'Expected Income',
          data: data.predictions.map(p => p.expectedIncome),
          backgroundColor: '#10B981'
        },
        {
          label: 'Expected Expenses',
          data: data.predictions.map(p => p.expectedExpenses),
          backgroundColor: '#EF4444'
        }
      ]
    };
  }
}
