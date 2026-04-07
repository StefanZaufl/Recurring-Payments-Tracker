import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TransactionImportComponent } from './transaction-import.component';
import { TransactionsService } from '../../api/generated';
import { UploadResponse } from '../../api/generated/model/uploadResponse';

const mockUploadResponse: UploadResponse = {
  uploadId: 'upload-1',
  transactionCount: 2,
  skippedDuplicates: 1,
  recurringPaymentsDetected: 1
};

function createFileFromBytes(bytes: Uint8Array | Buffer, name = 'import.csv'): File {
  return new File([Uint8Array.from(bytes)], name, { type: 'text/csv' });
}

function createUtf16LeFile(contents: string, includeBom = true): File {
  const payload = Buffer.from(contents, 'utf16le');
  const bytes = includeBom ? Buffer.concat([Buffer.from([0xFF, 0xFE]), payload]) : payload;
  return createFileFromBytes(bytes);
}

describe('TransactionImportComponent', () => {
  let component: TransactionImportComponent;
  let fixture: ComponentFixture<TransactionImportComponent>;
  let transactionsService: jest.Mocked<TransactionsService>;

  beforeEach(async () => {
    const transactionsServiceMock = {
      uploadCsv: jest.fn().mockReturnValue(of(mockUploadResponse))
    };

    await TestBed.configureTestingModule({
      imports: [TransactionImportComponent],
      providers: [
        provideRouter([]),
        { provide: TransactionsService, useValue: transactionsServiceMock }
      ]
    }).compileComponents();

    transactionsService = TestBed.inject(TransactionsService) as jest.Mocked<TransactionsService>;
    fixture = TestBed.createComponent(TransactionImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates preview and auto-maps known headers', async () => {
    const file = new File([
      'Buchungsdatum;Partnername;Betrag;Buchungs-Details;Verwendungszweck\n' +
      '15.01.2025;Netflix;-12,99;;Abo\n'
    ], 'import.csv', { type: 'text/csv' });

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);
    fixture.detectChanges();

    expect(component.preview?.headers).toEqual([
      'Buchungsdatum',
      'Partnername',
      'Betrag',
      'Buchungs-Details',
      'Verwendungszweck'
    ]);
    expect(component.columnMappings).toEqual([
      'bookingDate',
      'partnerName',
      'amount',
      'details',
      'detailsFallback'
    ]);
    expect(component.mappingError).toBeNull();
    expect(component.selectedCharset).toBe('utf-8');
    expect(component.detectedCharset).toBe('utf-8');

    const selects = Array.from(fixture.nativeElement.querySelectorAll('select')) as HTMLSelectElement[];
    expect(selects[0]?.value).toBe('utf-8');
    expect(selects.slice(1).map((select) => select.value)).toEqual([
      'bookingDate',
      'partnerName',
      'amount',
      'details',
      'detailsFallback'
    ]);
  });

  it('detects utf-16le files and updates the charset dropdown', async () => {
    const file = createUtf16LeFile(
      'Buchungsdatum;Partnername;Betrag\n' +
      '15.01.2025;Netflix;-12,99\n'
    );

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);
    fixture.detectChanges();

    expect(component.selectedCharset).toBe('utf-16le');
    expect(component.detectedCharset).toBe('utf-16le');
    expect(component.preview?.headers).toEqual(['Buchungsdatum', 'Partnername', 'Betrag']);
    expect(fixture.nativeElement.textContent).toContain('UTF-16 LE');
  });

  it('shows mapping error while required fields are missing', async () => {
    const file = new File([
      'Date;Description\n' +
      '15.01.2025;Netflix\n'
    ], 'import.csv', { type: 'text/csv' });

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);

    expect(component.mappingError).toContain('amount');
    expect(component.canImport()).toBe(false);
  });

  it('recomputes preview on charset change and preserves mappings by column index', async () => {
    const file = createUtf16LeFile(
      'Buchungsdatum;Partnername;Betrag;Buchungs-Details\n' +
      '15.01.2025;Netflix;-12,99;Müller\n'
    );

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);
    component.onFieldMappingChange(3, 'detailsFallback');

    component.onCharsetChange('utf-8');
    expect(component.preview?.headers[0]).not.toBe('Buchungsdatum');
    expect(component.columnMappings[0]).toBe('bookingDate');
    expect(component.columnMappings[1]).toBe('partnerName');
    expect(component.columnMappings[2]).toBe('amount');
    expect(component.columnMappings[3]).toBe('detailsFallback');

    component.onCharsetChange('utf-16le');
    expect(component.preview?.headers).toEqual([
      'Buchungsdatum',
      'Partnername',
      'Betrag',
      'Buchungs-Details'
    ]);
    expect(component.columnMappings[3]).toBe('detailsFallback');
  });

  it('uploads file with mapping, details fallback, and charset header', async () => {
    const file = new File([
      'Buchungsdatum;Partnername;Betrag;Buchungs-Details;Verwendungszweck\n' +
      '15.01.2025;Netflix;-12,99;;Abo\n'
    ], 'import.csv', { type: 'text/csv' });

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);
    component.importTransactions();

    expect(transactionsService.uploadCsv).toHaveBeenCalledWith(
      file,
      JSON.stringify({
        bookingDate: 'Buchungsdatum',
        amount: 'Betrag',
        partnerName: 'Partnername',
        details: 'Buchungs-Details',
        detailsFallback: 'Verwendungszweck'
      }),
      'utf-8'
    );
  });

  it('keeps only one details fallback mapping selected', async () => {
    const file = new File([
      'Buchungsdatum;Partnername;Betrag;Memo;Reference\n' +
      '15.01.2025;Netflix;-12,99;Abo;Extra\n'
    ], 'import.csv', { type: 'text/csv' });

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);

    component.onFieldMappingChange(3, 'detailsFallback');
    expect(component.columnMappings[3]).toBe('detailsFallback');

    component.onFieldMappingChange(4, 'detailsFallback');
    expect(component.columnMappings[3]).toBe('ignore');
    expect(component.columnMappings[4]).toBe('detailsFallback');
  });

  it('includes account and partner iban mappings when selected', async () => {
    const file = new File([
      'Buchungsdatum;Auftragskonto;Partner IBAN;Betrag\n' +
      '15.01.2025;DE111;DE222;-12,99\n'
    ], 'import.csv', { type: 'text/csv' });

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);

    expect(component.columnMappings).toEqual([
      'bookingDate',
      'account',
      'partnerIban',
      'amount'
    ]);

    component.importTransactions();

    expect(transactionsService.uploadCsv).toHaveBeenCalledWith(
      file,
      JSON.stringify({
        bookingDate: 'Buchungsdatum',
        amount: 'Betrag',
        account: 'Auftragskonto',
        partnerIban: 'Partner IBAN'
      }),
      'utf-8'
    );
  });

  it('resets the form after a successful upload but keeps the success message visible', async () => {
    const file = new File([
      'Buchungsdatum;Betrag\n' +
      '15.01.2025;-12,99\n'
    ], 'import.csv', { type: 'text/csv' });

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);
    component.importTransactions();
    fixture.detectChanges();

    expect(component.uploadResult).toEqual(mockUploadResponse);
    expect(component.selectedFile).toBeNull();
    expect(component.selectedFileName).toBeNull();
    expect(component.preview).toBeNull();
    expect(component.columnMappings).toEqual([]);
    expect(component.selectedCharset).toBe('utf-8');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Imported 2 transactions');
  });

  it('shows backend upload errors', async () => {
    transactionsService.uploadCsv.mockReturnValue(
      throwError(() => ({ error: { message: 'Bad mapping' } }))
    );

    const file = new File([
      'Buchungsdatum;Betrag\n' +
      '15.01.2025;-12,99\n'
    ], 'import.csv', { type: 'text/csv' });

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);
    component.importTransactions();

    expect(component.uploadError).toBe('Bad mapping');
    expect(component.uploading).toBe(false);
    expect(component.preview).not.toBeNull();
  });
});
