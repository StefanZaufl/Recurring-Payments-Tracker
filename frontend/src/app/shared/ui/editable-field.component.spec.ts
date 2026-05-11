import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { EditableFieldComponent } from './editable-field.component';

@Component({
  standalone: true,
  imports: [EditableFieldComponent],
  template: `
    <app-editable-field
      [editing]="editing"
      [label]="label"
      (startEdit)="startEditCalled = true"
      (save)="saveCalled = true"
      (cancelEdit)="cancelEditCalled = true">
      <span display>Display Value</span>
      <input editor type="text" />
    </app-editable-field>
  `,
})
class TestHostComponent {
  editing = false;
  label = 'username';
  startEditCalled = false;
  saveCalled = false;
  cancelEditCalled = false;
}

describe('EditableFieldComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show display content when not editing', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="button"]')).toBeTruthy();
    expect(el.textContent).toContain('Display Value');
  });

  it('should show save/cancel buttons when editing', () => {
    host.editing = true;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(el.querySelector('input[type="text"]')).toBeTruthy();
  });

  it('should emit edit event on click', () => {
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLElement>('[role="button"]')!.click();
    expect(host.startEditCalled).toBe(true);
  });

  it('should emit save event on save button click', () => {
    host.editing = true;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLElement>('button[aria-label="Save"]')!.click();
    expect(host.saveCalled).toBe(true);
  });

  it('should emit cancel event on cancel button click', () => {
    host.editing = true;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLElement>('button[aria-label="Cancel"]')!.click();
    expect(host.cancelEditCalled).toBe(true);
  });

  it('should include aria-label with field name', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[aria-label="Edit username"]')).toBeTruthy();
  });
});
