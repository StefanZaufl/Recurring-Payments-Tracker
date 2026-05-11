import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
  });

  it('should render heading and description', () => {
    fixture.componentRef.setInput('heading', 'Nothing here');
    fixture.componentRef.setInput('description', 'Try another filter.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nothing here');
    expect(fixture.nativeElement.textContent).toContain('Try another filter.');
  });

  it('should render a call to action when route and text are provided', () => {
    fixture.componentRef.setInput('ctaText', 'Create');
    fixture.componentRef.setInput('ctaRoute', '/create');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Create');
  });
});
