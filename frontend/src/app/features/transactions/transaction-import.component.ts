import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransactionsService, UploadResponse } from '../../api/generated';
import { TransactionCsvImportMapping } from '../../api/generated/model/transactionCsvImportMapping';

type ExpectedField = 'ignore' | 'bookingDate' | 'amount' | 'account' | 'partnerName' | 'partnerIban' | 'details' | 'detailsFallback';
type RequiredField = 'bookingDate' | 'amount';
type SupportedCharset = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252' | 'iso-8859-1' | 'iso-8859-15';

interface CsvPreview {
  headers: string[];
  rows: string[][];
}

interface FieldOption {
  value: ExpectedField;
  label: string;
}

interface CharsetOption {
  value: SupportedCharset;
  label: string;
}

interface CharsetDetectionResult {
  charset: SupportedCharset;
  confidence: 'high' | 'low';
}

interface DecodedCsvCandidate {
  preview: CsvPreview;
  score: number;
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
              Imported {{ uploadResult.transactionCount }} transactions, skipped {{ uploadResult.skippedDuplicates }} duplicates, and detected {{ uploadResult.recurringPaymentsDetected }} recurring payments.
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

  readonly charsetOptions: CharsetOption[] = [
    { value: 'utf-8', label: 'UTF-8' },
    { value: 'utf-16le', label: 'UTF-16 LE' },
    { value: 'utf-16be', label: 'UTF-16 BE' },
    { value: 'windows-1252', label: 'Windows-1252' },
    { value: 'iso-8859-1', label: 'ISO-8859-1' },
    { value: 'iso-8859-15', label: 'ISO-8859-15' }
  ];

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
      const bytes = await this.readFileBytes(file);
      this.selectedFileBytes = bytes;

      const detection = this.detectCharset(bytes);
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
      const text = this.decodeFileBytes(this.selectedFileBytes, this.selectedCharset);
      const preview = this.buildPreview(text);
      const previousMappings = preserveMappings ? this.columnMappings : [];

