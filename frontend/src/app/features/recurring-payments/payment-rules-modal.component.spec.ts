import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PaymentRulesModalComponent } from './payment-rules-modal.component';
import { RecurringPaymentRulesService } from '../../api/generated';
import { RecurringPaymentDto } from '../../api/generated/model/recurringPaymentDto';
import { RuleDto } from '../../api/generated/model/ruleDto';
import { Frequency } from '../../api/generated/model/frequency';
import { RuleType } from '../../api/generated/model/ruleType';
import { TargetField } from '../../api/generated/model/targetField';

const mockPayment: RecurringPaymentDto = {
  id: '1', name: 'Netflix', categoryId: 'cat-1', categoryName: 'Streaming',
  averageAmount: -12.99, frequency: Frequency.Monthly, isIncome: false, isActive: true, ruleCount: 2,
};

const mockRules: RuleDto[] = [
  { id: 'r1', ruleType: RuleType.JaroWinkler, targetField: TargetField.PartnerName, text: 'netflix', strict: true, threshold: 0.85 },
  { id: 'r2', ruleType: RuleType.Amount, amount: -12.99, fluctuationRange: 1.30 },
];

describe('PaymentRulesModalComponent', () => {
  let component: PaymentRulesModalComponent;
  let fixture: ComponentFixture<PaymentRulesModalComponent>;
  let rulesService: jest.Mocked<RecurringPaymentRulesService>;

  beforeEach(async () => {
    const rulesServiceMock = {
      getRules: jest.fn().mockReturnValue(of(mockRules)),
      createRule: jest.fn().mockReturnValue(of(mockRules[0])),
      updateRule: jest.fn().mockReturnValue(of(mockRules[0])),
      deleteRule: jest.fn().mockReturnValue(of(undefined)),
      reEvaluateRecurringPayment: jest.fn().mockReturnValue(of(mockPayment)),
    };

    await TestBed.configureTestingModule({
      imports: [PaymentRulesModalComponent],
      providers: [
        { provide: RecurringPaymentRulesService, useValue: rulesServiceMock },
      ],
    })
    .overrideComponent(PaymentRulesModalComponent, {
      set: { schemas: [NO_ERRORS_SCHEMA] },
    })
    .compileComponents();

    rulesService = TestBed.inject(RecurringPaymentRulesService) as jest.Mocked<RecurringPaymentRulesService>;
    fixture = TestBed.createComponent(PaymentRulesModalComponent);
    component = fixture.componentInstance;
    component.payment = mockPayment;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load rules on init', () => {
    fixture.detectChanges();

    expect(rulesService.getRules).toHaveBeenCalledWith('1');
    expect(component.rules).toEqual(mockRules);
    expect(component.loading).toBe(false);
  });

  it('should handle API error when loading rules', () => {
    rulesService.getRules.mockReturnValue(
      throwError(() => ({ error: { message: 'Failed to load' } }))
    );

    fixture.detectChanges();

    expect(component.error).toBe('Failed to load');
    expect(component.loading).toBe(false);
    expect(component.rules).toEqual([]);
  });

  it('should create a new rule and trigger re-evaluation', () => {
    fixture.detectChanges();

    component.onRulesChange([
      ...mockRules,
      { id: 'new-rule', ruleType: RuleType.Amount, amount: -12.99, fluctuationRange: 1.30 },
    ]);

    expect(rulesService.createRule).toHaveBeenCalledWith('1', expect.objectContaining({
      ruleType: 'AMOUNT',
      amount: -12.99,
      fluctuationRange: 1.30,
    }));
    expect(rulesService.reEvaluateRecurringPayment).toHaveBeenCalledWith('1');
  });

  it('should update an existing rule and trigger re-evaluation', () => {
    fixture.detectChanges();

    component.onRulesChange([
      { ...mockRules[0], text: 'netflix inc' },
      mockRules[1],
    ]);

    expect(rulesService.updateRule).toHaveBeenCalledWith('1', 'r1', expect.objectContaining({
      text: 'netflix inc',
    }));
    expect(rulesService.reEvaluateRecurringPayment).toHaveBeenCalledWith('1');
  });

  it('should delete a rule and trigger re-evaluation', () => {
    fixture.detectChanges();

    component.onRulesChange([mockRules[1]]);

    expect(rulesService.deleteRule).toHaveBeenCalledWith('1', 'r1');
    expect(rulesService.reEvaluateRecurringPayment).toHaveBeenCalledWith('1');
  });

  it('should emit paymentUpdated after rule save', () => {
    fixture.detectChanges();
    const spy = jest.fn();
    component.paymentUpdated.subscribe(spy);

    component.onRulesChange([
      ...mockRules,
      { id: 'new-rule', ruleType: RuleType.Amount, amount: -12.99, fluctuationRange: 1.30 },
    ]);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      payment: mockPayment,
      ruleCount: 2,
    }));
  });
});
