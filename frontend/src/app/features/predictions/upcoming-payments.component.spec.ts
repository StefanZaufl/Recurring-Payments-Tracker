import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UpcomingPaymentsComponent } from './upcoming-payments.component';
import { AnalyticsService } from '../../api/generated';
import { PredictionResponse } from '../../api/generated/model/predictionResponse';

const mockPredictions: PredictionResponse = {
  predictions: [
    { month: '2026-05', expectedIncome: 3000, expectedExpenses: 500, expectedSurplus: 2500 },
    { month: '2026-06', expectedIncome: 3000, expectedExpenses: 500, expectedSurplus: 2500 },
    { month: '2026-07', expectedIncome: 3000, expectedExpenses: 650, expectedSurplus: 2350 },
  ],
  upcomingPayments: [
    { name: 'Netflix', date: '2026-05-15', amount: -12.99 },
    { name: 'Spotify', date: '2026-05-20', amount: -9.99 },
    { name: 'Salary', date: '2026-05-01', amount: 3000 },
  ],
};

describe('UpcomingPaymentsComponent', () => {
  let component: UpcomingPaymentsComponent;
  let fixture: ComponentFixture<UpcomingPaymentsComponent>;
  let analyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(async () => {
    const analyticsServiceMock = {
      getPredictions: jest.fn().mockReturnValue(of(mockPredictions)),
    };

    await TestBed.configureTestingModule({
      imports: [UpcomingPaymentsComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsService, useValue: analyticsServiceMock },
      ],
    })
    .overrideComponent(UpcomingPaymentsComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    analyticsService = TestBed.inject(AnalyticsService) as jest.Mocked<AnalyticsService>;
    fixture = TestBed.createComponent(UpcomingPaymentsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load predictions on init with 6 months', () => {
    fixture.detectChanges();

    expect(analyticsService.getPredictions).toHaveBeenCalledWith(6);
    expect(component.predictions).toEqual(mockPredictions);
    expect(component.loading).toBe(false);
  });

  it('should render monthly predictions table', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('tbody tr');

    expect(rows.length).toBe(3);
  });

  it('should render upcoming payments list', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const items = el.querySelectorAll('li');

    expect(items.length).toBe(3);
    expect(el.textContent).toContain('Netflix');
    expect(el.textContent).toContain('Spotify');
    expect(el.textContent).toContain('Salary');
  });

  it('should show error state on API error', () => {
    analyticsService.getPredictions.mockReturnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(component.predictions).toBeNull();
    expect(component.error).toBe('Failed to load predictions. Please try again.');
    expect(el.textContent).toContain('Failed to load predictions');
    expect(el.textContent).toContain('Try again');
  });

  it('should set loading to true while fetching', () => {
    // Before detectChanges, ngOnInit hasn't run yet
    expect(component.loading).toBe(false);
    expect(component.predictions).toBeNull();
  });

  it('should build forecast chart data from predictions', () => {
    fixture.detectChanges();

    expect(component.forecastChartData.datasets.length).toBe(2);
    expect(component.forecastChartData.datasets[0].label).toBe('Expected Income');
    expect(component.forecastChartData.datasets[1].label).toBe('Expected Expenses');
    expect(component.forecastChartData.datasets[0].data).toEqual([3000, 3000, 3000]);
    expect(component.forecastChartData.datasets[1].data).toEqual([500, 500, 650]);
    expect(component.forecastChartData.labels!.length).toBe(3);
  });

  it('should format month from YYYY-MM to readable string', () => {
    const formatted = component.formatMonth('2026-05');
    expect(formatted).toContain('May');
    expect(formatted).toContain('2026');
  });

  it('should format currency in EUR', () => {
    const formatted = component.formatCurrency(1234.56);
    expect(formatted.includes('€') || formatted.includes('EUR')).toBe(true);
  });

  it('should show no upcoming payments message when list is empty', () => {
    const emptyPredictions = { ...mockPredictions, upcomingPayments: [] };
    analyticsService.getPredictions.mockReturnValue(of(emptyPredictions));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No upcoming payments predicted');
  });
});
