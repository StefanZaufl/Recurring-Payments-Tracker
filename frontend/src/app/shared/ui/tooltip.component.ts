import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, signal } from '@angular/core';

@Component({
  selector: 'app-tooltip',
  imports: [CommonModule],
  template: `
	    <span class="relative inline-flex"
	      tabindex="0"
	      (mouseenter)="open()"
	      (mouseleave)="closeFromHover()"
	      (focusin)="open()"
	      (keydown.enter)="toggle($event)"
	      (keydown.space)="toggle($event)"
	      (click)="toggle($event)">
      <span [attr.aria-describedby]="isOpen() ? tooltipId : null">
        <ng-content select="[tooltip-trigger]" />
      </span>
      @if (isOpen()) {
        <span
          [id]="tooltipId"
	          role="tooltip"
	          class="absolute z-50 min-w-40 max-w-72 rounded-xl border border-card-border bg-card px-3 py-2 text-xs text-white shadow-xl"
	          [ngClass]="positionClass">
          <ng-content />
        </span>
      }
    </span>
  `
})
export class TooltipComponent {
  @Input() position: 'top' | 'bottom' | 'left' | 'right' = 'top';

  readonly tooltipId = `tooltip-${crypto.randomUUID()}`;
  readonly isOpen = signal(false);

  get positionClass(): string {
    switch (this.position) {
      case 'bottom': return 'left-1/2 top-full mt-2 -translate-x-1/2';
      case 'left': return 'right-full top-1/2 mr-2 -translate-y-1/2';
      case 'right': return 'left-full top-1/2 ml-2 -translate-y-1/2';
      default: return 'bottom-full left-1/2 mb-2 -translate-x-1/2';
    }
  }

  open(): void {
    window.dispatchEvent(new CustomEvent('app-tooltip-open', { detail: this.tooltipId }));
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  closeFromHover(): void {
    this.close();
  }

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  @HostListener('window:app-tooltip-open', ['$event'])
  onAnyTooltipOpen(event: CustomEvent<string>): void {
    if (event.detail !== this.tooltipId) {
      this.close();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