      this.preview = preview;
      this.columnMappings = this.buildColumnMappings(preview.headers, previousMappings);
      this.parseError = null;
      this.updateMappingError();
    } catch (error) {
      this.preview = null;
      this.columnMappings = [];
      this.parseError = error instanceof Error ? error.message : 'Failed to decode CSV file.';
      this.mappingError = null;
    }
  }

  private buildPreview(text: string): CsvPreview {
    const parsedRows = this.parseCsv(text);
    if (parsedRows.length < 2) {
      throw new Error('The CSV must include a header row and at least one data row.');
    }

    const [rawHeaders, ...rows] = parsedRows;
    const headers = rawHeaders.map((header) => this.stripBom(header));
    if (headers.every((header) => !header.trim())) {
      throw new Error('The CSV header row is empty.');
    }

    return {
      headers,
      rows: rows.slice(0, 5).map((row) => this.padRow(row, headers.length))
    };
  }

  private stripBom(value: string): string {
    return value.replace(/^\uFEFF/, '');
  }

  private async readFileBytes(file: File): Promise<ArrayBuffer> {
    if (typeof file.arrayBuffer === 'function') {
      return file.arrayBuffer();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to read CSV file.'));
      };
      reader.onerror = () => reject(new Error('Failed to read CSV file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  private decodeFileBytes(bytes: ArrayBuffer, charset: SupportedCharset): string {
    try {
      return new TextDecoder(charset, { fatal: false }).decode(bytes);
    } catch {
      throw new Error(`The browser could not decode this file as ${charset}.`);
    }
  }

  private detectCharset(bytes: ArrayBuffer): CharsetDetectionResult {
    const byteView = new Uint8Array(bytes);

    if (byteView.length >= 3 && byteView[0] === 0xEF && byteView[1] === 0xBB && byteView[2] === 0xBF) {
      return { charset: 'utf-8', confidence: 'high' };
    }
    if (byteView.length >= 2 && byteView[0] === 0xFF && byteView[1] === 0xFE) {
      return { charset: 'utf-16le', confidence: 'high' };
    }
    if (byteView.length >= 2 && byteView[0] === 0xFE && byteView[1] === 0xFF) {
      return { charset: 'utf-16be', confidence: 'high' };
    }

    const candidates = this.charsetOptions
      .map((option) => ({ charset: option.value, candidate: this.scoreDecodedCandidate(bytes, option.value) }))
      .filter((entry): entry is { charset: SupportedCharset; candidate: DecodedCsvCandidate } => entry.candidate !== null)
      .sort((left, right) => right.candidate.score - left.candidate.score);

    const best = candidates[0];
    if (!best || best.candidate.score < 45) {
      return { charset: 'utf-8', confidence: 'low' };
    }

    return { charset: best.charset, confidence: 'high' };
  }

  private scoreDecodedCandidate(bytes: ArrayBuffer, charset: SupportedCharset): DecodedCsvCandidate | null {
    try {
      const text = this.decodeFileBytes(bytes, charset);
      const preview = this.buildPreview(text);
      const headers = preview.headers.join(';');
      const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
      const nullCount = text.split('\u0000').length - 1;
      const mojibakeCount = (text.match(/Ã|Â|¤|�/g) ?? []).length;
      const recognizedHeaders = preview.headers.filter((header) => this.suggestField(header) !== 'ignore').length;
      const semicolonCount = (text.match(/;/g) ?? []).length;

      let score = 50;
      score += Math.min(recognizedHeaders * 15, 45);
      score += Math.min(semicolonCount, 20);
      score -= replacementCount * 30;
      score -= nullCount * 2;
      score -= mojibakeCount * 8;
      if (headers.length === 0) {
        score -= 20;
      }

      return { preview, score };
    } catch {
      return null;
    }
  }

  private buildColumnMappings(headers: string[], previousMappings: ExpectedField[]): ExpectedField[] {
    const suggestedMappings = headers.map((header, index) => previousMappings[index] ?? this.suggestField(header));
    return this.deduplicateMappings(suggestedMappings);
  }

  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ';' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i += 1;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        continue;
      }

      currentCell += char;
    }

    if (inQuotes) {
      throw new Error('The CSV contains an unclosed quoted value.');
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  private padRow(row: string[], length: number): string[] {
    return Array.from({ length }, (_, index) => row[index] ?? '');
  }

  private suggestField(header: string): ExpectedField {
    const normalized = this.normalizeHeader(header);
    if (this.matchesAny(normalized, ['buchungsdatum', 'bookingdate', 'date', 'valuedate'])) {
      return 'bookingDate';
    }
    if (this.matchesAny(normalized, ['betrag', 'amount', 'value', 'sum', 'umsatz'])) {
      return 'amount';
    }
    if (this.matchesAny(normalized, ['kontoiban', 'accountiban', 'ibanfrom', 'sourceiban', 'auftragskonto', 'kontonummer', 'account'])) {
      return 'account';
    }
    if (this.matchesAny(normalized, ['partneriban', 'counterpartyiban', 'empfaengeriban', 'recipientiban', 'iban'])) {
      return 'partnerIban';
    }
    if (this.matchesAny(normalized, ['partnername', 'payee', 'partner', 'name', 'empfaenger'])) {
      return 'partnerName';
    }
    if (this.matchesAny(normalized, ['verwendungszweck', 'purpose', 'remittanceinfo', 'reference', 'memo'])) {
      return 'detailsFallback';
    }
    if (this.matchesAny(normalized, ['buchungsdetails', 'details', 'description', 'verwendungszweck', 'memo', 'reference'])) {
      return 'details';
    }
    return 'ignore';
  }

  private deduplicateMappings(mappings: ExpectedField[]): ExpectedField[] {
    const assigned = new Set<Exclude<ExpectedField, 'ignore'>>();
    return mappings.map((mapping) => {
      if (mapping === 'ignore') {
        return mapping;
      }
      if (assigned.has(mapping)) {
        return 'ignore';
      }
      assigned.add(mapping);
      return mapping;
    });
  }

  private normalizeHeader(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private matchesAny(value: string, candidates: string[]): boolean {
    return candidates.some((candidate) => value.includes(candidate));
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
