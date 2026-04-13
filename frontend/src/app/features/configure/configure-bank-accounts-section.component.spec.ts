import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { BankAccountsService } from '../../api/generated';
import { BankAccountDto } from '../../api/generated/model/bankAccountDto';
import { ConfigureBankAccountsSectionComponent } from './configure-bank-accounts-section.component';

const mockBankAccounts: BankAccountDto[] = [
  { id: 'acc-1', iban: 'DE111', name: 'Checking' },
  { id: 'acc-2', iban: 'DE222', name: 'Savings' },
];

describe('ConfigureBankAccountsSectionComponent', () => {
  let component: ConfigureBankAccountsSectionComponent;
  let fixture: ComponentFixture<ConfigureBankAccountsSectionComponent>;
  let bankAccountsService: jest.Mocked<BankAccountsService>;

  beforeEach(async () => {
    const bankAccountsServiceMock = {
      getBankAccounts: jest.fn().mockReturnValue(of(mockBankAccounts)),
      createBankAccount: jest.fn(),
      updateBankAccount: jest.fn(),
      deleteBankAccount: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConfigureBankAccountsSectionComponent],
      providers: [
        provideRouter([]),
        { provide: BankAccountsService, useValue: bankAccountsServiceMock },
      ],
    })
      .overrideComponent(ConfigureBankAccountsSectionComponent, {
        set: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    bankAccountsService = TestBed.inject(BankAccountsService) as jest.Mocked<BankAccountsService>;
    fixture = TestBed.createComponent(ConfigureBankAccountsSectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load bank accounts on init', () => {
    fixture.detectChanges();

    expect(bankAccountsService.getBankAccounts).toHaveBeenCalled();
    expect(component.bankAccounts).toEqual(mockBankAccounts);
    expect(component.bankAccountsLoading).toBe(false);
  });

  it('should render the section header and bank account names', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Bank Accounts');
    expect(el.textContent).toContain('Checking');
    expect(el.textContent).toContain('Savings');
  });

  it('should show error on bank account load failure', () => {
    bankAccountsService.getBankAccounts.mockReturnValue(
      throwError(() => ({ error: { message: 'Server error' } }))
    );

    fixture.detectChanges();

    expect(component.bankAccountsError).toBe('Server error');
    expect(component.bankAccountsLoading).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Server error');
  });

  it('should show generic error when bank account load fails without message', () => {
    bankAccountsService.getBankAccounts.mockReturnValue(throwError(() => ({ error: {} })));

    fixture.detectChanges();

    expect(component.bankAccountsError).toBe('Failed to load bank accounts.');
  });

  it('should show empty state when no bank accounts', () => {
    bankAccountsService.getBankAccounts.mockReturnValue(of([]));

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No bank accounts yet');
  });

  it('should create a bank account', () => {
    bankAccountsService.createBankAccount.mockReturnValue(
      of({ id: 'acc-3', iban: 'DE333', name: 'Brokerage' })
    );
    fixture.detectChanges();

    component.newBankAccountIban = 'DE333';
    component.newBankAccountName = 'Brokerage';
    component.createBankAccount();

    expect(bankAccountsService.createBankAccount).toHaveBeenCalledWith({ iban: 'DE333', name: 'Brokerage' });
    expect(component.bankAccounts.find((account) => account.id === 'acc-3')?.name).toBe('Brokerage');
    expect(component.newBankAccountIban).toBe('');
    expect(component.newBankAccountName).toBe('');
  });

  it('should not create a bank account with an empty iban', () => {
    fixture.detectChanges();
    component.newBankAccountIban = '   ';

    component.createBankAccount();

    expect(bankAccountsService.createBankAccount).not.toHaveBeenCalled();
  });

  it('should show error on create bank account failure', () => {
    bankAccountsService.createBankAccount.mockReturnValue(
      throwError(() => ({ error: { message: 'Create failed' } }))
    );
    fixture.detectChanges();

    component.newBankAccountIban = 'DE333';
    component.createBankAccount();

    expect(component.createBankAccountError).toBe('Create failed');
    expect(component.creatingBankAccount).toBe(false);
  });

  it('should update a bank account name', () => {
    bankAccountsService.updateBankAccount.mockReturnValue(
      of({ id: 'acc-1', iban: 'DE111', name: 'Main Checking' })
    );
    fixture.detectChanges();

    component.startBankAccountEdit(component.bankAccounts[0]);
    component.editBankAccountName = 'Main Checking';
    component.saveBankAccountEdit(component.bankAccounts[0]);

    expect(bankAccountsService.updateBankAccount).toHaveBeenCalledWith('acc-1', { name: 'Main Checking' });
    expect(component.bankAccounts[0].name).toBe('Main Checking');
    expect(component.editingBankAccountId).toBeNull();
  });

  it('should show error on bank account edit failure', () => {
    bankAccountsService.updateBankAccount.mockReturnValue(
      throwError(() => ({ error: { message: 'Update failed' } }))
    );
    fixture.detectChanges();

    component.startBankAccountEdit(component.bankAccounts[0]);
    component.editBankAccountName = 'Main Checking';
    component.saveBankAccountEdit(component.bankAccounts[0]);

    expect(component.bankAccountEditError).toBe('Update failed');
    expect(component.savingBankAccountEdit).toBe(false);
  });

  it('should delete a bank account', () => {
    bankAccountsService.deleteBankAccount.mockReturnValue(of(undefined));
    fixture.detectChanges();

    component.deleteBankAccount(component.bankAccounts[0]);

    expect(bankAccountsService.deleteBankAccount).toHaveBeenCalledWith('acc-1');
    expect(component.bankAccounts.some((account) => account.id === 'acc-1')).toBe(false);
  });

  it('should show error on bank account delete failure', () => {
    bankAccountsService.deleteBankAccount.mockReturnValue(
      throwError(() => ({ error: { message: 'Cannot delete' } }))
    );
    fixture.detectChanges();

    component.deleteBankAccount(component.bankAccounts[0]);

    expect(component.deleteBankAccountError).toBe('Cannot delete');
    expect(component.deletingBankAccountId).toBeNull();
    expect(component.bankAccounts).toEqual(mockBankAccounts);
  });

  it('should show generic error on bank account delete failure without message', () => {
    bankAccountsService.deleteBankAccount.mockReturnValue(throwError(() => ({ error: {} })));
    fixture.detectChanges();

    component.deleteBankAccount(component.bankAccounts[0]);

    expect(component.deleteBankAccountError).toBe('Failed to delete bank account.');
  });

  it('should retry loading bank accounts on error', () => {
    bankAccountsService.getBankAccounts.mockReturnValue(
      throwError(() => ({ error: { message: 'fail' } }))
    );
    fixture.detectChanges();
    expect(component.bankAccountsError).toBe('fail');

    bankAccountsService.getBankAccounts.mockReturnValue(of(mockBankAccounts));
    component.loadBankAccounts();

    expect(component.bankAccounts).toEqual(mockBankAccounts);
    expect(component.bankAccountsError).toBeNull();
  });
});
