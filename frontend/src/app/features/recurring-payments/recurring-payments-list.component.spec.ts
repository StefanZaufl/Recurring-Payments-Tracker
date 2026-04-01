import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RecurringPaymentsListComponent } from './recurring-payments-list.component';
import { RecurringPaymentsService, CategoriesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { CategoryDto } from '../../api/generated/model/categoryDto';
import { Frequency } from '../../api/generated/model/frequency';

const mockPayments: RecurringPaymentDto[] = [
  {
    id: '1', name: 'Netflix', categoryId: 'cat-1', categoryName: 'Streaming',
    averageAmount: -12.99, frequency: Frequency.Monthly, isIncome: false, isActive: true,
  },
  {
    id: '2', name: 'Salary', categoryId: undefined, categoryName: undefined,
    averageAmount: 3000, frequency: Frequency.Monthly, isIncome: true, isActive: true,
  },
  {
    id: '3', name: 'Old Gym', categoryId: undefined, categoryName: undefined,
    averageAmount: -29.99, frequency: Frequency.Monthly, isIncome: false, isActive: false,
  },
  {
    id: '4', name: 'Insurance', categoryId: 'cat-2', categoryName: 'Insurance',
    averageAmount: -150, frequency: Frequency.Quarterly, isIncome: false, isActive: true,
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

  beforeEach(async () => {
    const recurringServiceMock = {
      getRecurringPayments: jest.fn().mockReturnValue(of(mockPayments)),
      updateRecurringPayment: jest.fn(),
    };
    const categoriesServiceMock = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
      createCategory: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RecurringPaymentsListComponent],
      providers: [
        provideRouter([]),
        { provide: RecurringPaymentsService, useValue: recurringServiceMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
      ],
    })
    .overrideComponent(RecurringPaymentsListComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    recurringService = TestBed.inject(RecurringPaymentsService) as jest.Mocked<RecurringPaymentsService>;
    categoriesService = TestBed.inject(CategoriesService) as jest.Mocked<CategoriesService>;
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
    expect(component.newCategoryName).toBe('');
    expect(component.dialogError).toBeNull();
  });

  it('should close category dialog and reset state', () => {
    fixture.detectChanges();
    const netflix = component.filteredPayments.find(p => p.name === 'Netflix')!;
    component.openCategoryDialog(netflix);
    component.newCategoryName = 'test';
    component.dialogError = 'some error';

    component.closeCategoryDialog();

    expect(component.dialogPayment).toBeNull();
    expect(component.newCategoryName).toBe('');
    expect(component.dialogError).toBeNull();
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

  it('should create new category and assign it', () => {
    fixture.detectChanges();
    const salary = component.payments.find(p => p.name === 'Salary')!;
    const newCat: CategoryDto = { id: 'cat-3', name: 'Salary', color: undefined };
    categoriesService.createCategory.mockReturnValue(of(newCat));
    const updatedSalary = { ...salary, categoryId: 'cat-3', categoryName: 'Salary' };
    recurringService.updateRecurringPayment.mockReturnValue(of(updatedSalary));

    component.openCategoryDialog(salary);
    component.newCategoryName = 'Salary';
    component.createAndSelectCategory();

    expect(categoriesService.createCategory).toHaveBeenCalledWith({ name: 'Salary' });
    expect(component.categories.length).toBe(3);
    expect(component.categories[2].name).toBe('Salary');
  });

  it('should show error when category creation fails', () => {
    fixture.detectChanges();
    const salary = component.payments.find(p => p.name === 'Salary')!;
    categoriesService.createCategory.mockReturnValue(
      throwError(() => ({ error: { message: 'Category already exists' } }))
    );

    component.openCategoryDialog(salary);
    component.newCategoryName = 'Streaming';
    component.createAndSelectCategory();

    expect(component.dialogError).toBe('Category already exists');
    expect(component.creatingCategory).toBe(false);
  });

  it('should not create category with empty name', () => {
    fixture.detectChanges();
    const salary = component.payments.find(p => p.name === 'Salary')!;
    component.openCategoryDialog(salary);
    component.newCategoryName = '   ';

    component.createAndSelectCategory();

    expect(categoriesService.createCategory).not.toHaveBeenCalled();
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
});
