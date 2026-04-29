import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Params, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TransactionsComponent } from './transactions.component';
import { BankAccountsService, TransactionsService } from '../../api/generated';
import { BankAccountDto } from '../../api/generated/model/bankAccountDto';
import { TransactionPage } from '../../api/generated/model/transactionPage';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { getThisMonthDateRange } from '../../shared/date-range-presets';

const mockPage: TransactionPage = {
  content: [
    { id: '1', bookingDate: '2026-03-15', partnerName: 'Netflix', amount: -12.99, details: 'Subscription', account: { id: 'acc-1', iban: 'DE111', name: 'Checking' }, isInterAccount: false },
    { id: '2', bookingDate: '2026-03-10', partnerName: 'Employer', amount: 3500.00, details: 'Salary', account: { id: 'acc-2', iban: 'DE222', name: 'Savings' }, isInterAccount: true },
  ],
  totalElements: 2,
  totalPages: 1,
  filteredSum: 3487.01,
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
  filteredSum: -22.98,
};

const emptyPage: TransactionPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  filteredSum: 0,
};

describe('TransactionsComponent', () => {
  let component: TransactionsComponent;
  let fixture: ComponentFixture<TransactionsComponent>;
  let service: jest.Mocked<TransactionsService>;
  let bankAccountsService: jest.Mocked<BankAccountsService>;
  let router: Router;
  const initialRange = getThisMonthDateRange(new Date('2026-04-14T12:00:00Z'));
  let queryParams: Params;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-04-14T12:00:00Z'));
    queryParams = {};

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
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap(queryParams)) } },
        { provide: TransactionsService, useValue: serviceMock },
        { provide: BankAccountsService, useValue: bankAccountsServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    service = TestBed.inject(TransactionsService) as jest.Mocked<TransactionsService>;
    bankAccountsService = TestBed.inject(BankAccountsService) as jest.Mocked<BankAccountsService>;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TransactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create and load transactions on init', () => {
    expect(component).toBeTruthy();
    expect(service.getTransactions).toHaveBeenCalledWith(
      initialRange.from, initialRange.to, undefined, undefined, 'ALL', 'ALL', 0, 25, 'bookingDate', 'desc'
    );
    expect(bankAccountsService.getBankAccounts).toHaveBeenCalled();
    expect(component.transactions.length).toBe(2);
    expect(component.totalElements).toBe(2);
    expect(component.filteredSum).toBe(3487.01);
    expect(component.from).toBe(initialRange.from);
    expect(component.to).toBe(initialRange.to);
    expect(component.transactionType).toBe('ALL');
  });

  it('should display transaction count', () => {
    expect(component.totalElements).toBe(2);
  });

  it('should display filtered sum when results exist', () => {
    const pipe = new CurrencyFormatPipe();

    expect(fixture.nativeElement.textContent).toContain('Sum');
    expect(fixture.nativeElement.textContent).toContain(pipe.transform(3487.01, true));
  });

  it('should display zero filtered sum when no transactions are found', () => {
    service.getTransactions.mockReturnValue(of(emptyPage));
    component.loadTransactions();
    fixture.detectChanges();

    const pipe = new CurrencyFormatPipe();

    expect(fixture.nativeElement.textContent).toContain('0 transactions');
    expect(fixture.nativeElement.textContent).toContain('Sum');
    expect(fixture.nativeElement.textContent).toContain(pipe.transform(0, true));
  });

  it('should not display a zero filtered sum while transactions are still loading', () => {
    component.filteredSum = null;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Sum');
    expect(text).toContain('--');
    expect(text).not.toContain('$0.00');
  });

  it('should filter by date range', () => {
    service.getTransactions.mockReturnValue(of(emptyPage));
    component.onDateRangeChanged({ from: '2026-01-01', to: '2026-01-31', label: 'January' });

    expect(component.page).toBe(0);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ from: '2026-01-01', to: '2026-01-31' }),
    }));
  });

  it('should represent all-time date filtering explicitly and load without date bounds', () => {
    service.getTransactions.mockReturnValue(of(emptyPage));

    component.onDateRangeChanged({ from: null, to: null, label: 'All time' });
    component.loadTransactions();

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ from: 'all', to: 'all' }),
    }));
    expect(service.getTransactions).toHaveBeenLastCalledWith(
      undefined, undefined, undefined, undefined, 'ALL', 'ALL', 0, 25, 'bookingDate', 'desc'
    );
  });

  it('should filter by search text with debounce', fakeAsync(() => {
    component.onSearchChange('netflix');

    tick(300);
    expect(router.navigate).not.toHaveBeenCalled();

    tick(100);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ search: 'netflix' }),
      replaceUrl: true,
    }));
  }));

  it('should change sort field and reset page', () => {
    component.page = 2;
    service.getTransactions.mockReturnValue(of(mockPage));
    component.onSortChange('partnerName');

    expect(component.sortField).toBe('partnerName');
    expect(component.page).toBe(0);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ sort: 'partnerName' }),
    }));
  });

  it('should toggle sort direction', () => {
    service.getTransactions.mockReturnValue(of(mockPage));
    component.toggleSortDirection();

    expect(component.sortDir).toBe('asc');
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ dir: 'asc' }),
    }));
  });

  it('should navigate pages', () => {
    service.getTransactions.mockReturnValue(of(mockPageMulti));
    component.loadTransactions();
    fixture.detectChanges();

    expect(component.totalPages).toBe(2);

    service.getTransactions.mockReturnValue(of(mockPageMulti));
    component.goToPage(1);
    expect(component.page).toBe(1);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ page: 1 }),
    }));
  });

  it('should filter by account', () => {
    service.getTransactions.mockReturnValue(of(mockPage));

    component.onAccountChange('DE111');

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ account: 'DE111' }),
    }));
  });

  it('should keep advanced filters collapsed by default', () => {
    fixture.detectChanges();

    expect(component.advancedFiltersExpanded).toBe(false);
    expect(component.activeAdvancedFilterCount).toBe(0);
    expect(fixture.nativeElement.querySelector('[aria-label="Account filter"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('More filters');
  });

  it('should expand advanced filters when toggled', () => {
    component.toggleAdvancedFilters();
    fixture.detectChanges();

    expect(component.advancedFiltersExpanded).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-label="Account filter"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Transaction type filter"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Transaction sign filter"]')).not.toBeNull();
  });

  it('should filter by transaction type and reset page', () => {
    component.page = 2;
    service.getTransactions.mockReturnValue(of(mockPage));

    component.onTransactionTypeChange('ADDITIONAL');

    expect(component.transactionType).toBe('ADDITIONAL');
    expect(component.page).toBe(0);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ type: 'ADDITIONAL' }),
    }));
  });

  it('should resolve account label from bank accounts', () => {
    expect(component.accountLabel({ id: 'acc-1', iban: 'DE111', name: 'Checking' })).toBe('Checking');
    expect(component.accountLabel({ id: 'acc-9', iban: 'DE999' })).toBe('DE999');
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
    fixture.detectChanges();

    expect(component.error).toBe('Server error');
    expect(component.loading).toBe(false);
    expect(component.filteredSum).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('--');
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

  it('should initialize filters from query params', async () => {
    TestBed.resetTestingModule();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-04-14T12:00:00Z'));

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
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({
              from: '2026-01-01',
              to: '2026-01-31',
              search: 'netflix',
              account: 'DE111',
              type: 'ADDITIONAL',
              sign: 'NEGATIVE',
              sort: 'partnerName',
              dir: 'asc',
              page: '2',
            })),
          },
        },
        { provide: TransactionsService, useValue: serviceMock },
        { provide: BankAccountsService, useValue: bankAccountsServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const newFixture = TestBed.createComponent(TransactionsComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    expect(newComponent.from).toBe('2026-01-01');
    expect(newComponent.to).toBe('2026-01-31');
    expect(newComponent.searchText).toBe('netflix');
    expect(newComponent.accountFilter).toBe('DE111');
    expect(newComponent.transactionType).toBe('ADDITIONAL');
    expect(newComponent.transactionSign).toBe('NEGATIVE');
    expect(newComponent.advancedFiltersExpanded).toBe(true);
    expect(newComponent.activeAdvancedFilterCount).toBe(3);
    expect(newComponent.sortField).toBe('partnerName');
    expect(newComponent.sortDir).toBe('asc');
    expect(newComponent.page).toBe(2);
    expect(serviceMock.getTransactions).toHaveBeenCalledWith(
      '2026-01-01', '2026-01-31', 'netflix', 'DE111', 'ADDITIONAL', 'NEGATIVE', 2, 25, 'partnerName', 'asc'
    );
  });

  it('should preserve all-time date filtering from query params', async () => {
    TestBed.resetTestingModule();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-04-14T12:00:00Z'));

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
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({
              from: 'all',
              to: 'all',
            })),
          },
        },
        { provide: TransactionsService, useValue: serviceMock },
        { provide: BankAccountsService, useValue: bankAccountsServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const newFixture = TestBed.createComponent(TransactionsComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    expect(newComponent.from).toBeNull();
    expect(newComponent.to).toBeNull();
    expect(serviceMock.getTransactions).toHaveBeenCalledWith(
      undefined, undefined, undefined, undefined, 'ALL', 'ALL', 0, 25, 'bookingDate', 'desc'
    );
  });

  it('should ignore invalid query params and fall back to defaults', async () => {
    TestBed.resetTestingModule();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-04-14T12:00:00Z'));

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
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({
              from: 'bad-date',
              type: 'WRONG',
              sort: 'foo',
              dir: 'down',
              page: '-1',
            })),
          },
        },
        { provide: TransactionsService, useValue: serviceMock },
        { provide: BankAccountsService, useValue: bankAccountsServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const newFixture = TestBed.createComponent(TransactionsComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    expect(newComponent.from).toBe(initialRange.from);
    expect(newComponent.to).toBe(initialRange.to);
    expect(newComponent.transactionType).toBe('ALL');
    expect(newComponent.sortField).toBe('bookingDate');
    expect(newComponent.sortDir).toBe('desc');
    expect(newComponent.page).toBe(0);
  });

  it('should update query params after debounced search', fakeAsync(() => {
    component.onSearchChange('netflix');

    tick(400);

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ search: 'netflix' }),
      replaceUrl: true,
    }));
  }));
});
