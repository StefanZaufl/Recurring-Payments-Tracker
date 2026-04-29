import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TransactionMatchPreviewComponent } from './transaction-match-preview.component';
import { TransactionDto } from '../../api/generated/model/transactionDto';

const transactions: TransactionDto[] = [
  {
    id: 'tx-1',
    bookingDate: '2026-01-01',
    amount: -12.99,
    partnerName: 'Netflix',
    details: 'Subscription',
    linkedPaymentCount: 1,
    linkedPaymentNames: ['Netflix'],
  },
  {
    id: 'tx-2',
    bookingDate: '2026-01-02',
    amount: -20,
    partnerName: 'Market',
  },
];

describe('TransactionMatchPreviewComponent', () => {
  let fixture: ComponentFixture<TransactionMatchPreviewComponent>;
  let component: TransactionMatchPreviewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionMatchPreviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionMatchPreviewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Transactions');
    fixture.componentRef.setInput('subtitle', 'Showing recent transactions');
    fixture.componentRef.setInput('transactions', transactions);
    fixture.componentRef.setInput('matchingIds', new Set(['tx-1']));
    fixture.componentRef.setInput('simulationActive', true);
    fixture.componentRef.setInput('showMatchesToggle', true);
    fixture.componentRef.setInput('totalPages', 2);
    fixture.detectChanges();
  });

  it('should render transaction rows and match badges', () => {
    expect(fixture.nativeElement.textContent).toContain('Netflix');
    expect(fixture.nativeElement.textContent).toContain('match');
    expect(fixture.nativeElement.textContent).toContain('Page 1 of 2');
  });

  it('should emit page changes', () => {
    const spy = jest.fn();
    component.pageChange.subscribe(spy);

    fixture.debugElement.queryAll(By.css('button')).at(-1)!.nativeElement.click();

    expect(spy).toHaveBeenCalledWith(1);
  });

  it('should emit matches-only changes', () => {
    const spy = jest.fn();
    component.showOnlyMatchesChange.subscribe(spy);

    fixture.debugElement.query(By.css('input[type="checkbox"]')).nativeElement.click();

    expect(spy).toHaveBeenCalledWith(true);
  });
});
