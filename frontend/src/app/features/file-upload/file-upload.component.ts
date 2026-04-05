import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FileUploadZoneComponent } from '../../shared/file-upload-zone.component';

@Component({
  selector: 'app-file-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileUploadZoneComponent],
  template: `
    <div class="animate-fade-in">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Upload</h1>
        <p class="text-sm text-muted mt-0.5">Import your bank CSV export</p>
      </div>

      <div class="max-w-lg mx-auto">
        <app-file-upload-zone size="lg" />
      </div>
    </div>
  `
})
export class FileUploadComponent {}
