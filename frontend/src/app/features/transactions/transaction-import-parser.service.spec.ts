import { TransactionImportParserService } from './transaction-import-parser.service';

describe('TransactionImportParserService', () => {
  let service: TransactionImportParserService;

  beforeEach(() => {
    service = new TransactionImportParserService();
  });

  it('builds a preview from semicolon-separated CSV text', () => {
    const preview = service.buildPreview('Date;Amount;Details\n2026-01-01;-12.99;"Netflix; monthly"\n');

    expect(preview.headers).toEqual(['Date', 'Amount', 'Details']);
    expect(preview.rows).toEqual([['2026-01-01', '-12.99', 'Netflix; monthly']]);
  });

  it('throws for unclosed quoted values', () => {
    expect(() => service.buildPreview('Date;Amount\n2026-01-01;"-12.99\n')).toThrow('unclosed quoted value');
  });

  it('detects utf-16le BOMs', () => {
    const bytes = Uint8Array.from([0xFF, 0xFE, 0x44, 0x00]).buffer;

    expect(service.detectCharset(bytes)).toEqual({ charset: 'utf-16le', confidence: 'high' });
  });

  it('suggests and deduplicates mappings', () => {
    expect(service.buildColumnMappings(['Buchungsdatum', 'Date', 'Betrag'], [])).toEqual([
      'bookingDate',
      'ignore',
      'amount',
    ]);
  });
});
