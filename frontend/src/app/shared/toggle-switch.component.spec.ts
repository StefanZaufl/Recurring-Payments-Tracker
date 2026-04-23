import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ToggleSwitchComponent } from './toggle-switch.component';

describe('ToggleSwitchComponent', () => {
  let fixture: ComponentFixture<ToggleSwitchComponent>;
  let component: ToggleSwitchComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToggleSwitchComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToggleSwitchComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Show inactive');
    fixture.detectChanges();
  });

  it('should render the label', () => {
    expect(fixture.nativeElement.textContent).toContain('Show inactive');
  });

  it('should emit checked changes', () => {
    const spy = jest.fn();
    component.checkedChange.subscribe(spy);

    fixture.debugElement.query(By.css('input')).nativeElement.click();

    expect(spy).toHaveBeenCalledWith(true);
  });
});
