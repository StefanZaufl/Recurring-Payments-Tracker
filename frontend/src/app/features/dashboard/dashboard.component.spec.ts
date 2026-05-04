import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
  totalRecurringIncome: 24000,
  totalRecurringExpenses: 3600,
  monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: 3000,
    expenses: i < 6 ? 500 : 0,
    recurringExpenses: i < 6 ? 300 : 0,
    surplus: i < 6 ? 2500 : 3000,
  })),
  byCategory: [
    { category: 'Streaming', total: 2400, percentage: 66.67, color: '#e040fb' },
    { category: 'Insurance', total: 1200, percentage: 33.33, color: '#29b6f6' },
  ],
  recurringExpenses: [
    { id: 'aaa-111', name: 'Netflix', monthlyAmount: 12.99, annualAmount: 155.88, category: 'Streaming' },
    { id: 'bbb-222', name: 'Spotify', monthlyAmount: 9.99, annualAmount: 119.88, category: 'Streaming' },
  ],
  recurringIncome: [
    { id: 'ccc-333', name: 'Salary', monthlyAmount: 2000, annualAmount: 24000, category: 'Uncategorized' },
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
    }).compileComponents();

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

  it('should render three summary cards with recurring breakdown subitems', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('app-summary-card')).toHaveLength(3);
    expect(el.textContent).toContain('Income');
    expect(el.textContent).toContain('Recurring Income');
    expect(el.textContent).toContain('Additional Income');
    expect(el.textContent).toContain('Expenses');
    expect(el.textContent).toContain('Recurring Expenses');
    expect(el.textContent).toContain('Additional Expenses');
    expect(el.textContent).toContain('Surplus');
  });

  it('should render recurring payments and recurring income tables', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Recurring Payments');
    expect(el.textContent).toContain('Recurring Income');
    expect(el.textContent).toContain('Netflix');
    expect(el.textContent).toContain('Salary');
  });

  it('should change year and reload data', () => {
    fixture.detectChanges();
    const initialYear = component.selectedYear;

    component.changeYear(-1);

    expect(component.selectedYear).toBe(initialYear - 1);
    expect(analyticsService.getAnnualOverview).toHaveBeenCalledWith(initialYear - 1);
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

  it('should build bar chart data from monthly breakdown', () => {
    fixture.detectChanges();

    expect(component.barChartData.labels).toEqual(
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    );
    expect(component.barChartData.datasets.length).toBe(3);
    expect(component.barChartData.datasets[0].label).toBe('Income');
    expect(component.barChartData.datasets[1].label).toBe('Recurring Expenses');
    expect(component.barChartData.datasets[2].label).toBe('Additional Expenses');
    expect(component.barChartData.datasets[1].data).toEqual([...Array(6).fill(300), ...Array(6).fill(0)]);
    expect(component.barChartData.datasets[2].data).toEqual([...Array(6).fill(200), ...Array(6).fill(0)]);
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
    analyticsService.getAnnualOverview.mockReturnValue(of({ ...mockOverview, byCategory: [] }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No categorized');
  });

  it('should show empty recurring table messages when arrays are empty', () => {
    analyticsService.getAnnualOverview.mockReturnValue(of({
      ...mockOverview,
      recurringExpenses: [],
      recurringIncome: [],
    }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No recurring payments detected');
    expect(el.textContent).toContain('No recurring income detected');
  });

  it('should use category colors from API in pie chart', () => {
    fixture.detectChanges();

    expect(component.pieChartData.datasets[0].backgroundColor).toEqual(['#e040fb', '#29b6f6']);
  });

  it('should fall back to theme colors when category color is missing', () => {
    analyticsService.getAnnualOverview.mockReturnValue(of({
      ...mockOverview,
      byCategory: [
        { category: 'Streaming', total: 2400, percentage: 66.67 },
        { category: 'Insurance', total: 1200, percentage: 33.33 },
      ],
    }));
    fixture.detectChanges();

    expect(component.pieChartData.datasets[0].backgroundColor).toEqual([
      CHART_THEME.categoryColors[0],
      CHART_THEME.categoryColors[1],
    ]);
  });

  it('should load expense history on request', () => {
    fixture.detectChanges();
    component.loadHistory('expense', 'aaa-111');

    expect(recurringPaymentsService.getRecurringPaymentHistory).toHaveBeenCalledWith('aaa-111', `${component.selectedYear}-01-01`, `${component.selectedYear}-12-31`);
    expect(component.expenseHistoryState.paymentId).toBe('aaa-111');
    expect(component.expenseHistoryState.loading).toBe(false);
    expect(component.expenseHistoryState.data.labels).toEqual(['Jan 2025', 'Feb 2025', 'Mar 2025']);
  });

  it('should load income history independently', () => {
    fixture.detectChanges();
    component.loadHistory('income', 'ccc-333');

    expect(recurringPaymentsService.getRecurringPaymentHistory).toHaveBeenCalledWith('ccc-333', `${component.selectedYear}-01-01`, `${component.selectedYear}-12-31`);
    expect(component.incomeHistoryState.paymentId).toBe('ccc-333');
    expect(component.expenseHistoryState.paymentId).toBeNull();
  });

  it('should format quarterly period labels correctly', () => {
    const quarterlyEntries: PaymentPeriodHistoryEntry[] = [
      { id: 'q1', periodStart: '2025-01-01', periodEnd: '2025-03-31', amount: 200 },
      { id: 'q2', periodStart: '2025-04-01', periodEnd: '2025-06-30', amount: 210 },
    ];

    expect(component.buildHistoryChart(quarterlyEntries).labels).toEqual(['Q1 2025', 'Q2 2025']);
  });

  it('should use absolute amounts in history chart data', () => {
    const negativeEntries: PaymentPeriodHistoryEntry[] = [
      { id: 'n1', periodStart: '2025-01-01', periodEnd: '2025-01-31', amount: -12.99 },
      { id: 'n2', periodStart: '2025-02-01', periodEnd: '2025-02-28', amount: -12.99 },
    ];

    expect(component.buildHistoryChart(negativeEntries).datasets[0].data).toEqual([12.99, 12.99]);
  });

  it('should reset history state on failed history fetch', () => {
    recurringPaymentsService.getRecurringPaymentHistory.mockReturnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();

    component.loadHistory('expense', 'aaa-111');

    expect(component.expenseHistoryState.paymentId).toBeNull();
    expect(component.expenseHistoryState.loading).toBe(false);
  });
});
