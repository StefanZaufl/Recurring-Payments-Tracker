import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsService } from '../../api/generated';
import { PredictionResponse } from '../../api/generated/model/predictionResponse';
import { Subject, takeUntil } from 'rxjs';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner.component';
import { ErrorStateComponent } from '../../shared/error-state.component';
import { CHART_THEME } from '../../shared/constants';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';

@Component({
  selector: 'app-upcoming-payments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BaseChartDirective, LoadingSpinnerComponent, ErrorStateComponent, CurrencyFormatPipe],
  template: `
    <div class="animate-fade-in">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Predictions</h1>
        <p class="text-sm text-muted mt-0.5">6-month payment forecast</p>
      </div>
    
      <!-- Loading -->
      @if (loading) {
        <app-loading-spinner message="Generating predictions..." />
      }

      <!-- Error state -->
      @if (!loading && error) {
        <app-error-state [message]="error" (retry)="loadData()" />
      }
    
      <!-- Empty state -->
      @if (!loading && !error && !predictions) {
        <div class="glass-card p-10 sm:p-16 text-center animate-slide-up">
          <div class="w-16 h-16 rounded-2xl bg-sky-dim flex items-center justify-center mx-auto mb-5">
            <svg class="w-7 h-7 text-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <h3 class="text-base font-semibold text-white mb-1">No predictions available</h3>
          <p class="text-sm text-muted mb-5">Upload bank transactions to generate forecasts.</p>
          <a routerLink="/upload" class="btn-primary">Upload CSV</a>
        </div>
      }
    
      @if (!loading && predictions) {
        <div class="animate-slide-up">
          <!-- Forecast chart -->
          <div class="glass-card p-4 sm:p-5 mb-5 sm:mb-6">
            <h2 class="text-sm font-semibold text-white mb-4">Monthly Forecast</h2>
            <div class="h-52 sm:h-72">
              <canvas baseChart
                role="img"
                aria-label="Bar chart showing 6-month income and expense forecast"
                [datasets]="forecastChartData.datasets"
                [labels]="forecastChartData.labels"
                [options]="forecastChartOptions"
                type="bar">
              </canvas>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <!-- Monthly predictions -->
            <div class="glass-card overflow-hidden">
              <div class="px-4 sm:px-5 py-4 border-b border-card-border">
                <h2 class="text-sm font-semibold text-white">Monthly Breakdown</h2>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full">
                  <thead>
                    <tr class="border-b border-card-border">
                      <th class="table-header">Month</th>
                      <th class="table-header text-right">Income</th>
                      <th class="table-header text-right">Expenses</th>
                      <th class="table-header text-right">Surplus</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-card-border">
                    @for (pred of predictions.predictions; track pred) {
                      <tr class="hover:bg-card-hover transition-colors">
                        <td class="table-cell font-medium text-white text-xs">{{ formatMonth(pred.month) }}</td>
                        <td class="table-cell text-right">
                          <div class="font-mono text-xs text-accent">{{ pred.expectedIncome | appCurrency }}</div>
                          <div class="mt-1 text-[10px] text-muted font-mono leading-4">
                            <span>Recurring {{ pred.recurringIncome | appCurrency }}</span>
                            <span class="mx-1">/</span>
                            <span>Additional {{ pred.additionalIncome | appCurrency }}</span>
                          </div>
                        </td>
                        <td class="table-cell text-right">
                          <div class="font-mono text-xs text-coral">{{ pred.expectedExpenses | appCurrency }}</div>
                          <div class="mt-1 text-[10px] text-muted font-mono leading-4">
                            <span>Recurring {{ pred.recurringExpenses | appCurrency }}</span>
                            <span class="mx-1">/</span>
                            <span>Additional {{ pred.additionalExpenses | appCurrency }}</span>
                          </div>
                        </td>
                        <td class="table-cell text-right font-mono text-xs font-medium"
                          [class.text-accent]="pred.expectedSurplus >= 0"
                          [class.text-coral]="pred.expectedSurplus < 0">
                          {{ pred.expectedSurplus | appCurrency }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <!-- Upcoming payments -->
            <div class="glass-card overflow-hidden">
              <div class="px-4 sm:px-5 py-4 border-b border-card-border flex items-center justify-between">
                <h2 class="text-sm font-semibold text-white">Upcoming Payments</h2>
                <span class="text-xs text-muted font-mono">{{ predictions.upcomingPayments.length }}</span>
              </div>
              @if (predictions.upcomingPayments.length === 0) {
                <div class="p-6 text-center">
                  <p class="text-sm text-muted">No upcoming payments predicted.</p>
                </div>
              }
              @if (predictions.upcomingPayments.length > 0) {
                <ul class="divide-y divide-card-border max-h-[400px] overflow-y-auto">
                  @for (payment of predictions.upcomingPayments; track payment) {
                    <li
                      class="px-4 sm:px-5 py-3 flex items-center justify-between hover:bg-card-hover transition-colors">
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-white truncate">{{ payment.name }}</p>
                        <p class="text-[11px] text-muted font-mono mt-0.5">{{ formatDate(payment.date) }}</p>
                      </div>
                      <span class="font-mono text-xs font-medium shrink-0 ml-3"
                        [class.text-accent]="payment.amount > 0"
                        [class.text-coral]="payment.amount <= 0">
                        {{ payment.amount | appCurrency }}
                      </span>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        </div>
      }
    </div>
    `
})
export class UpcomingPaymentsComponent implements OnInit, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  loading = false;
  error: string | null = null;
  predictions: PredictionResponse | null = null;

  forecastChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  forecastChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: CHART_THEME.labelColor, font: { family: CHART_THEME.fontFamily, size: 11 }, boxWidth: 10, padding: 16 }
      }
    },
    scales: {
      x: {
        grid: { color: CHART_THEME.gridColor },
        ticks: { color: CHART_THEME.labelColor, font: { family: CHART_THEME.fontFamily, size: 10 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: CHART_THEME.gridColor },
        ticks: {
          color: CHART_THEME.labelColor,
          font: { family: CHART_THEME.monoFontFamily, size: 10 },
          callback: (value) => `${value}`
        }
      }
    }
  };

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formatMonth(month: string): string {
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-AT', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.analyticsService.getPredictions(6).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.predictions = data;
        this.buildForecastChart(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.predictions = null;
        this.error = err.error?.message || 'Failed to load predictions. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private buildForecastChart(data: PredictionResponse): void {
    this.forecastChartData = {
      labels: data.predictions.map(p => this.formatMonth(p.month)),
      datasets: [
        {
          label: 'Recurring Income',
          data: data.predictions.map(p => p.recurringIncome),
          backgroundColor: CHART_THEME.incomeColor,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Additional Income',
          data: data.predictions.map(p => p.additionalIncome),
          backgroundColor: 'rgba(22, 163, 74, 0.45)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Recurring Expenses',
          data: data.predictions.map(p => p.recurringExpenses),
          backgroundColor: CHART_THEME.expenseColor,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Additional Expenses',
          data: data.predictions.map(p => p.additionalExpenses),
          backgroundColor: 'rgba(244, 63, 94, 0.45)',
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    };
  }
}
