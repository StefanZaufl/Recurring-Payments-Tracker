import { Component, EventEmitter, Input, Output, inject, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TransactionsService, UploadResponse } from '../api/generated';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-file-upload-zone',
  imports: [RouterLink],
  template: `
    <!-- Drop zone -->
    <div
      class="glass-card text-center cursor-pointer group transition-all duration-300"
      [class.p-10]="size === 'lg'"
      [class.sm:p-14]="size === 'lg'"
      [class.p-6]="size === 'sm'"
      [class.sm:p-14]="size === 'sm'"
      [class.border-accent]="isDragging"
      [class.bg-accent-dim]="isDragging"
      [class.scale-105]="isDragging && size === 'lg'"
      role="button"
      tabindex="0"
      (dragover)="onDragOver($event)"
      (dragleave)="isDragging = false"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
      (keydown.enter)="fileInput.click()">

      <input #fileInput type="file" accept=".csv" class="hidden" (change)="onFileSelected($event)" />

      <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-colors duration-300 bg-accent-dim">
        <svg class="w-7 h-7 transition-colors duration-300 text-accent"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>

      <p class="text-sm font-medium text-white mb-1.5">
        {{ isDragging ? 'Drop your file here' : 'Drag & drop your CSV file' }}
      </p>
      <p class="text-xs text-muted mb-5">or click to browse</p>

      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-subtle text-xs text-muted">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        .csv files only
      </div>
    </div>

    <!-- Uploading state -->
    @if (uploading) {
      <div class="glass-card p-5 mt-4 animate-slide-up">
        <div class="flex items-center gap-3">
          <div class="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin shrink-0"></div>
          <span class="text-sm text-muted">Uploading and processing...</span>
        </div>
      </div>
    }

    <!-- Success state -->
    @if (result) {
      <div class="glass-card p-5 mt-4 border-accent/20 animate-slide-up">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-accent mb-1">Upload successful</p>
            <p class="text-xs text-muted">
              <span class="font-mono text-white">{{ result.transactionCount }}</span> transactions imported
            </p>
            <p class="text-xs text-muted">
              <span class="font-mono text-white">{{ result.recurringPaymentsDetected }}</span> recurring payments detected
            </p>
            <a routerLink="/dashboard" class="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:text-accent/80 transition-colors">
              View dashboard
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    }

    <!-- Error state -->
    @if (error) {
      <div class="glass-card p-5 mt-4 border-coral/20 animate-slide-up">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-coral-dim flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p class="text-sm text-coral">{{ error }}</p>
        </div>
      </div>
    }

    <!-- Format info -->
    <div class="mt-4 px-1">
      <p class="text-[11px] text-muted/60 leading-relaxed">
        Accepts semicolon-delimited CSV with columns: Buchungsdatum, Partnername, Betrag.
        European date (DD.MM.YYYY) and number formats (-12,99).
      </p>
    </div>
  `
})
export class FileUploadZoneComponent implements OnDestroy {
  private transactionsService = inject(TransactionsService);
  private destroy$ = new Subject<void>();

  @Input() size: 'sm' | 'lg' = 'lg';
  @Output() uploaded = new EventEmitter<UploadResponse>();

  isDragging = false;
  uploading = false;
  result: UploadResponse | null = null;
  error: string | null = null;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.upload(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.upload(file);
  }

  private upload(file: File): void {
    this.uploading = true;
    this.result = null;
    this.error = null;
    this.transactionsService.uploadCsv(file).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.result = res;
        this.uploading = false;
        this.uploaded.emit(res);
      },
      error: (err) => {
        this.error = err.error?.message || 'Upload failed. Please try again.';
        this.uploading = false;
      }
    });
  }
}
