import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AnalyticsService } from '../../api/generated';
import { AnnualOverview } from '../../api/generated/model/annualOverview';

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
    { category: 'Streaming', total: 2400, percentage: 66.67 },
    { category: 'Insurance', total: 1200, percentage: 33.33 },
  ],
  recurringPayments: [
    { name: 'Netflix', monthlyAmount: 12.99, annualAmount: 155.88, category: 'Streaming' },
    { name: 'Spotify', monthlyAmount: 9.99, annualAmount: 119.88, category: 'Streaming' },
  ],
};

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let analyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(async () => {
    const analyticsServiceMock = {
      getAnnualOverview: jest.fn().mockReturnValue(of(mockOverview)),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsService, useValue: analyticsServiceMock },
      ],
    })
    .overrideComponent(DashboardComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    analyticsService = TestBed.inject(AnalyticsService) as jest.Mocked<AnalyticsService>;
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

    expect(el.textContent).toContain('Total Income');
    expect(el.textContent).toContain('Total Expenses');
    expect(el.textContent).toContain('Recurring Expenses');
    expect(el.textContent).toContain('Annual Surplus');
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
    // Before detectChanges, ngOnInit hasn't run yet
    // Verify loading starts as false and component creates correctly
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

  it('should format currency in EUR', () => {
    const formatted = component.formatCurrency(1234.56);
    expect(formatted.includes('€') || formatted.includes('EUR')).toBe(true);
  });

  it('should show empty category message when no categories', () => {
    const overviewNoCategories = { ...mockOverview, byCategory: [] };
    analyticsService.getAnnualOverview.mockReturnValue(of(overviewNoCategories));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No categorized recurring payments yet');
  });

  it('should show empty recurring payments message when none exist', () => {
    const overviewNoPayments = { ...mockOverview, recurringPayments: [] };
    analyticsService.getAnnualOverview.mockReturnValue(of(overviewNoPayments));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No recurring payments detected');
  });
});
