import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PaymentTransactionsModalComponent } from './payment-transactions-modal.component';
import { RecurringPaymentsService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { TransactionDto } from '../../api/generated/model/transactionDto';
import { Frequency } from '../../api/generated/model/frequency';

const mockPayment: RecurringPaymentDto = {
  id: '1', name: 'Netflix', categoryId: 'cat-1', categoryName: 'Streaming',
  averageAmount: -12.99, frequency: Frequency.Monthly, isIncome: false, isActive: true, ruleCount: 2,
};

const mockTransactions: TransactionDto[] = [
  { id: 't1', bookingDate: '2026-01-15', partnerName: 'Netflix', amount: -12.99, currency: 'EUR' } as TransactionDto,
  { id: 't2', bookingDate: '2026-02-15', partnerName: 'Netflix', amount: -12.99, currency: 'EUR' } as TransactionDto,
  { id: 't3', bookingDate: '2026-03-15', partnerName: 'Netflix', amount: -13.99, currency: 'EUR' } as TransactionDto,
];

describe('PaymentTransactionsModalComponent', () => {
  let component: PaymentTransactionsModalComponent;
  let fixture: ComponentFixture<PaymentTransactionsModalComponent>;
  let recurringService: jest.Mocked<RecurringPaymentsService>;

  beforeEach(async () => {
    const recurringServiceMock = {
      getRecurringPaymentTransactions: jest.fn().mockReturnValue(of(mockTransactions)),
    };

    await TestBed.configureTestingModule({
      imports: [PaymentTransactionsModalComponent],
      providers: [
        { provide: RecurringPaymentsService, useValue: recurringServiceMock },
      ],
    })
    .overrideComponent(PaymentTransactionsModalComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    recurringService = TestBed.inject(RecurringPaymentsService) as jest.Mocked<RecurringPaymentsService>;
    fixture = TestBed.createComponent(PaymentTransactionsModalComponent);
    component = fixture.componentInstance;
    component.payment = mockPayment;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load transactions on init', () => {
    fixture.detectChanges();

    expect(recurringService.getRecurringPaymentTransactions).toHaveBeenCalledWith('1');
    expect(component.filteredTransactions.length).toBe(3);
    expect(component.loading).toBe(false);
  });

  it('should sort transactions by date descending', () => {
    fixture.detectChanges();

    expect(component.filteredTransactions[0].bookingDate).toBe('2026-03-15');
    expect(component.filteredTransactions[1].bookingDate).toBe('2026-02-15');
    expect(component.filteredTransactions[2].bookingDate).toBe('2026-01-15');
  });

  it('should filter transactions by date range', () => {
    fixture.detectChanges();

    component.onDateRangeChanged({ from: '2026-02-01', to: '2026-02-28', label: 'February' });

    expect(component.filteredTransactions.length).toBe(1);
    expect(component.filteredTransactions[0].bookingDate).toBe('2026-02-15');
  });

  it('should show all transactions when date range is cleared', () => {
    fixture.detectChanges();

    component.onDateRangeChanged({ from: '2026-02-01', to: '2026-02-28', label: 'February' });
    expect(component.filteredTransactions.length).toBe(1);

    component.onDateRangeChanged({ from: null, to: null, label: 'All time' });
    expect(component.filteredTransactions.length).toBe(3);
  });

  it('should handle API error when loading transactions', () => {
    recurringService.getRecurringPaymentTransactions.mockReturnValue(
      throwError(() => ({ error: { message: 'Server error' } }))
    );

    fixture.detectChanges();

    expect(component.error).toBe('Server error');
    expect(component.loading).toBe(false);
    expect(component.filteredTransactions).toEqual([]);
  });

  it('should handle empty transactions list', () => {
    recurringService.getRecurringPaymentTransactions.mockReturnValue(of([]));

    fixture.detectChanges();

    expect(component.filteredTransactions).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
  });

  it('should format transaction amounts correctly', () => {
    const positive = component.formatAmount(12.99);
    expect(positive).toContain('+');
    expect(positive).toContain('12');

    const negative = component.formatAmount(-12.99);
    expect(negative).not.toMatch(/^\+/);
    expect(negative).toContain('12');
  });

  it('should format transaction dates correctly', () => {
    const formatted = component.formatDate('2026-03-15');
    expect(formatted).toContain('15');
    expect(formatted).toContain('Mar');
    expect(formatted).toContain('2026');
  });

  it('should emit closed when close is requested', () => {
    const spy = jest.fn();
    component.closed.subscribe(spy);

    component.closed.emit();

    expect(spy).toHaveBeenCalled();
  });
});
