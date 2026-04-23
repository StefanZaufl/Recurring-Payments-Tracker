import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Delete Item');
    fixture.componentRef.setInput('confirmLabel', 'Delete');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit confirmed when confirm is clicked', () => {
    const spy = jest.fn();
    component.confirmed.subscribe(spy);

    fixture.debugElement.queryAll(By.css('button')).at(-1)!.nativeElement.click();

    expect(spy).toHaveBeenCalled();
  });

  it('should emit cancelled when cancel is clicked', () => {
    const spy = jest.fn();
    component.cancelled.subscribe(spy);

    fixture.debugElement.queryAll(By.css('button')).at(-2)!.nativeElement.click();

    expect(spy).toHaveBeenCalled();
  });

  it('should not emit cancelled while busy', () => {
    const spy = jest.fn();
    component.cancelled.subscribe(spy);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    component.requestCancel();

    expect(spy).not.toHaveBeenCalled();
  });
});
