package com.tracker.controller;

import com.tracker.api.AnalyticsApi;
import com.tracker.api.model.*;
import com.tracker.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class AnalyticsController implements AnalyticsApi {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @Override
    public ResponseEntity<AnnualOverview> getAnnualOverview(Integer year) {
        AnalyticsService.AnnualOverviewResult result = analyticsService.getAnnualOverview(year);

        AnnualOverview overview = new AnnualOverview();
        overview.setTotalIncome(result.totalIncome().doubleValue());
        overview.setTotalExpenses(result.totalExpenses().doubleValue());
        overview.setTotalRecurringIncome(result.totalRecurringIncome().doubleValue());
        overview.setTotalRecurringExpenses(result.totalRecurringExpenses().doubleValue());

        List<MonthlyBreakdown> monthlyBreakdown = result.monthlyBreakdown().stream()
                .map(mb -> {
                    MonthlyBreakdown dto = new MonthlyBreakdown();
                    dto.setMonth(mb.month());
                    dto.setIncome(mb.income().doubleValue());
                    dto.setExpenses(mb.expenses().doubleValue());
                    dto.setSurplus(mb.surplus().doubleValue());
                    dto.setRecurringExpenses(mb.recurringExpenses().doubleValue());
                    return dto;
                })
                .toList();
        overview.setMonthlyBreakdown(monthlyBreakdown);

        List<CategoryBreakdown> byCategory = result.byCategory().stream()
                .map(cb -> {
                    CategoryBreakdown dto = new CategoryBreakdown();
                    dto.setCategoryId(cb.categoryId());
                    dto.setCategory(cb.category());
                    dto.setTotal(cb.total().doubleValue());
                    dto.setPercentage(cb.percentage());
                    dto.setColor(cb.color());
                    return dto;
                })
                .toList();
        overview.setByCategory(byCategory);

        List<RecurringPaymentSummary> recurringExpenses = result.recurringExpenses().stream()
                .map(this::toRecurringPaymentSummary)
                .toList();
        overview.setRecurringExpenses(recurringExpenses);

        List<RecurringPaymentSummary> recurringIncome = result.recurringIncome().stream()
                .map(this::toRecurringPaymentSummary)
                .toList();
        overview.setRecurringIncome(recurringIncome);

        return ResponseEntity.ok(overview);
    }

    @Override
    public ResponseEntity<PredictionResponse> getPredictions(Integer months) {
        AnalyticsService.PredictionResult result = analyticsService.getPredictions(months != null ? months : 6);

        PredictionResponse response = new PredictionResponse();

        List<MonthlyPrediction> predictions = result.predictions().stream()
                .map(mp -> {
                    MonthlyPrediction dto = new MonthlyPrediction();
                    dto.setMonth(mp.month());
                    dto.setExpectedIncome(mp.expectedIncome().doubleValue());
                    dto.setExpectedExpenses(mp.expectedExpenses().doubleValue());
                    dto.setExpectedSurplus(mp.expectedSurplus().doubleValue());
                    dto.setRecurringIncome(mp.recurringIncome().doubleValue());
                    dto.setRecurringExpenses(mp.recurringExpenses().doubleValue());
                    dto.setAdditionalIncome(mp.additionalIncome().doubleValue());
                    dto.setAdditionalExpenses(mp.additionalExpenses().doubleValue());
                    return dto;
                })
                .toList();
        response.setPredictions(predictions);

        List<UpcomingPayment> upcoming = result.upcomingPayments().stream()
                .map(up -> {
                    UpcomingPayment dto = new UpcomingPayment();
                    dto.setName(up.name());
                    dto.setDate(up.date().toString());
                    dto.setAmount(up.amount().doubleValue());
                    return dto;
                })
                .toList();
        response.setUpcomingPayments(upcoming);

        return ResponseEntity.ok(response);
    }

    private RecurringPaymentSummary toRecurringPaymentSummary(AnalyticsService.RecurringPaymentSummaryResult recurringPayment) {
        RecurringPaymentSummary dto = new RecurringPaymentSummary();
        dto.setId(recurringPayment.id());
        dto.setName(recurringPayment.name());
        dto.setMonthlyAmount(recurringPayment.monthlyAmount().doubleValue());
        dto.setAnnualAmount(recurringPayment.annualAmount().doubleValue());
        dto.setCategory(recurringPayment.category());
        return dto;
    }
}
