# UI Reuse Refactor Plan

This plan breaks the duplication and component-usage cleanup into reviewable phases. Each phase should be small enough to ship independently while moving the frontend toward reusable UI primitives.

## Phase 1: Rule UI Consolidation

Status: Complete.

Goal: make rule rendering and editing use one shared component path.

- Extended `RuleEditorComponent` so it can support both local draft rules and persisted rules.
- Kept shared rule helpers in the reusable rule editor path:
  - rule type labels
  - target field labels
  - rule summary formatting
  - rule form validation
- Refactored `PaymentRulesModalComponent` to reuse `RuleEditorComponent` instead of duplicating the rule list and form.
- Kept API-backed persistence in `PaymentRulesModalComponent`; kept rule UI concerns in `RuleEditorComponent`.
- Updated affected specs:
  - `rule-editor.component.spec.ts`
  - `payment-rules-modal.component.spec.ts`

Acceptance checks:

- Existing create-payment and additional-rule-group rule editing still behaves the same.
- Existing payment rules modal still supports load, add, edit, delete, and emits `paymentUpdated`.
- Sonar critical complexity finding for `payment-rules-modal.component.ts` should be resolved or reduced below threshold on the next Sonar run.

Verification:

- `npm --workspace=frontend test -- --runTestsByPath src/app/features/recurring-payments/rule-editor.component.spec.ts src/app/features/recurring-payments/payment-rules-modal.component.spec.ts --watch=false`
- `npm --workspace=frontend run build`

Notes:

- `RuleEditorComponent` now supports an unframed mode so it can render inside `ModalComponent` without nested card chrome.

## Phase 2: Confirmation Dialog Reuse

Status: Complete.

Goal: stop hand-rolling modal overlays for destructive confirmations.

- Added a shared `ConfirmDialogComponent` built on `ModalComponent`.
- Supports:
  - title
  - body content via projection
  - confirm/cancel labels
  - destructive confirm styling
  - disabled/loading confirm state
- Replaced inline delete dialogs in:
  - `recurring-payments-list.component.ts`
  - `additional-rule-group-editor.component.ts`
  - `configure.component.ts`
- Added escape close handling to `ModalComponent` so confirmation dialogs share the same shell behavior.

Acceptance checks:

- Delete payment, delete additional rule group, and configure confirmation flows still work.
- Repeated overlay markup is removed from feature components.
- Dialog behavior is covered by shared component tests plus one feature integration test per usage style.

Verification:

- `npm --workspace=frontend test -- --runTestsByPath src/app/shared/confirm-dialog.component.spec.ts src/app/features/configure/configure.component.spec.ts src/app/features/recurring-payments/recurring-payments-list.component.spec.ts --watch=false`
- `npm --workspace=frontend run build`

## Phase 3: Empty And Loading State Reuse

Status: Complete.

Goal: use existing state components consistently and fix the unused empty-state component before adopting it.

- Fixed `EmptyStateComponent` imports so `[ngClass]` works.
- Kept icons as projected content to preserve feature-specific icon choices.
- Replaced hand-coded empty states in:
  - `transactions.component.ts`
  - `recurring-payments-list.component.ts`
- Replaced local loading spinners where they match `LoadingSpinnerComponent`, especially:
  - `payment-rules-modal.component.ts`
  - `payment-transactions-modal.component.ts`
- Kept compact inline loading text where the shared spinner would be visually too heavy.

Acceptance checks:

- No visual regression for empty transaction/payment states.
- `EmptyStateComponent` has focused specs.
- Shared loading and empty states are used where layouts are equivalent.

Verification:

- `npm --workspace=frontend test -- --runTestsByPath src/app/shared/empty-state.component.spec.ts src/app/features/transactions/transactions.component.spec.ts src/app/features/recurring-payments/recurring-payments-list.component.spec.ts src/app/features/recurring-payments/payment-transactions-modal.component.spec.ts src/app/features/recurring-payments/payment-rules-modal.component.spec.ts --watch=false`
- `npm --workspace=frontend run build`

## Phase 4: Transaction Match Preview Component

Status: Complete.

Goal: consolidate duplicated transaction preview/list behavior used by rule-building flows.

