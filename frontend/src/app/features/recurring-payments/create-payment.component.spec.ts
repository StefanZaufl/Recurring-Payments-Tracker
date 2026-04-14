import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CreatePaymentComponent } from './create-payment.component';
import { RecurringPaymentsService, TransactionsService } from '../../api/generated';
import { TransactionPage } from '../../api/generated/model/transactionPage';

const emptyPage: TransactionPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
};

describe('CreatePaymentComponent', () => {
  let fixture: ComponentFixture<CreatePaymentComponent>;
  let component: CreatePaymentComponent;
  let transactionsService: jest.Mocked<TransactionsService>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-04-14T12:00:00Z'));

    const transactionsServiceMock = {
      getTransactions: jest.fn().mockReturnValue(of(emptyPage)),
    };
    const recurringPaymentsServiceMock = {
      simulateRules: jest.fn(),
      createRecurringPayment: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CreatePaymentComponent],
      providers: [
        provideRouter([]),
        { provide: TransactionsService, useValue: transactionsServiceMock },
        { provide: RecurringPaymentsService, useValue: recurringPaymentsServiceMock },
      ],
    }).compileComponents();

    transactionsService = TestBed.inject(TransactionsService) as jest.Mocked<TransactionsService>;
    fixture = TestBed.createComponent(CreatePaymentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should load additional transactions from the last 2 years on init', () => {
    expect(component).toBeTruthy();
    expect(transactionsService.getTransactions).toHaveBeenCalledWith(
      '2024-04-14', undefined, undefined, undefined, 'ADDITIONAL', 0, 20, 'bookingDate', 'desc'
    );
  });

  it('should update copy to describe additional transactions and the 2-year window', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Additional Transactions');
    expect(el.textContent).toContain('Showing transactions from the last 2 years');
    expect(el.textContent).not.toContain('Unlinked Transactions');
  });
});
