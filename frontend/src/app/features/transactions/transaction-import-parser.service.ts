import { Injectable } from '@angular/core';

export type ExpectedField = 'ignore' | 'bookingDate' | 'amount' | 'account' | 'partnerName' | 'partnerIban' | 'details' | 'detailsFallback';
export type SupportedCharset = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252' | 'iso-8859-1' | 'iso-8859-15';

export interface CsvPreview {
  headers: string[];
  rows: string[][];
}

export interface CharsetOption {
  value: SupportedCharset;
  label: string;
}

export interface CharsetDetectionResult {
  charset: SupportedCharset;
  confidence: 'high' | 'low';
}

interface DecodedCsvCandidate {
  preview: CsvPreview;
  score: number;
}

interface CsvParserState {
  rows: string[][];
  currentRow: string[];
  currentCell: string;
  inQuotes: boolean;
}

export const CHARSET_OPTIONS: CharsetOption[] = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
  { value: 'windows-1252', label: 'Windows-1252' },
  { value: 'iso-8859-1', label: 'ISO-8859-1' },
  { value: 'iso-8859-15', label: 'ISO-8859-15' }
];

@Injectable({ providedIn: 'root' })
export class TransactionImportParserService {
  readonly charsetOptions = CHARSET_OPTIONS;

  async readFileBytes(file: File): Promise<ArrayBuffer> {
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

  decodeFileBytes(bytes: ArrayBuffer, charset: SupportedCharset): string {
    try {
      return new TextDecoder(charset, { fatal: false }).decode(bytes);
    } catch {
      throw new Error(`The browser could not decode this file as ${charset}.`);
    }
  }

  detectCharset(bytes: ArrayBuffer): CharsetDetectionResult {
    const bomCharset = this.detectBomCharset(bytes);
    if (bomCharset) {
      return { charset: bomCharset, confidence: 'high' };
    }

    const candidates = this.charsetOptions
      .map((option) => ({ charset: option.value, candidate: this.scoreDecodedCandidate(bytes, option.value) }))
      .filter((entry): entry is { charset: SupportedCharset; candidate: DecodedCsvCandidate } => entry.candidate !== null)
      .sort((left, right) => right.candidate.score - left.candidate.score);

    const best = candidates[0];
    return !best || best.candidate.score < 45
      ? { charset: 'utf-8', confidence: 'low' }
      : { charset: best.charset, confidence: 'high' };
  }

  buildPreview(text: string): CsvPreview {
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

  buildColumnMappings(headers: string[], previousMappings: ExpectedField[]): ExpectedField[] {
    const suggestedMappings = headers.map((header, index) => previousMappings[index] ?? this.suggestField(header));
    return this.deduplicateMappings(suggestedMappings);
  }

  private detectBomCharset(bytes: ArrayBuffer): SupportedCharset | null {
    const byteView = new Uint8Array(bytes);
    if (byteView.length >= 3 && byteView[0] === 0xEF && byteView[1] === 0xBB && byteView[2] === 0xBF) {
      return 'utf-8';
    }
    if (byteView.length >= 2 && byteView[0] === 0xFF && byteView[1] === 0xFE) {
      return 'utf-16le';
    }
    if (byteView.length >= 2 && byteView[0] === 0xFE && byteView[1] === 0xFF) {
      return 'utf-16be';
    }
    return null;
  }

  private scoreDecodedCandidate(bytes: ArrayBuffer, charset: SupportedCharset): DecodedCsvCandidate | null {
    try {
      const text = this.decodeFileBytes(bytes, charset);
      const preview = this.buildPreview(text);
      const headers = preview.headers.join(';');
      const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
      const nullCount = text.split('\u0000').length - 1;
      const mojibakeCount = (text.match(/[ÃÂ¤\uFFFD]/g) ?? []).length;
      const recognizedHeaders = preview.headers.filter((header) => this.suggestField(header) !== 'ignore').length;
      const semicolonCount = (text.match(/;/g) ?? []).length;

      let score = 50;
      score += Math.min(recognizedHeaders * 15, 45);
      score += Math.min(semicolonCount, 20);
      score -= replacementCount * 30;
      score -= nullCount * 2;
      score -= mojibakeCount * 8;
      return headers.length === 0 ? { preview, score: score - 20 } : { preview, score };
    } catch {
      return null;
    }
  }

  private parseCsv(text: string): string[][] {
    const state: CsvParserState = { rows: [], currentRow: [], currentCell: '', inQuotes: false };

    for (let index = 0; index < text.length; index += 1) {
      const nextIndex = this.consumeCharacter(text, index, state);
      index = nextIndex;
    }

    if (state.inQuotes) {
      throw new Error('The CSV contains an unclosed quoted value.');
    }
    this.flushFinalRow(state);
    return state.rows;
  }

  private consumeCharacter(text: string, index: number, state: CsvParserState): number {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      return this.consumeQuote(index, nextChar, state);
    }
    if (char === ';' && !state.inQuotes) {
      this.flushCell(state);
      return index;
    }
    if ((char === '\n' || char === '\r') && !state.inQuotes) {
      this.flushRow(state);
      return char === '\r' && nextChar === '\n' ? index + 1 : index;
    }

    state.currentCell += char;
    return index;
  }

  private consumeQuote(index: number, nextChar: string | undefined, state: CsvParserState): number {
    if (state.inQuotes && nextChar === '"') {
      state.currentCell += '"';
      return index + 1;
    }
    state.inQuotes = !state.inQuotes;
    return index;
  }

  private flushCell(state: CsvParserState): void {
    state.currentRow.push(state.currentCell.trim());
    state.currentCell = '';
  }

  private flushRow(state: CsvParserState): void {
    this.flushCell(state);
    if (state.currentRow.some((cell) => cell !== '')) {
      state.rows.push(state.currentRow);
    }
    state.currentRow = [];
  }

  private flushFinalRow(state: CsvParserState): void {
    if (state.currentCell.length === 0 && state.currentRow.length === 0) {
      return;
    }
    this.flushCell(state);
    if (state.currentRow.some((cell) => cell !== '')) {
      state.rows.push(state.currentRow);
    }
  }

  private stripBom(value: string): string {
    return value.replace(/^\uFEFF/, '');
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
    return mappings.map((mapping) => this.deduplicateMapping(mapping, assigned));
  }

  private deduplicateMapping(mapping: ExpectedField, assigned: Set<Exclude<ExpectedField, 'ignore'>>): ExpectedField {
    if (mapping === 'ignore') {
      return mapping;
    }
    if (assigned.has(mapping)) {
      return 'ignore';
    }
    assigned.add(mapping);
    return mapping;
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
}
