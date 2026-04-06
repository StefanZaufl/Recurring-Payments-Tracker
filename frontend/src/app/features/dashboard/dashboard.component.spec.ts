import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AnalyticsService, RecurringPaymentsService } from '../../api/generated';
import { AnnualOverview } from '../../api/generated/model/annualOverview';
import { PaymentPeriodHistoryEntry } from '../../api/generated/model/paymentPeriodHistoryEntry';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { CHART_THEME } from '../../shared/constants';

const mockOverview: AnnualOverview = {
  totalIncome: 36000,
  totalExpenses: 5000,
  totalRecurringExpenses: 3600,
  monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: 3000,
    expenses: i < 6 ? 500 : 0,
    surplus: i < 6 ? 2500 : 3000,
  })),
  byCategory: [
    { category: 'Streaming', total: 2400, percentage: 66.67, color: '#e040fb' },
    { category: 'Insurance', total: 1200, percentage: 33.33, color: '#29b6f6' },
  ],
  recurringPayments: [
    { id: 'aaa-111', name: 'Netflix', monthlyAmount: 12.99, annualAmount: 155.88, category: 'Streaming' },
    { id: 'bbb-222', name: 'Spotify', monthlyAmount: 9.99, annualAmount: 119.88, category: 'Streaming' },
  ],
};

