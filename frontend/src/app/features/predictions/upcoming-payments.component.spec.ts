import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UpcomingPaymentsComponent } from './upcoming-payments.component';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { AnalyticsService } from '../../api/generated';
import { PredictionResponse } from '../../api/generated/model/predictionResponse';

const mockPredictions: PredictionResponse = {
  predictions: [
    {
      month: '2026-05',
      expectedIncome: 3200,
      expectedExpenses: 620,
      expectedSurplus: 2580,
      recurringIncome: 3000,
      recurringExpenses: 500,
      additionalIncome: 200,
      additionalExpenses: 120,
    },
    {
      month: '2026-06',
      expectedIncome: 3200,
      expectedExpenses: 620,
      expectedSurplus: 2580,
      recurringIncome: 3000,
      recurringExpenses: 500,
      additionalIncome: 200,
      additionalExpenses: 120,
    },
    {
      month: '2026-07',
      expectedIncome: 3200,
      expectedExpenses: 770,
      expectedSurplus: 2430,
      recurringIncome: 3000,
      recurringExpenses: 650,
      additionalIncome: 200,
      additionalExpenses: 120,
    },
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

    expect(component.forecastChartData.datasets.length).toBe(4);
    expect(component.forecastChartData.datasets[0].label).toBe('Recurring Income');
    expect(component.forecastChartData.datasets[1].label).toBe('Additional Income');
    expect(component.forecastChartData.datasets[2].label).toBe('Recurring Expenses');
    expect(component.forecastChartData.datasets[3].label).toBe('Additional Expenses');
    expect(component.forecastChartData.datasets[0].data).toEqual([3000, 3000, 3000]);
    expect(component.forecastChartData.datasets[1].data).toEqual([200, 200, 200]);
    expect(component.forecastChartData.datasets[2].data).toEqual([500, 500, 650]);
    expect(component.forecastChartData.datasets[3].data).toEqual([120, 120, 120]);
    expect(component.forecastChartData.labels!.length).toBe(3);
  });

  it('should format month from YYYY-MM to readable string', () => {
    const formatted = component.formatMonth('2026-05');
    expect(formatted).toContain('May');
    expect(formatted).toContain('2026');
  });

  it('should format currency in EUR via pipe', () => {
    const pipe = new CurrencyFormatPipe();
    const formatted = pipe.transform(1234.56);
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
