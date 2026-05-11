import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RuleEditorComponent, LocalRule } from './rule-editor.component';

const initialRules: LocalRule[] = [
  {
    id: 'r1',
    ruleType: 'JARO_WINKLER',
    targetField: 'PARTNER_NAME',
    text: 'netflix',
    strict: true,
    threshold: 0.85,
  },
  {
    id: 'r2',
    ruleType: 'AMOUNT',
    amount: -12.99,
    fluctuationRange: 1.30,
  },
];

describe('RuleEditorComponent', () => {
  let component: RuleEditorComponent;
  let fixture: ComponentFixture<RuleEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RuleEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RuleEditorComponent);
    component = fixture.componentInstance;
    component.rules = [...initialRules];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should format rule summaries correctly', () => {
    expect(component.formatRuleSummary(initialRules[0])).toContain('netflix');
    expect(component.formatRuleSummary(initialRules[0])).toContain('0.85');
    expect(component.formatRuleSummary(initialRules[1])).toContain('12');
  });

  it('should format labels correctly', () => {
    expect(component.formatRuleType('JARO_WINKLER')).toBe('Jaro-Winkler');
    expect(component.formatRuleType('REGEX')).toBe('Regex');
    expect(component.formatRuleType('AMOUNT')).toBe('Amount');
    expect(component.formatTargetField('ACCOUNT')).toBe('Account');
    expect(component.formatTargetField('PARTNER_NAME')).toBe('Partner Name');
    expect(component.formatTargetField('PARTNER_IBAN')).toBe('Partner IBAN');
    expect(component.formatTargetField('DETAILS')).toBe('Details');
  });

  it('should emit an added rule', () => {
    const spy = jest.fn();
    component.rulesChange.subscribe(spy);

    component.showRuleForm = true;
    component.ruleFormType = 'AMOUNT';
    component.ruleFormAmount = -19.99;
    component.ruleFormFluctuationRange = 2;
    component.saveRule();

    expect(spy).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        ruleType: 'AMOUNT',
        amount: -19.99,
        fluctuationRange: 2,
      }),
    ]));
  });

  it('should emit an updated rule', () => {
    const spy = jest.fn();
    component.rulesChange.subscribe(spy);

    component.startEditRule(initialRules[0]);
    component.ruleFormText = 'netflix inc';
    component.saveRule();

    expect(spy).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'r1', text: 'netflix inc' }),
      initialRules[1],
    ]);
  });

  it('should emit a removed rule', () => {
    const spy = jest.fn();
    component.rulesChange.subscribe(spy);

    component.removeRule(initialRules[0]);

    expect(spy).toHaveBeenCalledWith([initialRules[1]]);
  });

  it('should show validation errors before emitting invalid rules', () => {
    const spy = jest.fn();
    component.rulesChange.subscribe(spy);

    component.showRuleForm = true;
    component.ruleFormType = 'REGEX';
    component.ruleFormText = '';
    component.saveRule();

    expect(component.ruleFormError).toBe('Text is required.');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should support unframed rendering', () => {
    fixture.componentRef.setInput('framed', false);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.glass-card'))).toBeNull();
  });
});
