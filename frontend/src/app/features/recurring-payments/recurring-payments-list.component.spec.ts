import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RecurringPaymentsListComponent } from './recurring-payments-list.component';
import { RecurringPaymentsService, CategoriesService, RecurringPaymentRulesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { TransactionDto } from '../../api/generated/model/transactionDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { RuleDto } from '../../api/generated/model/ruleDto';
import { Frequency } from '../../api/generated/model/frequency';
import { RuleType } from '../../api/generated/model/ruleType';
import { TargetField } from '../../api/generated/model/targetField';

const mockPayments: RecurringPaymentDto[] = [
  {
    id: '1', name: 'Netflix', categoryId: 'cat-1', categoryName: 'Streaming',
    averageAmount: -12.99, frequency: Frequency.Monthly, isIncome: false, isActive: true, ruleCount: 2,
  },
  {
    id: '2', name: 'Salary', categoryId: undefined, categoryName: undefined,
    averageAmount: 3000, frequency: Frequency.Monthly, isIncome: true, isActive: true, ruleCount: 2,
  },
  {
    id: '3', name: 'Old Gym', categoryId: undefined, categoryName: undefined,
    averageAmount: -29.99, frequency: Frequency.Monthly, isIncome: false, isActive: false, ruleCount: 0,
  },
  {
    id: '4', name: 'Insurance', categoryId: 'cat-2', categoryName: 'Insurance',
    averageAmount: -150, frequency: Frequency.Quarterly, isIncome: false, isActive: true, ruleCount: 1,
  },
];

const mockCategories: CategoryDto[] = [
  { id: 'cat-1', name: 'Streaming', color: '#FF0000' },
  { id: 'cat-2', name: 'Insurance', color: '#00FF00' },
];

const mockTransactions: TransactionDto[] = [
  { id: 't1', bookingDate: '2026-01-15', partnerName: 'Netflix', amount: -12.99, currency: 'EUR' } as TransactionDto,
  { id: 't2', bookingDate: '2026-02-15', partnerName: 'Netflix', amount: -12.99, currency: 'EUR' } as TransactionDto,
  { id: 't3', bookingDate: '2026-03-15', partnerName: 'Netflix', amount: -13.99, currency: 'EUR' } as TransactionDto,
];

const mockRules: RuleDto[] = [
  { id: 'r1', ruleType: RuleType.JaroWinkler, targetField: TargetField.PartnerName, text: 'netflix', strict: true, threshold: 0.85 },
  { id: 'r2', ruleType: RuleType.Amount, amount: -12.99, fluctuationRange: 1.30 },
];

describe('RecurringPaymentsListComponent', () => {
  let component: RecurringPaymentsListComponent;
  let fixture: ComponentFixture<RecurringPaymentsListComponent>;
  let recurringService: jest.Mocked<RecurringPaymentsService>;
  let categoriesService: jest.Mocked<CategoriesService>;
  let rulesService: jest.Mocked<RecurringPaymentRulesService>;

  beforeEach(async () => {
    const recurringServiceMock = {
      getRecurringPayments: jest.fn().mockReturnValue(of(mockPayments)),
      updateRecurringPayment: jest.fn(),
      getRecurringPaymentTransactions: jest.fn().mockReturnValue(of(mockTransactions)),
    };
    const categoriesServiceMock = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
      createCategory: jest.fn(),
    };
    const rulesServiceMock = {
      getRules: jest.fn().mockReturnValue(of(mockRules)),
      createRule: jest.fn().mockReturnValue(of(mockRules[0])),
      updateRule: jest.fn().mockReturnValue(of(mockRules[0])),
      deleteRule: jest.fn().mockReturnValue(of(undefined)),
      reEvaluateRecurringPayment: jest.fn().mockReturnValue(of(mockPayments[0])),
    };

    await TestBed.configureTestingModule({
      imports: [RecurringPaymentsListComponent],
      providers: [
        provideRouter([]),
        { provide: RecurringPaymentsService, useValue: recurringServiceMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
        { provide: RecurringPaymentRulesService, useValue: rulesServiceMock },
      ],
    })
    .overrideComponent(RecurringPaymentsListComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    recurringService = TestBed.inject(RecurringPaymentsService) as jest.Mocked<RecurringPaymentsService>;
    categoriesService = TestBed.inject(CategoriesService) as jest.Mocked<CategoriesService>;
    rulesService = TestBed.inject(RecurringPaymentRulesService) as jest.Mocked<RecurringPaymentRulesService>;
    fixture = TestBed.createComponent(RecurringPaymentsListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load payments and categories on init', () => {
    fixture.detectChanges();

    expect(recurringService.getRecurringPayments).toHaveBeenCalled();
    expect(categoriesService.getCategories).toHaveBeenCalled();
    expect(component.payments).toEqual(mockPayments);
    expect(component.categories).toEqual(mockCategories);
    expect(component.loading).toBe(false);
  });

  it('should filter out inactive payments by default', () => {
    fixture.detectChanges();

    expect(component.filteredPayments.length).toBe(3);
    expect(component.filteredPayments.find(p => p.name === 'Old Gym')).toBeUndefined();
  });

  it('should show inactive payments when checkbox is toggled', () => {
    fixture.detectChanges();

    component.showInactive = true;
    component.applyFilter();
    expect(component.filteredPayments.length).toBe(4);
    expect(component.filteredPayments.find(p => p.name === 'Old Gym')).toBeDefined();
  });

  it('should filter by frequency', () => {
    fixture.detectChanges();

    component.filterFrequency = 'QUARTERLY';
    component.applyFilter();
    expect(component.filteredPayments.length).toBe(1);
    expect(component.filteredPayments[0].name).toBe('Insurance');
  });

  it('should combine frequency filter and inactive filter', () => {
    fixture.detectChanges();

    component.filterFrequency = 'MONTHLY';
    component.showInactive = false;
    component.applyFilter();
    // Active monthly: Netflix, Salary (Old Gym is inactive)
    expect(component.filteredPayments.length).toBe(2);
  });

  it('should sort by amount (descending absolute) by default', () => {
    fixture.detectChanges();

    // Salary (3000), Insurance (150), Netflix (12.99) — sorted by abs amount desc
    expect(component.filteredPayments[0].name).toBe('Salary');
    expect(component.filteredPayments[1].name).toBe('Insurance');
    expect(component.filteredPayments[2].name).toBe('Netflix');
  });

  it('should sort alphabetically when sortBy is name', () => {
    fixture.detectChanges();

    component.sortBy = 'name';
    component.applyFilter();

    expect(component.filteredPayments[0].name).toBe('Insurance');
    expect(component.filteredPayments[1].name).toBe('Netflix');
    expect(component.filteredPayments[2].name).toBe('Salary');
  });

  it('should render payment names', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Netflix');
    expect(el.textContent).toContain('Salary');
    expect(el.textContent).toContain('Insurance');
  });

  it('should display category name or Uncategorized', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Streaming');
    expect(el.textContent).toContain('Uncategorized');
  });

  it('should display frequency badges', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('MONTHLY');
    expect(el.textContent).toContain('QUARTERLY');
  });

  it('should display Income and Expense type badges', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Income');
    expect(el.textContent).toContain('Expense');
  });

  it('should toggle active status and call API', () => {
    fixture.detectChanges();
    const netflix = component.filteredPayments.find(p => p.name === 'Netflix')!;
    const updatedNetflix = { ...netflix, isActive: false };
    recurringService.updateRecurringPayment.mockReturnValue(of(updatedNetflix));

    component.toggleActive(netflix);

    expect(recurringService.updateRecurringPayment).toHaveBeenCalledWith('1', { isActive: false });
  });

  it('should open category dialog for a payment', () => {
    fixture.detectChanges();
    const netflix = component.filteredPayments.find(p => p.name === 'Netflix')!;

    component.openCategoryDialog(netflix);

    expect(component.dialogPayment).toBe(netflix);
  });

  it('should close category dialog and reset state', () => {
    fixture.detectChanges();
    const netflix = component.filteredPayments.find(p => p.name === 'Netflix')!;
    component.openCategoryDialog(netflix);

    component.closeCategoryDialog();

    expect(component.dialogPayment).toBeNull();
  });

  it('should select existing category via dialog', () => {
    fixture.detectChanges();
    const salary = component.payments.find(p => p.name === 'Salary')!;
    const updatedSalary = { ...salary, categoryId: 'cat-1', categoryName: 'Streaming' };
    recurringService.updateRecurringPayment.mockReturnValue(of(updatedSalary));
    component.openCategoryDialog(salary);

    component.selectCategory('cat-1');

    expect(recurringService.updateRecurringPayment).toHaveBeenCalledWith('2', { categoryId: 'cat-1' });
    expect(component.dialogPayment).toBeNull();
  });

  it('should select None category via dialog', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    const updatedNetflix = { ...netflix, categoryId: undefined, categoryName: undefined };
    recurringService.updateRecurringPayment.mockReturnValue(of(updatedNetflix));
    component.openCategoryDialog(netflix);

    component.selectCategory(null);

    expect(recurringService.updateRecurringPayment).toHaveBeenCalledWith('1', { categoryId: undefined });
    expect(component.dialogPayment).toBeNull();
  });

  it('should add category and select it via onDialogCategoryCreated', () => {
    fixture.detectChanges();
    const salary = component.payments.find(p => p.name === 'Salary')!;
    const newCat: CategoryDto = { id: 'cat-3', name: 'Salary', color: '#a78bfa' };
    const updatedSalary = { ...salary, categoryId: 'cat-3', categoryName: 'Salary' };
    recurringService.updateRecurringPayment.mockReturnValue(of(updatedSalary));

    component.openCategoryDialog(salary);
    component.onDialogCategoryCreated(newCat);

    expect(component.categories.length).toBe(3);
    expect(component.categories[2].name).toBe('Salary');
    expect(recurringService.updateRecurringPayment).toHaveBeenCalledWith('2', { categoryId: 'cat-3' });
    expect(component.dialogPayment).toBeNull();
  });

  it('should show empty state when no payments', () => {
    recurringService.getRecurringPayments.mockReturnValue(of([]));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('No recurring payments found');
  });

  it('should show empty state on API error', () => {
    recurringService.getRecurringPayments.mockReturnValue(throwError(() => new Error('fail')));
    categoriesService.getCategories.mockReturnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();

    expect(component.loading).toBe(false);
  });

  it('should format currency correctly', () => {
    const formatted = component.formatCurrency(12.99);
    expect(formatted.includes('12') && formatted.includes('99')).toBe(true);
  });

  it('should return absolute value from abs()', () => {
    expect(component.abs(-42)).toBe(42);
    expect(component.abs(42)).toBe(42);
  });

  // Transactions modal tests

  it('should open transactions modal and load transactions', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;

    component.openTransactionsModal(netflix);

    expect(component.transactionsPayment).toBe(netflix);
    expect(recurringService.getRecurringPaymentTransactions).toHaveBeenCalledWith('1');
    expect(component.filteredTransactions.length).toBe(3);
    expect(component.transactionsLoading).toBe(false);
  });

  it('should close transactions modal and reset state', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openTransactionsModal(netflix);

    component.closeTransactionsModal();

    expect(component.transactionsPayment).toBeNull();
    expect(component.allTransactions).toEqual([]);
    expect(component.filteredTransactions).toEqual([]);
    expect(component.txFilterFrom).toBeNull();
    expect(component.txFilterTo).toBeNull();
    expect(component.transactionsError).toBeNull();
  });

  it('should filter transactions by date range', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openTransactionsModal(netflix);

    component.txFilterFrom = '2026-02-01';
    component.txFilterTo = '2026-02-28';
    component.applyTransactionFilter();

    expect(component.filteredTransactions.length).toBe(1);
    expect(component.filteredTransactions[0].bookingDate).toBe('2026-02-15');
  });

  it('should show all transactions when date range is cleared', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openTransactionsModal(netflix);

    component.txFilterFrom = '2026-02-01';
    component.txFilterTo = '2026-02-28';
    component.applyTransactionFilter();
    expect(component.filteredTransactions.length).toBe(1);

    component.onTxDateRangeChanged({ from: null, to: null, label: 'All time' });
    expect(component.filteredTransactions.length).toBe(3);
  });

  it('should sort transactions by date descending', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openTransactionsModal(netflix);

    expect(component.filteredTransactions[0].bookingDate).toBe('2026-03-15');
    expect(component.filteredTransactions[1].bookingDate).toBe('2026-02-15');
    expect(component.filteredTransactions[2].bookingDate).toBe('2026-01-15');
  });

  it('should handle API error when loading transactions', () => {
    fixture.detectChanges();
    recurringService.getRecurringPaymentTransactions.mockReturnValue(
      throwError(() => ({ error: { message: 'Server error' } }))
    );
    const netflix = component.payments.find(p => p.name === 'Netflix')!;

    component.openTransactionsModal(netflix);

    expect(component.transactionsError).toBe('Server error');
    expect(component.transactionsLoading).toBe(false);
    expect(component.filteredTransactions).toEqual([]);
  });

  it('should handle empty transactions list', () => {
    fixture.detectChanges();
    recurringService.getRecurringPaymentTransactions.mockReturnValue(of([]));
    const netflix = component.payments.find(p => p.name === 'Netflix')!;

    component.openTransactionsModal(netflix);

    expect(component.filteredTransactions).toEqual([]);
    expect(component.transactionsLoading).toBe(false);
    expect(component.transactionsError).toBeNull();
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

  it('should update date filter and refilter on date range change', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openTransactionsModal(netflix);

    component.onTxDateRangeChanged({ from: '2026-01-01', to: '2026-01-31', label: 'January' });

    expect(component.txFilterFrom).toBe('2026-01-01');
    expect(component.txFilterTo).toBe('2026-01-31');
    expect(component.filteredTransactions.length).toBe(1);
    expect(component.filteredTransactions[0].bookingDate).toBe('2026-01-15');
  });

  // Rules modal tests

  it('should display rule count badge for payments', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('2 rules');
    expect(el.textContent).toContain('1 rule');
  });

  it('should open rules modal and load rules', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;

    component.openRulesModal(netflix);

    expect(component.rulesPayment).toBe(netflix);
    expect(rulesService.getRules).toHaveBeenCalledWith('1');
    expect(component.rules).toEqual(mockRules);
    expect(component.rulesLoading).toBe(false);
  });

  it('should close rules modal and reset state', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openRulesModal(netflix);

    component.closeRulesModal();

    expect(component.rulesPayment).toBeNull();
    expect(component.rules).toEqual([]);
    expect(component.rulesError).toBeNull();
    expect(component.editingRule).toBeNull();
  });

  it('should create a new rule and trigger re-evaluation', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openRulesModal(netflix);

    component.ruleFormType = 'AMOUNT';
    component.ruleFormAmount = -12.99;
    component.ruleFormFluctuationRange = 1.30;
    component.saveRule();

    expect(rulesService.createRule).toHaveBeenCalledWith('1', expect.objectContaining({
      ruleType: 'AMOUNT',
      amount: -12.99,
      fluctuationRange: 1.30,
    }));
    expect(rulesService.reEvaluateRecurringPayment).toHaveBeenCalledWith('1');
  });

  it('should update an existing rule and trigger re-evaluation', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openRulesModal(netflix);

    component.startEditRule(mockRules[0]);
    component.ruleFormText = 'netflix inc';
    component.saveRule();

    expect(rulesService.updateRule).toHaveBeenCalledWith('1', 'r1', expect.objectContaining({
      text: 'netflix inc',
    }));
    expect(rulesService.reEvaluateRecurringPayment).toHaveBeenCalledWith('1');
  });

  it('should delete a rule and trigger re-evaluation', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openRulesModal(netflix);

    component.deleteRule(mockRules[0]);

    expect(rulesService.deleteRule).toHaveBeenCalledWith('1', 'r1');
    expect(rulesService.reEvaluateRecurringPayment).toHaveBeenCalledWith('1');
  });

  it('should handle API error when loading rules', () => {
    fixture.detectChanges();
    rulesService.getRules.mockReturnValue(
      throwError(() => ({ error: { message: 'Failed to load' } }))
    );
    const netflix = component.payments.find(p => p.name === 'Netflix')!;

    component.openRulesModal(netflix);

    expect(component.rulesError).toBe('Failed to load');
    expect(component.rulesLoading).toBe(false);
    expect(component.rules).toEqual([]);
  });

  it('should populate form fields when editing a rule', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openRulesModal(netflix);

    component.startEditRule(mockRules[0]);

    expect(component.editingRule).toBe(mockRules[0]);
    expect(component.ruleFormType).toBe('JARO_WINKLER');
    expect(component.ruleFormTargetField).toBe('PARTNER_NAME');
    expect(component.ruleFormText).toBe('netflix');
    expect(component.ruleFormThreshold).toBe(0.85);
    expect(component.ruleFormStrict).toBe(true);
  });

  it('should cancel editing and reset form', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openRulesModal(netflix);
    component.startEditRule(mockRules[0]);

    component.cancelEditRule();

    expect(component.editingRule).toBeNull();
    expect(component.ruleFormType).toBe('JARO_WINKLER');
    expect(component.ruleFormText).toBe('');
  });

  it('should format rule summaries correctly', () => {
    expect(component.formatRuleSummary(mockRules[0])).toContain('netflix');
    expect(component.formatRuleSummary(mockRules[0])).toContain('0.85');
    expect(component.formatRuleSummary(mockRules[1])).toContain('12');
  });

  it('should format rule types correctly', () => {
    expect(component.formatRuleType('JARO_WINKLER')).toBe('Jaro-Winkler');
    expect(component.formatRuleType('REGEX')).toBe('Regex');
    expect(component.formatRuleType('AMOUNT')).toBe('Amount');
  });

  it('should format target fields correctly', () => {
    expect(component.formatTargetField('PARTNER_NAME')).toBe('Partner Name');
    expect(component.formatTargetField('PARTNER_IBAN')).toBe('Partner IBAN');
    expect(component.formatTargetField('DETAILS')).toBe('Details');
  });
});
