import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DateRange {
  from: string | null;
  to: string | null;
  label: string;
}

@Component({
  selector: 'app-date-range-picker',
  imports: [CommonModule],
  template: `
    <!-- Trigger button -->
    <button (click)="toggle()" class="flex items-center gap-2 px-3 py-2 bg-card border border-card-border rounded-xl text-sm text-white hover:bg-card-hover transition-colors min-w-0">
      <svg class="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      <span class="truncate">{{ currentLabel }}</span>
      <svg class="w-3 h-3 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>
    
    <!-- Modal backdrop -->
    @if (open) {
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        role="button"
        tabindex="0"
        aria-label="Close date picker"
        (click)="close()"
        (keydown.enter)="close()">
        <div class="glass-card w-full max-w-md p-0 animate-slide-up border-subtle"
          role="dialog"
          tabindex="-1"
          (click)="$event.stopPropagation()"
          (keydown.enter)="$event.stopPropagation()">
          <!-- Tabs -->
          <div class="flex border-b border-card-border">
            <button (click)="activeTab = 'presets'"
              class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
                  [ngClass]="{
                    'text-white border-b-2 border-accent': activeTab === 'presets',
                    'text-muted hover:text-white': activeTab !== 'presets'
                  }">
              Presets
            </button>
            <button (click)="activeTab = 'custom'"
              class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
                  [ngClass]="{
                    'text-white border-b-2 border-accent': activeTab === 'custom',
                    'text-muted hover:text-white': activeTab !== 'custom'
                  }">
              Custom
            </button>
          </div>
          <!-- Presets tab -->
          @if (activeTab === 'presets') {
            <div class="p-4 space-y-1">
              @for (preset of presets; track preset) {
                <button
                  (click)="selectPreset(preset)"
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors"
                  [ngClass]="{
                    'bg-subtle text-white': isActivePreset(preset),
                    'text-muted hover:bg-card-hover hover:text-white': !isActivePreset(preset)
                  }">
                  <span>{{ preset.label }}</span>
                  @if (isActivePreset(preset)) {
                    <svg class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  }
                </button>
              }
              <button (click)="clearRange()"
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left transition-colors"
                  [ngClass]="{
                    'bg-subtle text-white': !from && !to,
                    'text-muted hover:bg-card-hover hover:text-white': from || to
                  }">
                <span>All time</span>
                @if (!from && !to) {
                  <svg class="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                }
              </button>
            </div>
          }
          <!-- Custom tab -->
          @if (activeTab === 'custom') {
            <div class="p-4">
              <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label for="dateRangeFrom" class="text-[11px] text-muted uppercase tracking-wider font-medium block mb-1.5">From</label>
                  <input id="dateRangeFrom" type="date"
                    [value]="customFrom"
                    (change)="customFrom = $any($event.target).value"
                    class="w-full bg-subtle border border-card-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
                </div>
                <div>
                  <label for="dateRangeTo" class="text-[11px] text-muted uppercase tracking-wider font-medium block mb-1.5">To</label>
                  <input id="dateRangeTo" type="date"
                    [value]="customTo"
                    (change)="customTo = $any($event.target).value"
                    class="w-full bg-subtle border border-card-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
                </div>
              </div>
              <!-- Month navigation + calendar -->
              <div class="grid grid-cols-2 gap-4">
                @for (month of [calendarLeft, calendarRight]; track month; let i = $index) {
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      @if (i === 0) {
                        <button (click)="prevMonth()" class="w-6 h-6 flex items-center justify-center rounded-md hover:bg-subtle text-muted hover:text-white transition-colors">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                          </svg>
                        </button>
                      }
                      @if (i === 1) {
                        <span class="w-6"></span>
                      }
                      <span class="text-xs font-medium text-white">{{ monthName(month.year, month.month) }}</span>
                      @if (i === 1) {
                        <button (click)="nextMonth()" class="w-6 h-6 flex items-center justify-center rounded-md hover:bg-subtle text-muted hover:text-white transition-colors">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      }
                      @if (i === 0) {
                        <span class="w-6"></span>
                      }
                    </div>
                    <!-- Day headers -->
                    <div class="grid grid-cols-7 mb-1">
                      @for (d of dayLabels; track d) {
                        <span class="text-center text-[10px] text-muted font-medium py-0.5">{{ d }}</span>
                      }
                    </div>
                    <!-- Days -->
                    <div class="grid grid-cols-7">
                      @for (day of month.days; track day) {
                        <button
                          (click)="day.day ? selectDay(month.year, month.month, day.day) : null"
                          class="text-center text-xs py-1 rounded-md transition-colors"
                        [ngClass]="{
                          'text-transparent cursor-default': !day.day,
                          'text-muted hover:bg-subtle hover:text-white cursor-pointer': day.day && !day.isSelected && !day.isInRange,
                          'bg-accent text-surface font-medium': day.isSelected,
                          'bg-accent/15 text-accent': day.isInRange && !day.isSelected
                        }">
                          {{ day.day || '&nbsp;' }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
              <div class="flex justify-end gap-2 mt-4">
                <button (click)="close()" class="px-3 py-1.5 text-xs text-muted hover:text-white transition-colors rounded-lg">Cancel</button>
                <button (click)="applyCustomRange()" class="px-4 py-1.5 text-xs bg-accent text-surface font-semibold rounded-lg hover:brightness-110 transition-all">Apply</button>
              </div>
            </div>
          }
        </div>
      </div>
    }
    `
})
export class DateRangePickerComponent {
  @Input() from: string | null = null;
  @Input() to: string | null = null;
  @Output() rangeChanged = new EventEmitter<DateRange>();

