import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CreatePaymentComponent } from './create-payment.component';
import { RecurringPaymentsService, TransactionsService } from '../../api/generated';
import { TransactionPage } from '../../api/generated/model/transactionPage';
import { SimulateRulesResponse } from '../../api/generated/model/simulateRulesResponse';
import { SimulationDraftType } from '../../api/generated/model/simulationDraftType';
import { TransactionDto } from '../../api/generated/model/transactionDto';

const emptyPage: TransactionPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  filteredSum: 0,
};

const emptySimulation: SimulateRulesResponse = {
  matchingTransactions: [],
  totalMatchCount: 0,
  overlappingPayments: [],
  omittedAdditionalMatchCount: 0,
  omittedAdditionalMatches: [],
};

describe('CreatePaymentComponent', () => {
  let fixture: ComponentFixture<CreatePaymentComponent>;
  let component: CreatePaymentComponent;
  let transactionsService: jest.Mocked<TransactionsService>;
  let recurringPaymentsService: jest.Mocked<RecurringPaymentsService>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-04-14T12:00:00Z'));

    const transactionsServiceMock = {
      getTransactions: jest.fn().mockReturnValue(of(emptyPage)),
    };
    const recurringPaymentsServiceMock = {
      simulateRules: jest.fn().mockReturnValue(of(emptySimulation)),
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
    recurringPaymentsService = TestBed.inject(RecurringPaymentsService) as jest.Mocked<RecurringPaymentsService>;
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
      '2024-04-14', undefined, undefined, undefined, 'ADDITIONAL', undefined, 0, 20, 'bookingDate', 'desc'
    );
  });

  it('should update copy to describe additional transactions and the 2-year window', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Additional Transactions');
    expect(el.textContent).toContain('Showing transactions from the last 2 years');
    expect(el.textContent).not.toContain('Unlinked Transactions');
  });

  it('should simulate with empty rules on init so additional groups can be filtered', () => {
    jest.advanceTimersByTime(400);

    expect(recurringPaymentsService.simulateRules).toHaveBeenCalledWith({
      draftType: SimulationDraftType.RecurringPayment,
      rules: [],
    });
  });

  it('should hide transactions omitted by additional groups from the all transactions view', () => {
    const amazon: TransactionDto = {
      id: 'tx-amazon',
      bookingDate: '2026-04-01',
      partnerName: 'Amazon Marketplace',
      amount: -42,
    };
    const spotify: TransactionDto = {
      id: 'tx-spotify',
      bookingDate: '2026-04-02',
      partnerName: 'Spotify',
      amount: -9.99,
    };

    component.allTransactions = [amazon, spotify];
    component.omittedAdditionalIds = new Set(['tx-amazon']);

    expect(component.displayedTransactions).toEqual([spotify]);
  });

  it('should not render transactions before additional filters are loaded', () => {
    component.allTransactions = [{
      id: 'tx-amazon',
      bookingDate: '2026-04-01',
      partnerName: 'Amazon Marketplace',
      amount: -42,
    }];
    component.loadingTransactions = false;
    component.additionalFiltersLoaded = false;

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Loading transactions...');
    expect(text).not.toContain('Amazon Marketplace');
  });

  it('should not render a message for omitted additional transactions', () => {
    component.omittedAdditionalIds = new Set(['tx-1']);

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).not.toContain('excluded by Additional rule groups');
    expect(text).not.toContain('Groups in preview');
    expect(text).not.toContain('Transaction details unavailable');
  });
});
