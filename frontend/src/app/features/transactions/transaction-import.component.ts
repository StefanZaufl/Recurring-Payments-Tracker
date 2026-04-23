import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransactionsService, UploadResponse } from '../../api/generated';
import { TransactionCsvImportMapping } from '../../api/generated/model/transactionCsvImportMapping';
import {
  CHARSET_OPTIONS,
  CsvPreview,
  ExpectedField,
  SupportedCharset,
  TransactionImportParserService
} from './transaction-import-parser.service';

type RequiredField = 'bookingDate' | 'amount';

interface FieldOption {
  value: ExpectedField;
  label: string;
}

@Component({
  selector: 'app-transaction-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  styles: [`
    .preview-scroll {
      scrollbar-width: auto;
      scrollbar-color: #6b7194 #1d2132;
      scrollbar-gutter: stable both-edges;
      padding-bottom: 0.5rem;
    }

    .preview-scroll::-webkit-scrollbar {
      height: 16px;
    }

    .preview-scroll::-webkit-scrollbar-track {
      background: #1d2132;
      border-radius: 9999px;
    }

    .preview-scroll::-webkit-scrollbar-thumb {
      background: linear-gradient(90deg, #6b7194, #8f96bb);
      border-radius: 9999px;
      border: 3px solid #1d2132;
    }

    .preview-scroll::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(90deg, #7b82a8, #a1a8cb);
    }
  `],
  template: `
    <div class="animate-fade-in">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <a routerLink="/transactions" class="text-xs text-accent hover:text-accent/80 transition-colors">
              Transactions
            </a>
            <span class="text-xs text-muted/60">/</span>
            <span class="text-xs text-muted">Import</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Import Transactions</h1>
          <p class="text-sm text-muted mt-0.5">Preview the CSV, map columns, and upload when the required fields are configured.</p>
        </div>
        <a routerLink="/transactions" class="btn-secondary text-xs inline-flex items-center justify-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back
        </a>
      </div>

      <div class="grid gap-6">
        <section class="glass-card p-5 sm:p-6">
          <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 class="text-base font-semibold text-white">1. Select CSV File</h2>
              <p class="text-sm text-muted mt-1">The first five data rows are used for the preview and column mapping.</p>
            </div>
            <label class="btn-primary text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V4.5m0 0L7.5 9m4.5-4.5L16.5 9M4.5 15.75v2.25A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-2.25" />
              </svg>
              Choose File
              <input type="file" accept=".csv,text/csv" class="hidden" (change)="onFileSelected($event)" />
            </label>
          </div>

          @if (selectedFileName) {
            <div class="mt-4 flex flex-wrap gap-2">
              <div class="inline-flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
                <span class="font-medium text-white">{{ selectedFileName }}</span>
                @if (preview) {
                  <span>{{ preview.rows.length }} preview row{{ preview.rows.length === 1 ? '' : 's' }}</span>
                }
              </div>
              @if (selectedCharset) {
                <div class="inline-flex items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
                  <span>Detected charset</span>
                  <span class="font-medium text-white">{{ displayCharsetLabel(detectedCharset || selectedCharset) }}</span>
                </div>
              }
            </div>
          }

          @if (uploadResult) {
            <div class="mt-4 rounded-xl border border-accent/20 bg-accent-dim px-4 py-3 text-sm text-accent">
              <p>
                Imported {{ uploadResult.transactionCount }} transactions, skipped {{ uploadResult.skippedDuplicates }} duplicates, and detected {{ uploadResult.recurringPaymentsDetected }} recurring payments.
              </p>
              @if (uploadResult.transactionsMarkedInterAccount !== null && uploadResult.transactionsMarkedInterAccount !== undefined) {
                <p class="mt-2 text-accent/90">
                  Recalculation marked {{ uploadResult.transactionsMarkedInterAccount }} transactions as inter-account, removed {{ uploadResult.transactionLinksRemoved ?? 0 }} transaction links, deleted {{ uploadResult.recurringPaymentsDeleted ?? 0 }} recurring payments, and detected {{ uploadResult.recalculationRecurringPaymentsDetected ?? 0 }} recurring payments.
                </p>
              }
            </div>
          }

          @if (parseError) {
            <div class="mt-4 rounded-xl border border-coral/20 bg-coral-dim px-4 py-3 text-sm text-coral">
              {{ parseError }}
            </div>
          }
        </section>

        @if (preview) {
          <section class="glass-card p-5 sm:p-6 overflow-hidden">
            <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div>
                <h2 class="text-base font-semibold text-white">2. Map CSV Columns</h2>
                <p class="text-sm text-muted mt-1">Required fields: booking date and amount. Optional details fallback is only used when the mapped details cell is empty.</p>
              </div>
              <button
                type="button"
                (click)="importTransactions()"
                [disabled]="!canImport()"
                class="btn-primary text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                @if (!uploading) {
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V4.5m0 0L7.5 9m4.5-4.5L16.5 9M4.5 15.75v2.25A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-2.25" />
                  </svg>
                }
                @if (uploading) {
                  <span class="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></span>
                }
                Import
              </button>
            </div>

            <div class="mb-4 flex justify-end">
              <label class="block">
                <span class="text-[11px] uppercase tracking-wide text-muted/70">CSV Charset</span>
                <select
                  class="mt-1 w-full rounded-lg border border-card-border bg-subtle px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                  [value]="selectedCharset"
                  (change)="onCharsetChange($any($event.target).value)">
                  @for (option of charsetOptions; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </label>
            </div>

            @if (mappingError) {
              <div class="mb-4 rounded-xl border border-coral/20 bg-coral-dim px-4 py-3 text-sm text-coral">
                {{ mappingError }}
              </div>
            }

            @if (uploadError) {
              <div class="mb-4 rounded-xl border border-coral/20 bg-coral-dim px-4 py-3 text-sm text-coral">
                {{ uploadError }}
              </div>
            }

            <div class="preview-scroll overflow-x-auto">
              <table class="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    @for (header of preview.headers; track header + '-' + $index; let i = $index) {
                      <th class="min-w-[220px] align-top border-b border-card-border px-3 py-3 text-left">
                        <div class="text-sm font-semibold text-white">{{ header || ('Column ' + (i + 1)) }}</div>
                        <div class="mt-3 text-[11px] uppercase tracking-wide text-muted/70">Field Mapping</div>
                        <select
                          class="mt-1 w-full rounded-lg border border-card-border bg-subtle px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                          (change)="onFieldMappingChange(i, $any($event.target).value)">
                          @for (option of fieldOptions; track option.value) {
                            <option [value]="option.value" [selected]="columnMappings[i] === option.value">{{ option.label }}</option>
                          }
                        </select>
                      </th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-card-border">
                  @for (row of preview.rows; track $index) {
                    <tr>
                      @for (cell of row; track $index) {
                        <td class="border-b border-card-border/60 px-3 py-3 align-top text-xs text-muted">
                          {{ cell || ' ' }}
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      </div>
    </div>
  `
})
export class TransactionImportComponent {
  private transactionsService = inject(TransactionsService);
  private parser = inject(TransactionImportParserService);
  private cdr = inject(ChangeDetectorRef);

  readonly fieldOptions: FieldOption[] = [
    { value: 'ignore', label: 'Ignore column' },
    { value: 'bookingDate', label: 'Booking date' },
    { value: 'amount', label: 'Amount' },
    { value: 'account', label: 'Account IBAN' },
    { value: 'partnerName', label: 'Partner name' },
    { value: 'partnerIban', label: 'Partner IBAN' },
    { value: 'details', label: 'Details' },
    { value: 'detailsFallback', label: 'Details Fallback' }
  ];

  readonly charsetOptions = CHARSET_OPTIONS;

  selectedFile: File | null = null;
  selectedFileName: string | null = null;
  selectedFileBytes: ArrayBuffer | null = null;
  selectedCharset: SupportedCharset = 'utf-8';
  detectedCharset: SupportedCharset | null = null;
  preview: CsvPreview | null = null;
  columnMappings: ExpectedField[] = [];
  parseError: string | null = null;
  mappingError: string | null = null;
  uploadError: string | null = null;
  uploadResult: UploadResponse | null = null;
  uploading = false;

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.selectedFile = file;
    this.selectedFileName = file.name;
    this.uploadResult = null;
    this.uploadError = null;

    try {
      const bytes = await this.parser.readFileBytes(file);
      this.selectedFileBytes = bytes;

      const detection = this.parser.detectCharset(bytes);
      this.detectedCharset = detection.charset;
      this.selectedCharset = detection.charset;

      this.recomputePreview(false);
    } catch (error) {
      this.resetFormState();
      this.selectedFileName = file.name;
      this.parseError = error instanceof Error ? error.message : 'Failed to read CSV file.';
    }

    input.value = '';
    this.cdr.markForCheck();
  }

  onCharsetChange(value: SupportedCharset): void {
    if (!this.selectedFileBytes || this.selectedCharset === value) {
      return;
    }

    this.selectedCharset = value;
    this.uploadResult = null;
    this.uploadError = null;
    this.recomputePreview(true);
    this.cdr.markForCheck();
  }

  onFieldMappingChange(columnIndex: number, value: ExpectedField): void {
    if (value !== 'ignore') {
      this.columnMappings = this.columnMappings.map((mapped, index) =>
        index !== columnIndex && mapped === value ? 'ignore' : mapped
      );
    }

    this.columnMappings[columnIndex] = value;

    this.uploadResult = null;
    this.uploadError = null;
    this.updateMappingError();
  }

  canImport(): boolean {
    return !!this.selectedFile && !!this.preview && !this.mappingError && !this.uploading;
  }

  importTransactions(): void {
    if (!this.selectedFile || !this.preview) {
      return;
    }

    this.updateMappingError();
    if (this.mappingError) {
      return;
    }

    this.uploading = true;
    this.uploadError = null;
    this.uploadResult = null;

    this.transactionsService.uploadCsv(
      this.selectedFile,
      JSON.stringify(this.buildImportMappingPayload()),
      this.selectedCharset
    ).subscribe({
      next: (result) => {
        this.resetFormState();
        this.uploadResult = result;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.uploadError = err.error?.message || 'Import failed. Please try again.';
        this.uploading = false;
        this.cdr.markForCheck();
      }
    });
  }

  displayCharsetLabel(value: SupportedCharset): string {
    return this.charsetOptions.find((option) => option.value === value)?.label ?? value;
  }

  private recomputePreview(preserveMappings: boolean): void {
    if (!this.selectedFileBytes) {
      this.preview = null;
      this.columnMappings = [];
      this.parseError = null;
      this.mappingError = null;
      return;
    }

    try {
      const text = this.parser.decodeFileBytes(this.selectedFileBytes, this.selectedCharset);
      const preview = this.parser.buildPreview(text);
      const previousMappings = preserveMappings ? this.columnMappings : [];

      this.preview = preview;
      this.columnMappings = this.parser.buildColumnMappings(preview.headers, previousMappings);
      this.parseError = null;
      this.updateMappingError();
    } catch (error) {
      this.preview = null;
      this.columnMappings = [];
      this.parseError = error instanceof Error ? error.message : 'Failed to decode CSV file.';
      this.mappingError = null;
    }
  }

  private updateMappingError(): void {
    const missingRequired = this.requiredFields().filter((field) => this.findHeaderForField(field) === null);
    if (missingRequired.length > 0) {
      this.mappingError = `Required fields still need a column mapping: ${missingRequired.join(', ')}.`;
      return;
    }

    this.mappingError = null;
  }

  private requiredFields(): RequiredField[] {
    return ['bookingDate', 'amount'];
  }

  private findHeaderForField(field: Exclude<ExpectedField, 'ignore'>): string | null {
    if (!this.preview) {
      return null;
    }
    const index = this.columnMappings.findIndex((mapping) => mapping === field);
    return index >= 0 ? this.preview.headers[index] : null;
  }

  private buildImportMappingPayload(): TransactionCsvImportMapping {
    const bookingDate = this.findHeaderForField('bookingDate');
    const amount = this.findHeaderForField('amount');

    if (!bookingDate || !amount) {
      throw new Error('Required mappings are missing.');
    }

    const payload: TransactionCsvImportMapping = {
      bookingDate,
      amount
    };

    const account = this.findHeaderForField('account');
    const partnerName = this.findHeaderForField('partnerName');
    const partnerIban = this.findHeaderForField('partnerIban');
    const details = this.findHeaderForField('details');
    if (account) {
      payload.account = account;
    }
    if (partnerName) {
      payload.partnerName = partnerName;
    }
    if (partnerIban) {
      payload.partnerIban = partnerIban;
    }
    if (details) {
      payload.details = details;
    }
    const detailsFallback = this.findHeaderForField('detailsFallback');
    if (detailsFallback) {
      payload.detailsFallback = detailsFallback;
    }

    return payload;
  }

  private resetFormState(): void {
    this.selectedFile = null;
    this.selectedFileName = null;
    this.selectedFileBytes = null;
    this.selectedCharset = 'utf-8';
    this.detectedCharset = null;
    this.preview = null;
    this.columnMappings = [];
    this.parseError = null;
    this.mappingError = null;
    this.uploadError = null;
    this.uploading = false;
  }
}
