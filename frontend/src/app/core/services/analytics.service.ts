import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AnnualOverview, PredictionResponse } from '../../models/analytics.model';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private api: ApiService) {}

  getAnnualOverview(year: number): Observable<AnnualOverview> {
    const params = new HttpParams().set('year', year.toString());
    return this.api.http.get<AnnualOverview>(`${this.api.baseUrl}/analytics/annual-overview`, { params });
  }

  getPredictions(months: number = 6): Observable<PredictionResponse> {
    const params = new HttpParams().set('months', months.toString());
    return this.api.http.get<PredictionResponse>(`${this.api.baseUrl}/analytics/predictions`, { params });
  }
}
