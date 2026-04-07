import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TransactionsComponent } from './transactions.component';
import { BankAccountsService, TransactionsService } from '../../api/generated';
import { BankAccountDto } from '../../api/generated/model/bankAccountDto';
import { TransactionPage } from '../../api/generated/model/transactionPage';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';

const mockPage: TransactionPage = {
  content: [
    { id: '1', bookingDate: '2026-03-15', partnerName: 'Netflix', amount: -12.99, details: 'Subscription', account: 'DE111', isInterAccount: false },
    { id: '2', bookingDate: '2026-03-10', partnerName: 'Employer', amount: 3500.00, details: 'Salary', account: 'DE222', isInterAccount: true },
  ],
  totalElements: 2,
  totalPages: 1,
};

const mockBankAccounts: BankAccountDto[] = [
  { id: 'acc-1', iban: 'DE111', name: 'Checking' },
  { id: 'acc-2', iban: 'DE222', name: 'Savings' },
];

const mockPageMulti: TransactionPage = {
  content: [
    { id: '1', bookingDate: '2026-03-15', partnerName: 'Netflix', amount: -12.99 },
    { id: '2', bookingDate: '2026-03-10', partnerName: 'Spotify', amount: -9.99 },
  ],
  totalElements: 50,
  totalPages: 2,
};

const emptyPage: TransactionPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
};

describe('TransactionsComponent', () => {
  let component: TransactionsComponent;
  let fixture: ComponentFixture<TransactionsComponent>;
  let service: jest.Mocked<TransactionsService>;
  let bankAccountsService: jest.Mocked<BankAccountsService>;

  beforeEach(async () => {
    const serviceMock = {
      getTransactions: jest.fn().mockReturnValue(of(mockPage)),
    };
    const bankAccountsServiceMock = {
      getBankAccounts: jest.fn().mockReturnValue(of(mockBankAccounts)),
    };

    await TestBed.configureTestingModule({
      imports: [TransactionsComponent],
      providers: [
        provideRouter([]),
        { provide: TransactionsService, useValue: serviceMock },
        { provide: BankAccountsService, useValue: bankAccountsServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    service = TestBed.inject(TransactionsService) as jest.Mocked<TransactionsService>;
    bankAccountsService = TestBed.inject(BankAccountsService) as jest.Mocked<BankAccountsService>;
    fixture = TestBed.createComponent(TransactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load transactions on init', () => {
    expect(component).toBeTruthy();
    expect(service.getTransactions).toHaveBeenCalledWith(
      undefined, undefined, undefined, undefined, undefined, 0, 25, 'bookingDate', 'desc'
    );
    expect(bankAccountsService.getBankAccounts).toHaveBeenCalled();
    expect(component.transactions.length).toBe(2);
    expect(component.totalElements).toBe(2);
  });

  it('should display transaction count', () => {
    expect(component.totalElements).toBe(2);
  });

  it('should filter by date range', () => {
    service.getTransactions.mockReturnValue(of(emptyPage));
    component.onDateRangeChanged({ from: '2026-01-01', to: '2026-01-31', label: 'January' });

    expect(service.getTransactions).toHaveBeenCalledWith(
      '2026-01-01', '2026-01-31', undefined, undefined, undefined, 0, 25, 'bookingDate', 'desc'
    );
    expect(component.page).toBe(0);
  });

  it('should filter by search text with debounce', fakeAsync(() => {
    service.getTransactions.mockClear();
    service.getTransactions.mockReturnValue(of(mockPage));
    component.onSearchChange('netflix');

    tick(300);
    expect(service.getTransactions).not.toHaveBeenCalled();

    tick(100);
    expect(service.getTransactions).toHaveBeenCalledWith(
      undefined, undefined, 'netflix', undefined, undefined, 0, 25, 'bookingDate', 'desc'
    );
  }));

  it('should change sort field and reset page', () => {
    component.page = 2;
    service.getTransactions.mockReturnValue(of(mockPage));
    component.onSortChange('partnerName');

    expect(component.sortField).toBe('partnerName');
    expect(component.page).toBe(0);
    expect(service.getTransactions).toHaveBeenCalledWith(
      undefined, undefined, undefined, undefined, undefined, 0, 25, 'partnerName', 'desc'
    );
  });

  it('should toggle sort direction', () => {
    service.getTransactions.mockReturnValue(of(mockPage));
    component.toggleSortDirection();

    expect(component.sortDir).toBe('asc');
    expect(service.getTransactions).toHaveBeenCalledWith(
      undefined, undefined, undefined, undefined, undefined, 0, 25, 'bookingDate', 'asc'
    );
  });

  it('should navigate pages', () => {
    service.getTransactions.mockReturnValue(of(mockPageMulti));
    component.loadTransactions();
    fixture.detectChanges();

    expect(component.totalPages).toBe(2);

    service.getTransactions.mockReturnValue(of(mockPageMulti));
    component.goToPage(1);
    expect(component.page).toBe(1);
    expect(service.getTransactions).toHaveBeenCalledWith(
      undefined, undefined, undefined, undefined, undefined, 1, 25, 'bookingDate', 'desc'
    );
  });

  it('should filter by account', () => {
    service.getTransactions.mockReturnValue(of(mockPage));

    component.onAccountChange('DE111');

    expect(service.getTransactions).toHaveBeenCalledWith(
      undefined, undefined, undefined, 'DE111', undefined, 0, 25, 'bookingDate', 'desc'
    );
  });

  it('should resolve account label from bank accounts', () => {
    expect(component.accountLabel('DE111')).toBe('Checking');
    expect(component.accountLabel('DE999')).toBe('DE999');
  });

  it('should not navigate to invalid pages', () => {
    component.totalPages = 2;
    const callsBefore = service.getTransactions.mock.calls.length;

    component.goToPage(-1);
    component.goToPage(2);
    expect(service.getTransactions.mock.calls.length).toBe(callsBefore);
  });

  it('should handle error state', () => {
    service.getTransactions.mockReturnValue(throwError(() => ({ error: { message: 'Server error' } })));
    component.loadTransactions();

    expect(component.error).toBe('Server error');
    expect(component.loading).toBe(false);
  });

  it('should show empty state when no transactions', () => {
    service.getTransactions.mockReturnValue(of(emptyPage));
    component.loadTransactions();

    expect(component.transactions.length).toBe(0);
    expect(component.totalElements).toBe(0);
  });

  it('should format amounts correctly via pipe', () => {
    const pipe = new CurrencyFormatPipe();
    expect(pipe.transform(-12.99, true)).toContain('-');
    expect(pipe.transform(3500, true)).toContain('+');
  });

  it('should format dates', () => {
    const result = component.formatDate('2026-03-15');
    expect(result).toContain('Mar');
    expect(result).toContain('2026');
  });
});
