# Improvements Plan

This plan is based on the current Angular frontend and Spring backend implementation. The phases are ordered so small, isolated fixes land first, calculation semantics are clarified before wider recurring-payment changes, and prediction work builds on the recurring payment lifecycle data it needs.

## Phase 1: Transaction Page Filter Correctness and Layout - Complete

Completed:
- Added an explicit all-time URL state for transactions using `from=all&to=all`.
- Kept the default no-date-params route mapped to the current month.
- Ensured all-time transaction loading calls the API without date bounds and survives reload/share via query params.
- Moved account, transaction type, and sign filters behind a default-collapsed "More filters" section.
- Added automatic expansion and an active-filter count when advanced transaction filters are present.
- Added transaction component tests for default month loading, explicit all-time behavior, reload preservation, collapsed advanced filters, and active advanced filter expansion.
- Verified with `npm --workspace=frontend test -- --runTestsByPath src/app/features/transactions/transactions.component.spec.ts` and `npm --workspace=frontend run build`.

### 1. Fix "All time" date filtering

Current finding:
- `DateRangePickerComponent.clearRange()` emits `from: null` and `to: null`.
- `TransactionsComponent.parseUrlState()` replaces missing `from`/`to` query params with `getThisMonthDateRange()`.
- `TransactionsComponent.buildQueryParams()` also omits dates when they equal the default month, which makes "All time" indistinguishable from the default route state after navigation.

Planned change:
- Add an explicit URL representation for all-time filtering:`from`/`to`=`all`
- Update `parseUrlState()` so "no date params" remains the default current-month view only for first-load/default navigation, while the explicit all-time state stays `null/null`.
- Update transaction component tests to cover:
  - default route loads this month,
  - selecting "All time" calls the API with undefined date bounds,
  - reloading or sharing the all-time URL preserves all-time.

### 2. Collapse advanced transaction filters under "More filters"

Current finding:
- Date range, search, account, transaction type, transaction sign, and sorting all sit in one filter row.
- The requested advanced filters are account, transaction type, and sign.

Planned change:
- Keep date range, search, and sorting visible.
- Move account, transaction type, and sign selectors into a default-collapsed "More filters" region.
- Auto-expand the region when any advanced filter is active so users can see applied filters after URL navigation.
- Add a small active-filter indicator/count on the "More filters" toggle.
- Update responsive layout and tests for the collapsed default state and active-filter expanded state.

## Phase 2: Dashboard Year-Scoped Data Consistency - Complete

Completed:
- Extended the recurring payment history endpoint with optional `from` and `to` query parameters.
- Filtered payment period history by period overlap, so periods crossing a selected year boundary are included.
- Updated the dashboard to request history for the selected year and regenerated the Angular API client.
- Reworked recurring summary monthly amounts to use observed selected-year coverage instead of always dividing selected-year totals by 12.
- Kept `annualAmount` as the actual selected-year linked-transaction total and made `monthlyAmount` the observed monthly average for that coverage.
- Added backend controller/service tests for year-filtered history and analytics tests for mid-year starts, partial selected-year coverage, quarterly period coverage, and no-link/no-year exclusions.
- Added frontend dashboard test expectations for selected-year history parameters.
- Verified with focused backend tests, full backend tests, dashboard frontend tests, frontend build, backend Sonar, frontend Sonar, and `tooling/query-sonar-issues.sh` reporting zero new-code issues.

### 3. Filter recurring payment amount history by selected year

Current finding:
- `DashboardComponent.loadHistory()` calls `getRecurringPaymentHistory(paymentId)` with no year or date range.
- `PaymentPeriodHistoryService.getHistory()` returns all history for that payment.
- The dashboard year selector therefore changes summary data but not the expanded history chart.

Planned change:
- Extend the recurring payment history API to accept `from` and `to`.
- Filter `PaymentPeriodHistory` by period overlap with the selected year, not only by period start, so quarterly/yearly periods that overlap the year are included correctly.
- Update `DashboardComponent.loadHistory()` to pass the selected year range.
- Regenerate the frontend API client after OpenAPI changes.
- Add controller/service tests for year-filtered history and frontend tests for passing the selected year.

### 4. Rework dashboard "monthly" calculations around observed transaction coverage

Current finding:
- `AnalyticsService.toRecurringSummary()` always divides an annual linked-transaction total by 12.
- The requested behavior is to base monthly calculations on the overlap of the selected year and the timeframe where transactions exist for that item.
- This affects recurring summary monthly amounts most directly, and may also affect category/recurring annual projections if those currently imply a full-year normalized value.

Planned change:
- For each recurring payment, compute the observed linked transaction timeframe:
  - earliest linked transaction date,
  - latest linked transaction date,
  - overlap with the selected year.
- Define a single shared helper for overlap duration by frequency/month-equivalent:
  - monthly items use covered months in the overlap,
  - quarterly/yearly items use period overlap semantics consistent with `PaymentPeriodHistoryService`,
  - protect against zero-length overlaps.
- Replace `annualAmount / 12` with `amountInOverlap / coveredMonthEquivalent`.
- Confirm display naming: keep `annualAmount` as actual selected-year total, and make `monthlyAmount` the observed monthly average for the selected-year overlap.
- Add analytics service tests for:
  - payment starts mid-year,
  - payment ends before year end,
  - selected year partially overlaps the user's imported transaction range,
  - no overlap produces no summary entry.

## Phase 3: Rule Mutation Recalculation Semantics - Complete

