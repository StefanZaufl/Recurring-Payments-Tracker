import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorStateComponent } from './error-state.component';

describe('ErrorStateComponent', () => {
  let component: ErrorStateComponent;
  let fixture: ComponentFixture<ErrorStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the error message', () => {
    fixture.componentRef.setInput('message', 'Something went wrong');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Something went wrong');
  });

  it('should emit retry event when button is clicked', () => {
    const spy = jest.spyOn(component.retry, 'emit');
    const el: HTMLElement = fixture.nativeElement;
    const button = el.querySelector('button')!;
    button.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should render the Try again button', () => {
    const el: HTMLElement = fixture.nativeElement;
    const button = el.querySelector('button');
    expect(button).toBeTruthy();
    expect(button!.textContent).toContain('Try again');
  });
});
