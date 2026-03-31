import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransactionsService, UploadResponse } from '../../api/generated';

@Component({
  selector: 'app-file-upload',
  imports: [CommonModule],
  template: `
    <div class="max-w-xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Upload Bank CSV</h1>
      <div
        class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors"
        [class.border-blue-400]="isDragging"
        (dragover)="onDragOver($event)"
        (dragleave)="isDragging = false"
        (drop)="onDrop($event)">
        <div class="text-gray-500">
          <p class="text-lg mb-2">Drag & drop your CSV file here</p>
          <p class="text-sm mb-4">or</p>
          <label class="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Browse Files
            <input type="file" accept=".csv" class="hidden" (change)="onFileSelected($event)" />
          </label>
        </div>
      </div>

      @if (uploading) {
        <div class="mt-6 text-center text-gray-600">Uploading...</div>
      }

      @if (result) {
        <div class="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 class="text-green-800 font-semibold">Upload Successful</h3>
          <p class="text-green-700 text-sm mt-1">{{ result.transactionCount }} transactions imported</p>
          <p class="text-green-700 text-sm">{{ result.recurringPaymentsDetected }} recurring payments detected</p>
        </div>
      }

      @if (error) {
        <div class="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-800">{{ error }}</p>
        </div>
      }
    </div>
  `
})
export class FileUploadComponent {
  isDragging = false;
  uploading = false;
  result: UploadResponse | null = null;
  error: string | null = null;

  constructor(private transactionsService: TransactionsService) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.upload(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.upload(file);
  }

  private upload(file: File) {
    this.uploading = true;
    this.result = null;
    this.error = null;
    this.transactionsService.uploadCsv(file).subscribe({
      next: (res) => {
        this.result = res;
        this.uploading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Upload failed. Please try again.';
        this.uploading = false;
      }
    });
  }
}