- Created a reusable `TransactionMatchPreviewComponent` for the transaction list panel used by:
  - `CreatePaymentComponent`
  - `AdditionalRuleGroupEditorComponent`
- Inputs cover:
  - transactions to display
  - total transaction count
  - current page and total pages
  - loading state
  - simulation state
  - matching transaction IDs
  - match label text (`match`, `excluded`)
  - optional already-excluded group badges
  - optional linked-payment badges
- Outputs cover:
  - previous page
  - next page
  - matches-only toggle
- Kept page-specific data loading and simulation orchestration in the current feature components.

Acceptance checks:

- Create-payment and additional-rule-group screens render the same transaction data as before.
- Pagination and matches-only behavior stay unchanged.
- Duplicate transaction row/pagination markup is removed from both parent components.

Verification:

- `npm --workspace=frontend test -- --runTestsByPath src/app/features/recurring-payments/transaction-match-preview.component.spec.ts src/app/features/recurring-payments/create-payment.component.spec.ts src/app/features/recurring-payments/recurring-payments-list.component.spec.ts --watch=false`
- `npm --workspace=frontend run build`

## Phase 5: Transaction Import Decomposition

Goal: reduce `TransactionImportComponent` complexity and isolate CSV concerns from UI concerns.

- Extract CSV parsing and charset detection into a service or pure utility module:
  - byte decoding
  - charset scoring
  - CSV parsing
  - preview construction
  - header mapping suggestions
  - mapping deduplication
- Replace the invalid UTF-8 / mojibake regex at `transaction-import.component.ts:472` with a UTF-8-safe expression.
- Split UI into smaller components if still needed after service extraction:
  - file selection/status panel
  - charset selector
  - column mapping preview table
  - import result/error panel
- Keep upload orchestration in `TransactionImportComponent`.

Acceptance checks:

- Current CSV import specs still pass after moving logic.
- Add focused unit coverage for parser and charset detection edge cases.
- Sonar critical complexity finding for `parseCsv` is resolved or reduced below threshold.
- Sonar no longer warns about invalid UTF-8 content.

## Phase 6: Shared Form Controls And Badges

Goal: reduce repeated low-level Tailwind form/button/badge markup after the larger component splits are stable.

- Introduce small shared components/directives only where repetition is proven:
  - toggle switch
  - select field wrapper
  - text input wrapper
  - icon button
  - status badge variants
- Replace repeated `sr-only peer` toggle markup in recurring payment filters and rule preview panels.
- Keep global Tailwind classes such as `btn-primary`, `badge`, `table-header`, and `table-cell` where they remain sufficient.

Acceptance checks:

- New controls do not make simple templates harder to read.
- Repeated toggle/select/input styling is reduced in high-traffic feature components.
- Component APIs remain narrow and domain-neutral.

## Phase 7: Sonar Cleanup Pass

Goal: address quality findings that are not directly tied to UI reuse.

- Frontend:
  - mark injected readonly members as `readonly`
  - simplify nested ternary in `summary-card.component.ts`
  - clean minor readability issues reported by Sonar
- Backend:
  - fix duplicated literals called out by Sonar
  - remove unused imports/commented-out code
  - address constructor injection findings in mappers
  - review transactional self-invocation findings before changing behavior
- Run:
  - `./frontend/runSonar.sh` from `frontend/`
  - `./backend/runSonar.sh` from `backend/`
  - `tooling/query-sonar-issues.sh --new-code`
  - optionally `tooling/query-sonar-issues.sh --all` to measure total cleanup progress

Acceptance checks:

- New-code Sonar issues remain at zero.
- Any remaining all-code Sonar issues are intentional and documented if not fixed.

## Suggested Order

1. Phase 1: Rule UI Consolidation
2. Phase 2: Confirmation Dialog Reuse
3. Phase 3: Empty And Loading State Reuse
4. Phase 4: Transaction Match Preview Component
5. Phase 5: Transaction Import Decomposition
6. Phase 6: Shared Form Controls And Badges
7. Phase 7: Sonar Cleanup Pass

The first five phases target concrete duplication found in the current UI. Phase 6 should wait until those larger duplications are gone, so new shared controls are based on stable usage patterns rather than speculation.
