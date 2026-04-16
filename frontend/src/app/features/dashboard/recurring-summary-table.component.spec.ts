import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecurringSummaryTableComponent } from './recurring-summary-table.component';
import { RecurringPaymentSummary } from '../../api/generated/model/recurringPaymentSummary';

const items: RecurringPaymentSummary[] = [
  { id: '1', name: 'alpha', category: 'Uncategorized', monthlyAmount: 10, annualAmount: 120 },
  { id: '2', name: 'Bravo', category: 'Streaming', monthlyAmount: 20, annualAmount: 240 },
  { id: '3', name: 'charlie', category: 'Insurance', monthlyAmount: 15, annualAmount: 240 },
];

describe('RecurringSummaryTableComponent', () => {
  let component: RecurringSummaryTableComponent;
  let fixture: ComponentFixture<RecurringSummaryTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecurringSummaryTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RecurringSummaryTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Recurring Payments');
    fixture.componentRef.setInput('emptyMessage', 'No recurring payments detected for this year.');
    fixture.componentRef.setInput('tone', 'expense');
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('historyChartOptions', {});
    fixture.detectChanges();
  });

  it('should default to annual descending sort', () => {
    expect(component.sortedItems.map(item => item.id)).toEqual(['2', '3', '1']);
  });

  it('should toggle sort direction on repeated header clicks', () => {
    component.sortBy('name');
    expect(component.activeSort).toEqual({ column: 'name', direction: 'desc' });
    expect(component.sortedItems.map(item => item.name)).toEqual(['charlie', 'Bravo', 'alpha']);

    component.sortBy('name');
    expect(component.activeSort).toEqual({ column: 'name', direction: 'asc' });
    expect(component.sortedItems.map(item => item.name)).toEqual(['alpha', 'Bravo', 'charlie']);
  });

  it('should sort category values case-insensitively and stably', () => {
    component.sortBy('category');
    component.sortBy('category');

    expect(component.sortedItems.map(item => item.category)).toEqual(['Insurance', 'Streaming', 'Uncategorized']);
  });

  it('should emit history requests when expanding a row', () => {
    const emitSpy = jest.spyOn(component.historyRequested, 'emit');

    component.togglePaymentHistory('2');

    expect(component.expandedPaymentId).toBe('2');
    expect(emitSpy).toHaveBeenCalledWith('2');
  });

  it('should collapse the expanded row when clicked again', () => {
    component.togglePaymentHistory('2');
    component.togglePaymentHistory('2');

    expect(component.expandedPaymentId).toBeNull();
  });

  it('should collapse the expanded row when sorting', () => {
    component.togglePaymentHistory('2');

    component.sortBy('monthlyAmount');

    expect(component.expandedPaymentId).toBeNull();
  });

  it('should reset expansion when items change', () => {
    component.togglePaymentHistory('2');
    fixture.componentRef.setInput('items', [...items]);
    fixture.detectChanges();

    expect(component.expandedPaymentId).toBeNull();
  });
});