  open = false;
  activeTab: 'presets' | 'custom' = 'presets';
  customFrom = '';
  customTo = '';
  private _now = new Date();
  calendarLeft = { year: this._now.getFullYear(), month: this._now.getMonth(), days: [] as CalendarDay[] };
  calendarRight = {
    year: this._now.getMonth() === 11 ? this._now.getFullYear() + 1 : this._now.getFullYear(),
    month: (this._now.getMonth() + 1) % 12,
    days: [] as CalendarDay[]
  };
  dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  // Custom calendar picking state
  private pickFrom: string | null = null;
  private pickTo: string | null = null;

  get presets(): DateRange[] {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3);

    return [
      {
        label: 'This month',
        from: this.toDateStr(year, month, 1),
        to: this.toDateStr(year, month + 1, 0)
      },
      {
        label: 'Previous month',
        from: this.toDateStr(year, month - 1, 1),
        to: this.toDateStr(year, month, 0)
      },
      {
        label: 'This quarter',
        from: this.toDateStr(year, quarter * 3, 1),
        to: this.toDateStr(year, quarter * 3 + 3, 0)
      },
      {
        label: 'This year',
        from: `${year}-01-01`,
        to: `${year}-12-31`
      }
    ];
  }

  get currentLabel(): string {
    if (!this.from && !this.to) return 'All time';
    const preset = this.presets.find(p => p.from === this.from && p.to === this.to);
    if (preset) return preset.label;
    const parts: string[] = [];
    if (this.from) parts.push(this.formatDisplay(this.from));
    if (this.to) parts.push(this.formatDisplay(this.to));
    return parts.join(' - ');
  }

  isActivePreset(preset: DateRange): boolean {
    return this.from === preset.from && this.to === preset.to;
  }

  toggle(): void {
    this.open ? this.close() : this.openPicker();
  }

  openPicker(): void {
    this.open = true;
    this.activeTab = 'presets';
    this.customFrom = this.from || '';
    this.customTo = this.to || '';
    this.pickFrom = this.from;
    this.pickTo = this.to;
    const now = new Date();
    this.calendarLeft = this.buildMonth(now.getFullYear(), now.getMonth());
    this.calendarRight = this.buildMonth(
      now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(),
      (now.getMonth() + 1) % 12
    );
  }

  close(): void {
    this.open = false;
  }

  selectPreset(preset: DateRange): void {
    this.rangeChanged.emit(preset);
    this.from = preset.from;
    this.to = preset.to;
    this.close();
  }

  clearRange(): void {
    this.rangeChanged.emit({ from: null, to: null, label: 'All time' });
    this.from = null;
    this.to = null;
    this.close();
  }

  applyCustomRange(): void {
    const from = this.customFrom || null;
    const to = this.customTo || null;
    const label = from || to ? `${from || '...'} - ${to || '...'}` : 'All time';
    this.from = from;
    this.to = to;
    this.rangeChanged.emit({ from, to, label });
    this.close();
  }

  selectDay(year: number, month: number, day: number): void {
    const dateStr = this.toDateStr(year, month, day);
    if (!this.pickFrom || (this.pickFrom && this.pickTo)) {
      this.pickFrom = dateStr;
      this.pickTo = null;
    } else {
      if (dateStr < this.pickFrom) {
        this.pickTo = this.pickFrom;
        this.pickFrom = dateStr;
      } else {
        this.pickTo = dateStr;
      }
    }
    this.customFrom = this.pickFrom || '';
    this.customTo = this.pickTo || '';
    this.rebuildCalendars();
  }

  prevMonth(): void {
    if (this.calendarLeft.month === 0) {
      this.calendarLeft = this.buildMonth(this.calendarLeft.year - 1, 11);
    } else {
      this.calendarLeft = this.buildMonth(this.calendarLeft.year, this.calendarLeft.month - 1);
    }
    const lm = this.calendarLeft.month;
    const ly = this.calendarLeft.year;
    this.calendarRight = this.buildMonth(
      lm === 11 ? ly + 1 : ly,
      (lm + 1) % 12
    );
  }

  nextMonth(): void {
    if (this.calendarRight.month === 11) {
      this.calendarRight = this.buildMonth(this.calendarRight.year + 1, 0);
    } else {
      this.calendarRight = this.buildMonth(this.calendarRight.year, this.calendarRight.month + 1);
    }
    const rm = this.calendarRight.month;
    const ry = this.calendarRight.year;
    this.calendarLeft = this.buildMonth(
      rm === 0 ? ry - 1 : ry,
      rm === 0 ? 11 : rm - 1
    );
  }

  monthName(year: number, month: number): string {
    return new Date(year, month, 1).toLocaleString('en', { month: 'short', year: 'numeric' });
  }

  private buildMonth(year: number, month: number): { year: number; month: number; days: CalendarDay[] } {
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday start
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: CalendarDay[] = [];

    for (let i = 0; i < offset; i++) {
      days.push({ day: 0, isSelected: false, isInRange: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = this.toDateStr(year, month, d);
      const isSelected = dateStr === this.customFrom || dateStr === this.customTo;
      const isInRange = !!this.customFrom && !!this.customTo && dateStr > this.customFrom && dateStr < this.customTo;
      days.push({ day: d, isSelected, isInRange });
    }
    return { year, month, days };
  }

  private rebuildCalendars(): void {
    this.calendarLeft = this.buildMonth(this.calendarLeft.year, this.calendarLeft.month);
    this.calendarRight = this.buildMonth(this.calendarRight.year, this.calendarRight.month);
  }

  private toDateStr(year: number, month: number, day: number): string {
    const d = new Date(year, month, day);
    return d.toISOString().slice(0, 10);
  }

  private formatDisplay(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

interface CalendarDay {
  day: number;
  isSelected: boolean;
  isInRange: boolean;
}
