import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Transaction, TransactionPage, UploadResponse } from '../../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  constructor(private api: ApiService) {}

  uploadCsv(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.http.post<UploadResponse>(`${this.api.baseUrl}/transactions/csv`, formData);
  }

  getTransactions(params: {
    from?: string;
    to?: string;
    text?: string;
    page?: number;
    size?: number;
  }): Observable<TransactionPage> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.text) httpParams = httpParams.set('text', params.text);
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    return this.api.http.get<TransactionPage>(`${this.api.baseUrl}/transactions`, { params: httpParams });
  }

  getTransaction(id: string): Observable<Transaction> {
    return this.api.http.get<Transaction>(`${this.api.baseUrl}/transactions/${id}`);
  }
}
