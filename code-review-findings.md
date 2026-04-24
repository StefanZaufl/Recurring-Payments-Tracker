# Code Review Findings

## Findings

### P1 - Transaction DTO mapping now performs one link query per transaction - Fixed

`TransactionMapper.addLinkMetadata` calls `findWithRecurringPaymentByTransactionIdAndUserId` for every mapped transaction (`backend/src/main/java/com/tracker/controller/TransactionMapper.java:65-78`). The same pattern was added to `RecurringPaymentMapper.toTransactionDto` (`backend/src/main/java/com/tracker/controller/RecurringPaymentMapper.java:91-104`).

That turns ordinary transaction pages into 1 query for the page plus N extra link queries, and it is nastier in simulation responses because those return every matching transaction, not a paged slice. The additional-payment flow also calls `simulateRules` with empty rules to discover omitted Additional matches, so a user with many unlinked transactions can now pay for hundreds or thousands of extra link lookups just to open the create-payment screen. This needs to be batched, fetched via an entity graph/query keyed by transaction IDs, or made endpoint-specific instead of hiding database access in a mapper callback.

Resolution: link metadata enrichment now batches the lookup for all mapped transaction IDs via `TransactionLinkMetadataEnricher`.

### P2 - Removing the last rule from an Additional group can leave stale simulation UI - Fixed

In `AdditionalRuleGroupEditorComponent.setupSimulation`, the empty-rules branch clears the simulation and returns `EMPTY` (`frontend/src/app/features/recurring-payments/additional-rule-group-editor.component.ts:224-230`), but `clearSimulation` does not call `markForCheck` and mutates the existing `Set`/`Map` in place (`frontend/src/app/features/recurring-payments/additional-rule-group-editor.component.ts:389-397`). With `ChangeDetectionStrategy.OnPush`, deleting the final rule can leave the previous match count/highlights on screen until some unrelated change detection pass happens. Use new `Set`/`Map` instances and mark the component after clearing, or keep the stream emitting a cleared result that the subscription handles.

Resolution: clearing simulation state now replaces the `Set`/`Map` instances and marks the OnPush component for checking.

## Verification

- `npm --workspace=frontend run build` passed.
- `mvn -Dmaven.repo.local=/tmp/.m2 test` passed: 278 tests, 0 failures, 0 errors.
- `backend/runSonar.sh` passed.
- `frontend/runSonar.sh` passed.
- `tooling/query-sonar-issues.sh --new-code --fail-on-issues` passed: 0 issues.
