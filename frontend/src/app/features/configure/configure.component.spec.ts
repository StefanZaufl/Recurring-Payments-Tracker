import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BankAccountsService, CategoriesService, RecurringPaymentsService } from '../../api/generated';
import { ConfigureComponent } from './configure.component';

describe('ConfigureComponent', () => {
  let fixture: ComponentFixture<ConfigureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigureComponent],
      providers: [
        provideRouter([]),
        {
          provide: CategoriesService,
          useValue: {
            getCategories: jest.fn().mockReturnValue(of([])),
            createCategory: jest.fn(),
            updateCategory: jest.fn(),
            deleteCategory: jest.fn(),
          },
        },
        {
          provide: BankAccountsService,
          useValue: {
            getBankAccounts: jest.fn().mockReturnValue(of([])),
            createBankAccount: jest.fn(),
            updateBankAccount: jest.fn(),
            deleteBankAccount: jest.fn(),
          },
        },
        {
          provide: RecurringPaymentsService,
          useValue: {
            recalculateRecurringPayments: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigureComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render page header', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Configure');
    expect(el.textContent).toContain('Manage categories and bank accounts');
    expect(el.textContent).toContain('Danger Zone');
  });

  it('should compose the categories and bank accounts sections', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('app-configure-categories-section')).not.toBeNull();
    expect(el.querySelector('app-configure-bank-accounts-section')).not.toBeNull();
  });
});
