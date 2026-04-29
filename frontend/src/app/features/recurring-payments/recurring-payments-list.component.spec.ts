import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RecurringPaymentsListComponent } from './recurring-payments-list.component';
import { RecurringPaymentsService, CategoriesService, RecurringPaymentRulesService, AdditionalRuleGroupsService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { CurrencyFormatPipe } from '../../shared/currency-format.pipe';
import { Frequency } from '../../api/generated/model/frequency';
import { PaymentType } from '../../api/generated/model/paymentType';

const mockPayments: RecurringPaymentDto[] = [
  {
    id: '1', name: 'Netflix', categoryId: 'cat-1', categoryName: 'Streaming', categoryColor: '#FF0000',
    averageAmount: -12.99, frequency: Frequency.Monthly, isIncome: false, isActive: true, ruleCount: 2, paymentType: PaymentType.Recurring,
  },
  {
    id: '2', name: 'Salary', categoryId: undefined, categoryName: undefined,
    averageAmount: 3000, frequency: Frequency.Monthly, isIncome: true, isActive: true, ruleCount: 2, paymentType: PaymentType.Recurring,
  },
  {
    id: '3', name: 'Old Gym', categoryId: undefined, categoryName: undefined,
    averageAmount: -29.99, frequency: Frequency.Monthly, isIncome: false, isActive: false, ruleCount: 0, paymentType: PaymentType.Recurring,
  },
  {
    id: '4', name: 'Insurance', categoryId: 'cat-2', categoryName: 'Insurance', categoryColor: '#00FF00',
    averageAmount: -150, frequency: Frequency.Quarterly, isIncome: false, isActive: true, ruleCount: 1, paymentType: PaymentType.Recurring,
  },
];

const mockCategories: CategoryDto[] = [
  { id: 'cat-1', name: 'Streaming', color: '#FF0000' },
  { id: 'cat-2', name: 'Insurance', color: '#00FF00' },
];

describe('RecurringPaymentsListComponent', () => {
  let component: RecurringPaymentsListComponent;
  let fixture: ComponentFixture<RecurringPaymentsListComponent>;
  let recurringService: jest.Mocked<RecurringPaymentsService>;
  let categoriesService: jest.Mocked<CategoriesService>;
  let router: Router;

  beforeEach(async () => {
    const recurringServiceMock = {
      getRecurringPayments: jest.fn().mockImplementation(() => of(mockPayments.map(p => ({ ...p })))),
      updateRecurringPayment: jest.fn(),
      deleteRecurringPayment: jest.fn().mockReturnValue(of(undefined)),
      getRecurringPaymentTransactions: jest.fn().mockReturnValue(of([])),
    };
    const categoriesServiceMock = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
      createCategory: jest.fn(),
    };
    const rulesServiceMock = {
      getRules: jest.fn().mockReturnValue(of([])),
      createRule: jest.fn(),
      updateRule: jest.fn(),
      deleteRule: jest.fn(),
      reEvaluateRecurringPayment: jest.fn(),
    };
    const additionalRuleGroupsServiceMock = {
      getAdditionalRuleGroups: jest.fn().mockReturnValue(of([])),
      deleteAdditionalRuleGroup: jest.fn().mockReturnValue(of({
        transactionsMarkedInterAccount: 0,
        transactionLinksRemoved: 0,
        recurringPaymentsDeleted: 0,
        recurringPaymentsDetected: 0,
      })),
    };

    await TestBed.configureTestingModule({
      imports: [RecurringPaymentsListComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: RecurringPaymentsService, useValue: recurringServiceMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
        { provide: RecurringPaymentRulesService, useValue: rulesServiceMock },
        { provide: AdditionalRuleGroupsService, useValue: additionalRuleGroupsServiceMock },
      ],
    })
    .overrideComponent(RecurringPaymentsListComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    recurringService = TestBed.inject(RecurringPaymentsService) as jest.Mocked<RecurringPaymentsService>;
    categoriesService = TestBed.inject(CategoriesService) as jest.Mocked<CategoriesService>;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
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

    component.onShowInactiveChange(true);

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ showInactive: 'true' }),
    }));
  });

  it('should filter by frequency', () => {
    fixture.detectChanges();

    component.onFrequencyChange('QUARTERLY');

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ frequency: 'QUARTERLY' }),
    }));
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

    component.onSortByChange('name');

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ sort: 'name' }),
    }));
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

  it('should show colored dot for categorized payments and none for uncategorized', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const dots = el.querySelectorAll('span[style*="background-color"]');
    expect(dots.length).toBeGreaterThanOrEqual(2);

    const colors = Array.from(dots).map(d => (d as HTMLElement).style.backgroundColor);
    expect(colors).toContain('rgb(255, 0, 0)'); // #FF0000 for Streaming
    expect(colors).toContain('rgb(0, 255, 0)'); // #00FF00 for Insurance
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

  it('should save lifecycle dates and update the payment', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    const updatedNetflix = { ...netflix, startDate: '2025-01-15', endDate: '2025-12-15' };
    recurringService.updateRecurringPayment.mockReturnValue(of(updatedNetflix));

    component.openLifecycleDialog(netflix);
    component.lifecycleStartDate = '2025-01-15';
    component.lifecycleEndDate = '2025-12-15';
    component.saveLifecycleDates();

    expect(recurringService.updateRecurringPayment).toHaveBeenCalledWith('1', {
      startDate: '2025-01-15',
      endDate: '2025-12-15',
      clearEndDate: false,
    });
    expect(component.lifecyclePayment).toBeNull();
    expect(component.payments.find(p => p.id === '1')?.endDate).toBe('2025-12-15');
  });

  it('should request end date clearing when lifecycle end date is empty', () => {
    fixture.detectChanges();
    const netflix = { ...component.payments.find(p => p.name === 'Netflix')!, endDate: '2025-12-15' };
    recurringService.updateRecurringPayment.mockReturnValue(of({ ...netflix, endDate: undefined }));

    component.openLifecycleDialog(netflix);
    component.clearLifecycleEndDate();
    component.saveLifecycleDates();

    expect(recurringService.updateRecurringPayment).toHaveBeenCalledWith('1', {
      startDate: undefined,
      endDate: undefined,
      clearEndDate: true,
    });
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

    component.onCategorySelected('cat-1');

    expect(recurringService.updateRecurringPayment).toHaveBeenCalledWith('2', { categoryId: 'cat-1' });
    expect(component.dialogPayment).toBeNull();
  });

  it('should select None category via dialog', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    const updatedNetflix = { ...netflix, categoryId: undefined, categoryName: undefined };
    recurringService.updateRecurringPayment.mockReturnValue(of(updatedNetflix));
    component.openCategoryDialog(netflix);

    component.onCategorySelected(null);

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

  it('should update filteredPayments after category change', () => {
    fixture.detectChanges();
    const salary = component.payments.find(p => p.name === 'Salary')!;
    const updatedSalary = { ...salary, categoryId: 'cat-1', categoryName: 'Streaming' };
    recurringService.updateRecurringPayment.mockReturnValue(of(updatedSalary));
    component.openCategoryDialog(salary);

    component.onCategorySelected('cat-1');

    const filtered = component.filteredPayments.find(p => p.id === salary.id)!;
    expect(filtered.categoryName).toBe('Streaming');
    expect(filtered.categoryId).toBe('cat-1');
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

  it('should initialize filters from query params', async () => {
    TestBed.resetTestingModule();

    const recurringServiceMock = {
      getRecurringPayments: jest.fn().mockImplementation(() => of(mockPayments.map(p => ({ ...p })))),
      updateRecurringPayment: jest.fn(),
      deleteRecurringPayment: jest.fn().mockReturnValue(of(undefined)),
      getRecurringPaymentTransactions: jest.fn().mockReturnValue(of([])),
    };
    const categoriesServiceMock = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
      createCategory: jest.fn(),
    };
    const rulesServiceMock = {
      getRules: jest.fn().mockReturnValue(of([])),
      createRule: jest.fn(),
      updateRule: jest.fn(),
      deleteRule: jest.fn(),
      reEvaluateRecurringPayment: jest.fn(),
    };
    const additionalRuleGroupsServiceMock = {
      getAdditionalRuleGroups: jest.fn().mockReturnValue(of([])),
      deleteAdditionalRuleGroup: jest.fn().mockReturnValue(of({
        transactionsMarkedInterAccount: 0,
        transactionLinksRemoved: 0,
        recurringPaymentsDeleted: 0,
        recurringPaymentsDetected: 0,
      })),
    };

    await TestBed.configureTestingModule({
      imports: [RecurringPaymentsListComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ showInactive: 'true', frequency: 'MONTHLY', sort: 'name', tab: 'GROUPED' })) },
        },
        { provide: RecurringPaymentsService, useValue: recurringServiceMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
        { provide: RecurringPaymentRulesService, useValue: rulesServiceMock },
        { provide: AdditionalRuleGroupsService, useValue: additionalRuleGroupsServiceMock },
      ],
    })
    .overrideComponent(RecurringPaymentsListComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    const newFixture = TestBed.createComponent(RecurringPaymentsListComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    expect(newComponent.showInactive).toBe(true);
    expect(newComponent.filterFrequency).toBe('MONTHLY');
    expect(newComponent.sortBy).toBe('name');
    expect(newComponent.selectedTab).toBe('GROUPED');
  });

  it('should ignore invalid query params and fall back to defaults', async () => {
    TestBed.resetTestingModule();

    const recurringServiceMock = {
      getRecurringPayments: jest.fn().mockImplementation(() => of(mockPayments.map(p => ({ ...p })))),
      updateRecurringPayment: jest.fn(),
      deleteRecurringPayment: jest.fn().mockReturnValue(of(undefined)),
      getRecurringPaymentTransactions: jest.fn().mockReturnValue(of([])),
    };
    const categoriesServiceMock = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
      createCategory: jest.fn(),
    };
    const rulesServiceMock = {
      getRules: jest.fn().mockReturnValue(of([])),
      createRule: jest.fn(),
      updateRule: jest.fn(),
      deleteRule: jest.fn(),
      reEvaluateRecurringPayment: jest.fn(),
    };
    const additionalRuleGroupsServiceMock = {
      getAdditionalRuleGroups: jest.fn().mockReturnValue(of([])),
      deleteAdditionalRuleGroup: jest.fn().mockReturnValue(of({
        transactionsMarkedInterAccount: 0,
        transactionLinksRemoved: 0,
        recurringPaymentsDeleted: 0,
        recurringPaymentsDetected: 0,
      })),
    };

    await TestBed.configureTestingModule({
      imports: [RecurringPaymentsListComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ showInactive: 'maybe', frequency: 'WEEKLY', sort: 'foo', tab: 'OTHER' })) },
        },
        { provide: RecurringPaymentsService, useValue: recurringServiceMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
        { provide: RecurringPaymentRulesService, useValue: rulesServiceMock },
        { provide: AdditionalRuleGroupsService, useValue: additionalRuleGroupsServiceMock },
      ],
    })
    .overrideComponent(RecurringPaymentsListComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    const newFixture = TestBed.createComponent(RecurringPaymentsListComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    expect(newComponent.showInactive).toBe(false);
    expect(newComponent.filterFrequency).toBe('');
    expect(newComponent.sortBy).toBe('amount');
    expect(newComponent.selectedTab).toBe('RECURRING');
  });

  it('should update query params when switching tabs', () => {
    fixture.detectChanges();

    component.onTabChange('GROUPED');

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ tab: 'GROUPED' }),
    }));
  });

  it('should format currency correctly via pipe', () => {
    const pipe = new CurrencyFormatPipe();
    const formatted = pipe.transform(12.99);
    expect(formatted.includes('12') && formatted.includes('99')).toBe(true);
  });

  it('should display negative amount for expenses and positive for income', () => {
    fixture.detectChanges();

    // Verify amounts are rendered directly from averageAmount (negative for expense, positive for income)
    const salary = component.filteredPayments.find(p => p.name === 'Salary')!;
    const insurance = component.filteredPayments.find(p => p.name === 'Insurance')!;

    // Income should keep its positive averageAmount
    expect(salary.isIncome).toBe(true);
    expect(salary.averageAmount).toBeGreaterThan(0);

    // Expense should keep its negative averageAmount
    expect(insurance.isIncome).toBe(false);
    expect(insurance.averageAmount).toBeLessThan(0);

    // The rendered text should contain the signed formatted amounts
    const pipe = new CurrencyFormatPipe();
    const el: HTMLElement = fixture.nativeElement;
    // Income shows with + prefix
    expect(el.textContent).toContain(pipe.transform(salary.averageAmount, true));
    // Expense shows with - prefix
    expect(el.textContent).toContain(pipe.transform(insurance.averageAmount, true));
  });

  it('should display rule count badge for payments', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('2 rules');
    expect(el.textContent).toContain('1 rule');
  });

  // Modal open/close tests

  it('should open transactions modal for a payment', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;

    component.openTransactionsModal(netflix);

    expect(component.transactionsPayment).toBe(netflix);
  });

  it('should close transactions modal', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openTransactionsModal(netflix);

    component.closeTransactionsModal();

    expect(component.transactionsPayment).toBeNull();
  });

  it('should open rules modal for a payment', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;

    component.openRulesModal(netflix);

    expect(component.rulesPayment).toBe(netflix);
  });

  it('should close rules modal', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.openRulesModal(netflix);

    component.closeRulesModal();

    expect(component.rulesPayment).toBeNull();
  });

  it('should update payment list when rules modal emits paymentUpdated', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    const updatedNetflix = { ...netflix, ruleCount: 5 };

    component.openRulesModal(netflix);
    component.onPaymentUpdatedFromRules({ payment: updatedNetflix, ruleCount: 5 });

    expect(component.payments.find(p => p.id === '1')?.ruleCount).toBe(5);
    expect(component.rulesPayment?.ruleCount).toBe(5);
  });

  // Tab tests

  it('should default to RECURRING tab and show correct counts', () => {
    fixture.detectChanges();

    expect(component.selectedTab).toBe('RECURRING');
    expect(component.recurringCount).toBe(3); // 3 active RECURRING
    expect(component.groupedCount).toBe(0);
  });

  it('should switch to GROUPED tab and show grouped payments', () => {
    const paymentsWithGrouped = [
      ...mockPayments,
      {
        id: '5', name: 'Groceries', categoryId: undefined, categoryName: undefined,
        averageAmount: -200, frequency: Frequency.Monthly, isIncome: false, isActive: true, ruleCount: 1, paymentType: PaymentType.Grouped,
      },
    ];
    recurringService.getRecurringPayments.mockReturnValue(of(paymentsWithGrouped));
    fixture.detectChanges();

    expect(component.recurringCount).toBe(3);
    expect(component.groupedCount).toBe(1);

    component.selectedTab = 'GROUPED';
    component.applyFilter();

    expect(component.filteredPayments.length).toBe(1);
    expect(component.filteredPayments[0].name).toBe('Groceries');
  });

  // Delete tests

  it('should open delete confirmation dialog', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;

    component.confirmDelete(netflix);

    expect(component.deletePayment).toBe(netflix);
  });

  it('should delete payment and refresh list', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    recurringService.deleteRecurringPayment.mockReturnValue(of(undefined));
    recurringService.getRecurringPayments.mockReturnValue(of(mockPayments.filter(p => p.id !== '1')));

    component.confirmDelete(netflix);
    component.executeDelete();

    expect(recurringService.deleteRecurringPayment).toHaveBeenCalledWith('1');
  });

  it('should close delete dialog when cancelled', () => {
    fixture.detectChanges();
    const netflix = component.payments.find(p => p.name === 'Netflix')!;
    component.confirmDelete(netflix);

    component.deletePayment = null;

    expect(component.deletePayment).toBeNull();
  });
});