Completed:
- Added targeted recurring-payment link recalculation after standalone rule create, update, and delete operations.
- The targeted recalculation evaluates current rules against existing linked transactions plus eligible unlinked lookback transactions.
- It removes stale links, adds newly matching links, recomputes frequency, average amount, income flag, rolling history, and persists the payment.
- If no transactions match after a user-driven rule edit, the payment is retained, marked inactive, assigned a zero average, and its history is recomputed instead of deleting it.
- Grouped payment rule mutations continue to use the broader user recalculation path.
- Recurring payment creation with inline rules now attaches rules without per-rule recalculation, then keeps the existing create-time re-evaluation flow after all rules exist.
- Added unit/controller coverage for targeted stale-link removal, newly matching links, no-match retention, rule mutation recalculation, grouped broad recalculation, and inline-rule payment creation.
- Verified with `mvn -Dmaven.repo.local=/tmp/.m2 test -Dtest=RecurringPaymentControllerTest,RuleServiceTest,RecurringPaymentRecalculationServiceTest`, `backend/runSonar.sh`, `frontend/runSonar.sh`, and `tooling/query-sonar-issues.sh` reporting zero new-code issues.

### 5. Full recalculation after recurring payment rule changes

Current finding:
- `RuleService.createRule()`, `updateRule()`, and `deleteRule()` mutate rules only.
- `RecurringPaymentDetectionService.reEvaluateRecurringPayment()` only adds new links from unlinked transactions and never removes existing links.
- `RecurringPaymentRecalculationService.recalculateCurrentUserRecurringPayments()` can rebuild all payments, but rule mutations do not use a targeted full rebuild.

Planned change:
- Add a targeted recalculation method for one recurring payment/group that:
  - loads existing linked transactions for the payment,
  - loads eligible unlinked transactions in the lookback window,
  - evaluates the current rules against both sets,
  - removes links that no longer match,
  - adds newly matching unlinked transactions,
  - recomputes frequency, average amount, income flag, and period history.
- Call this targeted recalculation from `RuleService` after create/update/delete.
- For grouped/additional rule changes, keep using the broader recalculation path where exclusions can affect multiple payments.
- Decide deletion semantics explicitly:
  - if no transactions match after a rule edit, keep the recurring payment with zero links and inactive/needs-attention status, rather than silently deleting it during a user-driven rule edit.
- Add tests for rule create/update/delete that prove stale links are removed and new matches are added.

## Phase 4: Recurring Payment Lifecycle and Cancellation Detection

### 6. Add start/end dates to recurring payments

Current finding:
- `RecurringPayment` has no start or end date.
- Predictions assume every active recurring payment continues indefinitely from its last linked transaction.

Planned change:
- Add `start_date` and `end_date` columns through a Flyway migration.
- Populate `start_date` from the earliest linked transaction during detection/recalculation.
- Allow users to edit start/end dates in the recurring payment UI.
- Keep `isActive` as a user-controlled flag, but make `end_date` the temporal boundary for summaries and predictions.
- Update DTOs, OpenAPI, generated frontend client, mapper, and tests.

### 7. Detect recurring payments that no longer match transactions

Current finding:
- Existing recalculation can delete payments when no matches are found in the lookback, but there is no explicit "canceled/stale" detection state.
- Predictions continue if a payment is active and has links.

Planned change:
- Add a stale detection pass whenever new transactions get added that compares the expected next occurrence date to the latest matching transaction. The last imported transaction for that user is the reference date.
- Mark a payment as stale/ended when it is overdue by a configurable grace period based on frequency:
  - monthly: expected date plus a monthly grace window,
  - quarterly/yearly: larger grace windows.
- Set or suggest `end_date` based on the last matched transaction or the missed expected period.
- Expose stale/ended status in the recurring payments list so the user can confirm or override.
- Ensure recalculation does not delete ended/stale recurring payments.
- Add tests for active, overdue, manually ended, and reactivated payments.

## Phase 5: Prediction Improvements

### 8. Respect recurring payment start/end dates in predictions

Current finding:
- `AnalyticsService.getPredictions()` includes every active payment in every predicted month.
- Upcoming dates are generated from the last linked transaction and frequency, without start/end boundaries.

Planned change:
- Exclude predicted occurrences outside `start_date`/`end_date`.
- Stop upcoming individual payment generation at `end_date`.
- For monthly prediction totals, include only payments active during that prediction month.
- Add tests for future starts, ended subscriptions, and payments ending within the prediction window.

### 9. Forecast additional payments from the last three months

Current finding:
- Predictions only include recurring payments.
- Additional/non-recurring transaction trends are not modeled.

Planned change:
- Identify additional payments using the existing `TransactionTypeFilter.ADDITIONAL` semantics
- Build a three-month rolling baseline split by income and expenses.
- Forecast upcoming additional payments as monthly expected income/expense adjustments.
- Start with a simple average over the last three complete months; consider a weighted trend only after tests confirm the desired behavior.
- Add the additional forecast to `MonthlyPredictionResult` as separate fields
- Update predictions UI to show recurring vs additional components clearly.
- Add tests for:
  - exactly three months of additional transactions,
  - fewer than three months available,
  - current partial month exclusion,
  - positive and negative additional transactions.

## Cross-Cutting Work

- Update `api/openapi.yaml` before regenerating the Angular client for any API contract changes.
- Run all backend tests after each backend phase.
- Run all frontend tests after a phase touching the frontend has ended.
- Before committing non-trivial changes, run `backend/runSonar.sh`, `frontend/runSonar.sh`, then `tooling/query-sonar-issues.sh` and address findings.
