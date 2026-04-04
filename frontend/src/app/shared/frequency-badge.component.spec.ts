import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FrequencyBadgeComponent } from './frequency-badge.component';

describe('FrequencyBadgeComponent', () => {
  let component: FrequencyBadgeComponent;
  let fixture: ComponentFixture<FrequencyBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FrequencyBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FrequencyBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the frequency text', () => {
    component.frequency = 'MONTHLY';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('MONTHLY');
  });

  it('should apply violet classes for MONTHLY', () => {
    component.frequency = 'MONTHLY';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('span');
    expect(badge.classList).toContain('bg-violet-dim');
    expect(badge.classList).toContain('text-violet');
  });

  it('should apply amber classes for QUARTERLY', () => {
    component.frequency = 'QUARTERLY';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('span');
    expect(badge.classList).toContain('bg-amber-dim');
    expect(badge.classList).toContain('text-amber');
  });

  it('should apply sky classes for YEARLY', () => {
    component.frequency = 'YEARLY';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('span');
    expect(badge.classList).toContain('bg-sky-dim');
    expect(badge.classList).toContain('text-sky');
  });
});
