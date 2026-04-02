import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateRangePickerComponent, DateRange } from './date-range-picker.component';

describe('DateRangePickerComponent', () => {
  let component: DateRangePickerComponent;
  let fixture: ComponentFixture<DateRangePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateRangePickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DateRangePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show "All time" when no range is set', () => {
    expect(component.currentLabel).toBe('All time');
  });

  it('should open and close the picker', () => {
    expect(component.open).toBe(false);
    component.toggle();
    expect(component.open).toBe(true);
    component.toggle();
    expect(component.open).toBe(false);
  });

  it('should default to presets tab when opened', () => {
    component.openPicker();
    expect(component.activeTab).toBe('presets');
  });

  it('should emit range when selecting a preset', () => {
    const emitted: DateRange[] = [];
    component.rangeChanged.subscribe((r: DateRange) => emitted.push(r));

    component.openPicker();
    const preset = component.presets[0]; // "This month"
    component.selectPreset(preset);

    expect(emitted.length).toBe(1);
    expect(emitted[0].from).toBe(preset.from);
    expect(emitted[0].to).toBe(preset.to);
    expect(component.open).toBe(false);
  });

  it('should emit null range when clearing', () => {
    const emitted: DateRange[] = [];
    component.rangeChanged.subscribe((r: DateRange) => emitted.push(r));

    component.from = '2026-01-01';
    component.to = '2026-01-31';
    component.clearRange();

    expect(emitted.length).toBe(1);
    expect(emitted[0].from).toBeNull();
    expect(emitted[0].to).toBeNull();
    expect(component.from).toBeNull();
    expect(component.to).toBeNull();
  });

  it('should apply custom date range', () => {
    const emitted: DateRange[] = [];
    component.rangeChanged.subscribe((r: DateRange) => emitted.push(r));

    component.openPicker();
    component.customFrom = '2026-03-01';
    component.customTo = '2026-03-31';
    component.applyCustomRange();

    expect(emitted.length).toBe(1);
    expect(emitted[0].from).toBe('2026-03-01');
    expect(emitted[0].to).toBe('2026-03-31');
    expect(component.open).toBe(false);
  });

  it('should select days in calendar and update custom fields', () => {
    component.openPicker();
    component.activeTab = 'custom';

    component.selectDay(2026, 3, 5); // first click sets from
    expect(component['customFrom']).toBe('2026-04-05');
    expect(component['customTo']).toBe('');

    component.selectDay(2026, 3, 15); // second click sets to
    expect(component['customFrom']).toBe('2026-04-05');
    expect(component['customTo']).toBe('2026-04-15');
  });

  it('should swap from/to when selecting earlier date second', () => {
    component.openPicker();
    component.selectDay(2026, 3, 20);
    component.selectDay(2026, 3, 5);
    expect(component['customFrom']).toBe('2026-04-05');
    expect(component['customTo']).toBe('2026-04-20');
  });

  it('should have four presets', () => {
    expect(component.presets.length).toBe(4);
    const labels = component.presets.map(p => p.label);
    expect(labels).toContain('This month');
    expect(labels).toContain('Previous month');
    expect(labels).toContain('This quarter');
    expect(labels).toContain('This year');
  });

  it('should navigate months forward and backward', () => {
    component.openPicker();
    const leftMonth = component.calendarLeft.month;
    const rightMonth = component.calendarRight.month;

    component.nextMonth();
    expect(component.calendarRight.month).toBe((rightMonth + 1) % 12);

    component.prevMonth();
    expect(component.calendarLeft.month).toBe(leftMonth);
  });
});