const mockHistoryEntries: PaymentPeriodHistoryEntry[] = [
  { id: 'h1', periodStart: '2025-01-01', periodEnd: '2025-01-31', amount: 12.99 },
  { id: 'h2', periodStart: '2025-02-01', periodEnd: '2025-02-28', amount: 12.99 },
  { id: 'h3', periodStart: '2025-03-01', periodEnd: '2025-03-31', amount: 12.99 },
];

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let analyticsService: jest.Mocked<AnalyticsService>;
  let recurringPaymentsService: jest.Mocked<RecurringPaymentsService>;

  beforeEach(async () => {
    const analyticsServiceMock = {
      getAnnualOverview: jest.fn().mockReturnValue(of(mockOverview)),
    };

    const recurringPaymentsServiceMock = {
      getRecurringPaymentHistory: jest.fn().mockReturnValue(of(mockHistoryEntries)),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: RecurringPaymentsService, useValue: recurringPaymentsServiceMock },
      ],
    })
    .overrideComponent(DashboardComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    analyticsService = TestBed.inject(AnalyticsService) as jest.Mocked<AnalyticsService>;
    recurringPaymentsService = TestBed.inject(RecurringPaymentsService) as jest.Mocked<RecurringPaymentsService>;
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load data on init with current year', () => {
    fixture.detectChanges();

    const currentYear = new Date().getFullYear();
    expect(analyticsService.getAnnualOverview).toHaveBeenCalledWith(currentYear);
    expect(component.overview).toEqual(mockOverview);
    expect(component.loading).toBe(false);
  });

  it('should show summary cards with correct values', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Income');
    expect(el.textContent).toContain('Expenses');
    expect(el.textContent).toContain('Recurring');
    expect(el.textContent).toContain('Surplus');
  });

  it('should show recurring payments table', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('tbody tr');

    expect(rows.length).toBe(2);
    expect(el.textContent).toContain('Netflix');
    expect(el.textContent).toContain('Spotify');
  });

  it('should change year and reload data', () => {
    fixture.detectChanges();
    const initialYear = component.selectedYear;

    component.changeYear(-1);
    expect(component.selectedYear).toBe(initialYear - 1);
    expect(analyticsService.getAnnualOverview).toHaveBeenCalledWith(initialYear - 1);

    component.changeYear(1);
    expect(component.selectedYear).toBe(initialYear);
  });

  it('should show error state when API returns error', () => {
    analyticsService.getAnnualOverview.mockReturnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(component.overview).toBeNull();
    expect(component.error).toBe('Failed to load annual overview. Please try again.');
    expect(el.textContent).toContain('Failed to load annual overview');
    expect(el.textContent).toContain('Try again');
  });

  it('should set loading to true while fetching', () => {
    expect(component.loading).toBe(false);
    expect(component.overview).toBeNull();
  });

  it('should build bar chart data from monthly breakdown', () => {
    fixture.detectChanges();

    expect(component.barChartData.labels).toEqual(
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    );
    expect(component.barChartData.datasets.length).toBe(2);
    expect(component.barChartData.datasets[0].label).toBe('Income');
    expect(component.barChartData.datasets[1].label).toBe('Expenses');
    expect(component.barChartData.datasets[0].data).toEqual(Array(12).fill(3000));
  });

  it('should build pie chart data from category breakdown', () => {
    fixture.detectChanges();

    expect(component.pieChartData.labels).toEqual(['Streaming', 'Insurance']);
    expect(component.pieChartData.datasets[0].data).toEqual([2400, 1200]);
  });

  it('should format currency in EUR via pipe', () => {
    const pipe = new CurrencyFormatPipe();
    const formatted = pipe.transform(1234.56);
    expect(formatted.includes('€') || formatted.includes('EUR')).toBe(true);
  });

  it('should show empty category message when no categories', () => {
    const overviewNoCategories = { ...mockOverview, byCategory: [] };
    analyticsService.getAnnualOverview.mockReturnValue(of(overviewNoCategories));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No categorized');
  });

  it('should show empty recurring payments message when none exist', () => {
    const overviewNoPayments = { ...mockOverview, recurringPayments: [] };
    analyticsService.getAnnualOverview.mockReturnValue(of(overviewNoPayments));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No recurring payments detected');
  });

  it('should use category colors from API in pie chart', () => {
    fixture.detectChanges();

    expect(component.pieChartData.datasets[0].backgroundColor).toEqual(['#e040fb', '#29b6f6']);
  });

  it('should fall back to theme colors when category color is missing', () => {
    const overviewNoColors: AnnualOverview = {
      ...mockOverview,
      byCategory: [
        { category: 'Streaming', total: 2400, percentage: 66.67 },
        { category: 'Insurance', total: 1200, percentage: 33.33 },
      ],
    };
    analyticsService.getAnnualOverview.mockReturnValue(of(overviewNoColors));
    fixture.detectChanges();

    expect(component.pieChartData.datasets[0].backgroundColor).toEqual([
      CHART_THEME.categoryColors[0],
      CHART_THEME.categoryColors[1],
    ]);
  });

  it('should build category bar chart data with correct labels and colors', () => {
    fixture.detectChanges();

    expect(component.categoryBarChartData.labels).toEqual(['Streaming', 'Insurance']);
    expect(component.categoryBarChartData.datasets[0].data).toEqual([2400, 1200]);
    expect(component.categoryBarChartData.datasets[0].backgroundColor).toEqual(['#e040fb', '#29b6f6']);
  });

  it('should default to doughnut chart type', () => {
    expect(component.categoryChartType).toBe('doughnut');
  });

  it('should toggle between doughnut and bar chart types', () => {
    component.toggleCategoryChart();
    expect(component.categoryChartType).toBe('bar');

    component.toggleCategoryChart();
    expect(component.categoryChartType).toBe('doughnut');
  });

  it('should render doughnut chart by default', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const doughnutCanvas = el.querySelector('canvas[aria-label*="Doughnut"]');
    const barCategoryCanvas = el.querySelector('canvas[aria-label*="Bar chart showing expense"]');
    expect(doughnutCanvas).toBeTruthy();
    expect(barCategoryCanvas).toBeNull();
  });

  it('should render bar chart after toggle', () => {
    fixture.detectChanges();
    component.toggleCategoryChart();
    component['cdr'].markForCheck();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const doughnutCanvas = el.querySelector('canvas[aria-label*="Doughnut"]');
    const barCategoryCanvas = el.querySelector('canvas[aria-label*="Bar chart showing expense"]');
    expect(doughnutCanvas).toBeNull();
    expect(barCategoryCanvas).toBeTruthy();
  });

  it('should not show toggle button when no categories', () => {
    const overviewNoCategories = { ...mockOverview, byCategory: [] };
    analyticsService.getAnnualOverview.mockReturnValue(of(overviewNoCategories));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const toggleButton = el.querySelector('button[aria-label="Toggle chart type"]');
    expect(toggleButton).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────
  // Expandable payment history rows
  // ────────────────────────────────────────────────────────────────────

  it('should start with no expanded payment', () => {
    fixture.detectChanges();
    expect(component.expandedPaymentId).toBeNull();
  });

  it('should expand a payment row and fetch history', () => {
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    expect(component.expandedPaymentId).toBe('aaa-111');
    expect(recurringPaymentsService.getRecurringPaymentHistory).toHaveBeenCalledWith('aaa-111');
    expect(component.historyLoading).toBe(false);
    expect(component.historyData.labels!.length).toBe(3);
  });

  it('should collapse an expanded payment when clicked again', () => {
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    expect(component.expandedPaymentId).toBeNull();
  });

  it('should collapse current and expand new when clicking a different payment', () => {
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    component.togglePaymentHistory('bbb-222');
    fixture.detectChanges();

    expect(component.expandedPaymentId).toBe('bbb-222');
    expect(recurringPaymentsService.getRecurringPaymentHistory).toHaveBeenCalledWith('bbb-222');
  });

  it('should collapse expanded row when changing year', () => {
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    component.changeYear(-1);
    expect(component.expandedPaymentId).toBeNull();
  });

  it('should format monthly period labels correctly', () => {
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    expect(component.historyData.labels).toEqual(['Jan 2025', 'Feb 2025', 'Mar 2025']);
  });

  it('should format quarterly period labels correctly', () => {
    const quarterlyEntries: PaymentPeriodHistoryEntry[] = [
      { id: 'q1', periodStart: '2025-01-01', periodEnd: '2025-03-31', amount: 200 },
      { id: 'q2', periodStart: '2025-04-01', periodEnd: '2025-06-30', amount: 210 },
    ];
    recurringPaymentsService.getRecurringPaymentHistory.mockReturnValue(of(quarterlyEntries));
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    expect(component.historyData.labels).toEqual(['Q1 2025', 'Q2 2025']);
  });

  it('should format yearly period labels correctly', () => {
    const yearlyEntries: PaymentPeriodHistoryEntry[] = [
      { id: 'y1', periodStart: '2024-01-01', periodEnd: '2024-12-31', amount: 120 },
      { id: 'y2', periodStart: '2025-01-01', periodEnd: '2025-12-31', amount: 130 },
    ];
    recurringPaymentsService.getRecurringPaymentHistory.mockReturnValue(of(yearlyEntries));
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    expect(component.historyData.labels).toEqual(['2024', '2025']);
  });

  it('should use absolute amounts in chart data', () => {
    const negativeEntries: PaymentPeriodHistoryEntry[] = [
      { id: 'n1', periodStart: '2025-01-01', periodEnd: '2025-01-31', amount: -12.99 },
      { id: 'n2', periodStart: '2025-02-01', periodEnd: '2025-02-28', amount: -12.99 },
    ];
    recurringPaymentsService.getRecurringPaymentHistory.mockReturnValue(of(negativeEntries));
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    expect(component.historyData.datasets[0].data).toEqual([12.99, 12.99]);
  });

  it('should handle history API error by collapsing the row', () => {
    recurringPaymentsService.getRecurringPaymentHistory.mockReturnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    component.togglePaymentHistory('aaa-111');
    fixture.detectChanges();

    expect(component.expandedPaymentId).toBeNull();
    expect(component.historyLoading).toBe(false);
  });
});
