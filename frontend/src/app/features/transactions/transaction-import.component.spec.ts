import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TransactionImportComponent } from './transaction-import.component';
import { TransactionsService } from '../../api/generated';
import { UploadResponse } from '../../api/generated/model/uploadResponse';

const mockUploadResponse: UploadResponse = {
  uploadId: 'upload-1',
  transactionCount: 2,
  recurringPaymentsDetected: 1
};

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
      'ignore'
    ]);
    expect(component.detailsFallbackIndex).toBe(4);
    expect(component.mappingError).toBeNull();
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

  it('uploads file with mapping and details fallback', async () => {
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
      })
    );
    expect(component.uploadResult).toEqual(mockUploadResponse);
  });

  it('keeps only one fallback column selected', async () => {
    const file = new File([
      'Buchungsdatum;Partnername;Betrag;Memo;Reference\n' +
      '15.01.2025;Netflix;-12,99;Abo;Extra\n'
    ], 'import.csv', { type: 'text/csv' });

    await component.onFileSelected({ target: { files: [file], value: 'x' } } as unknown as Event);

    component.onDetailsFallbackChange(1, 'fallback');
    expect(component.detailsFallbackIndex).toBe(1);

    component.onDetailsFallbackChange(4, 'fallback');
    expect(component.detailsFallbackIndex).toBe(4);
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
  });
});
