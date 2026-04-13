# Phase 5 Plan

## Goal

Reduce maintenance burden in the configure screen by separating the category and bank-account CRUD flows into dedicated frontend components.

## Recommended Approach

Implement Phase 5 as a component split, not as a generic CRUD abstraction.

The current `ConfigureComponent` contains two independent state machines that only partially overlap:

- Categories use a shared create component and support color editing.
- Bank accounts use inline create UI, sort newly created items, and only edit the account name.
- Both areas have different loading, saving, deleting, validation, and error behaviors.

Because of that, extracting child components is a better fit than forcing both flows through a shared CRUD helper.

## Target Component Structure

Keep `frontend/src/app/features/configure/configure.component.ts` as a page shell only.

Extract:

- `configure-categories-section.component.ts`
- `configure-bank-accounts-section.component.ts`

The parent component should only render:

- page heading
- supporting copy
- categories section component
- bank accounts section component

## Categories Section Scope

Move the categories template and category-specific state/behavior into `configure-categories-section.component.ts`.

This child should own:

- `categories`
- `categoriesLoading`
- `categoriesError`
- `editingId`
- `editName`
- `editColor`
- `savingEdit`
- `editError`
- `deletingId`
- `deleteError`

This child should implement:

- `loadCategories()`
- `onCategoryCreated()`
- `startEdit()`
- `cancelEdit()`
- `saveEdit()`
- `deleteCategory()`

It should continue to use:

- `CategoriesService`
- `CategoryCreateComponent`
- `LoadingSpinnerComponent`
- `ErrorStateComponent`

## Bank Accounts Section Scope

Move the bank-account template and bank-account-specific state/behavior into `configure-bank-accounts-section.component.ts`.

This child should own:

- `bankAccounts`
- `bankAccountsLoading`
- `bankAccountsError`
- `newBankAccountIban`
- `newBankAccountName`
- `creatingBankAccount`
- `createBankAccountError`
- `editingBankAccountId`
- `editBankAccountName`
- `savingBankAccountEdit`
- `bankAccountEditError`
- `deletingBankAccountId`
- `deleteBankAccountError`

This child should implement:

- `loadBankAccounts()`
- `createBankAccount()`
- `startBankAccountEdit()`
- `cancelBankAccountEdit()`
- `saveBankAccountEdit()`
- `deleteBankAccount()`

It should continue to use `BankAccountsService` and preserve the current sorted insert behavior after create.

## Design Constraints

- Preserve the existing UX and visible behavior.
- Keep `OnPush` change detection semantics intact.
- Keep service calls inside the child components rather than moving the state machines into the parent.
- Do not replace the current behavior with a generic shared state helper unless the implementation turns out materially simpler after extraction.

## Test Plan

Split the current frontend coverage so tests follow the new ownership boundaries.

Create or update tests for:

- parent `ConfigureComponent`: page composition only
- categories section: load, empty state, retry, create callback append, edit success/failure, delete success/failure
- bank accounts section: load, empty state, create success/failure, edit success/failure, delete success/failure

Preserve all existing behavior currently covered in `frontend/src/app/features/configure/configure.component.spec.ts`, and add missing failure-state coverage for bank-account CRUD.

## Suggested Implementation Steps

1. Extract the categories section into its own standalone component.
2. Extract the bank accounts section into its own standalone component.
3. Simplify `ConfigureComponent` into a page-shell component.
4. Split and update the frontend tests to match the new component boundaries.
5. Run the configure-related frontend tests and fix any `OnPush` rendering regressions.

## Acceptance Criteria

- `ConfigureComponent` no longer owns both CRUD state machines.
- Categories and bank accounts each have a dedicated child component.
- Existing behavior and error handling are preserved.
- Frontend tests cover both extracted flows.
- The configure screen remains functionally unchanged from a user perspective.
