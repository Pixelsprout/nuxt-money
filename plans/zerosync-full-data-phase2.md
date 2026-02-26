# ZeroSync Integration - Phase 2: Full Data Sync

## Progress

| Step | Status |
|------|--------|
| 1 — Expand drizzle-zero Config | ✅ Done |
| 2 — Define Queries | ✅ Done |
| 3 — Define Mutators | ✅ Done |
| 4 — Implement Mutate Endpoint | ✅ Done |
| 5 — Update Plugin and Composable | ✅ Done |
| 6 — Create Budget Progress Composable | ✅ Done |
| 7 — Create Category Averages Composable | ✅ Done |
| 8 — Migrate UI — Categories Pages | ✅ Done |
| 9 — Migrate UI — Transaction Display | ✅ Done |
| 10 — Migrate UI — Budgets Pages | ✅ Done |
| 11 — Migrate UI — Budget Wizard | ✅ Done |
| 12 — Deprecate Replaced Server API Routes | ⬜ Not started |

---

## Context

Phase 1 synced only the `akahuAccount` table to Zero as a proof-of-concept. All other data (transactions, categories, budgets) still loads via `useFetch` → server API routes → Postgres on every page load. Phase 2 extends Zero sync to all user-facing tables, enabling instant local data access and introducing Zero mutators for write operations. This eliminates most server API routes in favor of Zero's client-server mutation pattern with optimistic UI updates.

---

## Step 1: Expand drizzle-zero Config ✅

**File:** `config/drizzle-zero.config.ts`

Add all 9 remaining tables to the config with all fields enabled:

- `transactionCategory` — all fields (id, userId, name, color, description, timestamps)
- `transactionReference` — all fields (id, userId, merchant, description, fromAccount, categoryId, amountCondition, timestamps)
- `akahuTransaction` — all fields (id, userId, accountId, akahuId, date, description, amount, balance, type, category, merchant, categoryId, meta, timestamps)
- `budget` — all fields (id, userId, name, period, periodStart, periodEnd, status, timestamps)
- `budgetIncome` — all fields (id, budgetId, userId, name, amount, frequency, notes, referenceDatePayday, adjustForWeekends, nextPaydayDate, expectedFromAccount, autoTagEnabled, timestamps)
- `budgetIncomeTransaction` — all fields (id, incomeId, transactionId, fromAccount, linkedAt, autoTagged)
- `fixedExpense` — all fields (id, budgetId, userId, categoryId, name, description, amount, frequency, matchPattern, nextDueDate, timestamps)
- `fixedExpenseTransaction` — all fields (id, fixedExpenseId, transactionId, linkedAt, autoTagged)
- `categoryAllocation` — all fields (id, budgetId, categoryId, allocatedAmount, notes, timestamps)

Then regenerate with `pnpm zero:generate`. This produces the updated `app/db/zero-schema.gen.ts`.

---

## Step 2: Define Queries ✅

**File:** `app/db/zero-queries.ts`

Extend the existing queries object with entries for all new tables. Each query filters by `ctx.userID` for security:

```
categories:
  list()              → transactionCategory.where("userId", ctx.userID).orderBy("name", "asc")

transactionReferences:
  list()              → transactionReference.where("userId", ctx.userID)

transactions:
  byAccount(accountId) → akahuTransaction.where("userId", ctx.userID).where("accountId", accountId).orderBy("date", "desc")
  all()               → akahuTransaction.where("userId", ctx.userID).orderBy("date", "desc")
  byCategory(catId)   → akahuTransaction.where("userId", ctx.userID).where("categoryId", catId).orderBy("date", "desc")

budgets:
  list()              → budget.where("userId", ctx.userID).orderBy("createdAt", "desc")
  byId(id)            → budget.where("userId", ctx.userID).where("id", id)

budgetIncome:
  byBudget(budgetId)  → budgetIncome.where("budgetId", budgetId).where("userId", ctx.userID)

fixedExpenses:
  byBudget(budgetId)  → fixedExpense.where("budgetId", budgetId).where("userId", ctx.userID)

categoryAllocations:
  byBudget(budgetId)  → categoryAllocation.where("budgetId", budgetId)

budgetIncomeTransactions:
  byIncome(incomeId)  → budgetIncomeTransaction.where("incomeId", incomeId)

fixedExpenseTransactions:
  byExpense(expenseId) → fixedExpenseTransaction.where("fixedExpenseId", expenseId)
```

The query endpoint (`server/api/zero/query.post.ts`) needs no changes — it already handles any registered query via `mustGetQuery`.

---

## Step 3: Define Mutators ✅

**File:** `app/db/zero-mutators.ts` (NEW)

Create shared mutator definitions using `defineMutator` and `defineMutators` from `@rocicorp/zero`. Each mutator uses Zod for input validation. IDs are generated client-side with `nanoid`.

### Category Mutators
- **`categories.create`** — inserts into `transactionCategory` with {id, userId, name, color, description, timestamps}
- **`categories.update`** — updates `transactionCategory` by id with partial {name, color, description, updatedAt}
- **`categories.delete`** — deletes `transactionCategory` by id. Server-side implementation also sets `categoryId = null` on affected transactions (matching current API behavior in `server/api/categories/[id].delete.ts`)

### Transaction Mutators
- **`transactions.assignCategory`** — updates `akahuTransaction.categoryId` AND upserts a `transactionReference` (matching the current side-effect in `server/api/transactions/[id]/category.patch.ts` which calls `upsertTransactionReference`). This is an atomic operation — both writes happen in the same mutator.

### Transaction Reference Mutators
- **`transactionReferences.upsert`** — inserts or updates a transaction reference
- **`transactionReferences.delete`** — deletes a transaction reference

### Budget Mutators
- **`budgets.create`** — inserts into `budget` with {id, userId, name, period, periodStart, periodEnd, status, timestamps}
- **`budgets.update`** — partial update on `budget` (name, period, dates, status)
- **`budgets.delete`** — deletes `budget` by id (cascade handles children)

### Budget Income Mutators
- **`budgetIncome.create`** — inserts into `budgetIncome`
- **`budgetIncome.update`** — partial update
- **`budgetIncome.delete`** — delete by id

### Fixed Expense Mutators
- **`fixedExpenses.create`** — inserts into `fixedExpense`
- **`fixedExpenses.update`** — partial update
- **`fixedExpenses.delete`** — delete by id

### Category Allocation Mutators
- **`allocations.create`** — inserts into `categoryAllocation`. Server-side validates no duplicate (same category + budget).
- **`allocations.update`** — partial update (allocatedAmount, notes)
- **`allocations.delete`** — delete by id

### Budget Transaction Linking Mutators
- **`budgetIncomeTransactions.link`** — inserts into `budgetIncomeTransaction`
- **`budgetIncomeTransactions.unlink`** — deletes from `budgetIncomeTransaction`
- **`fixedExpenseTransactions.link`** — inserts into `fixedExpenseTransaction`
- **`fixedExpenseTransactions.unlink`** — deletes from `fixedExpenseTransaction`

---

## Step 4: Implement Mutate Endpoint ✅

**File:** `server/api/zero/mutate.post.ts`

Replace the empty response with a real handler using `handleMutateRequest` and `mustGetMutator` from `@rocicorp/zero/server`. Pattern mirrors the existing query endpoint:

1. Validate session (same auth check as query endpoint)
2. Call `handleMutateRequest` with a resolver function that:
   - Looks up the mutator via `mustGetMutator(mutators, name)`
   - Executes `mutator.fn({ args, ctx: { userID } })`
3. Return the response

Server-side mutator implementations add ownership validation (e.g., verify user owns the budget before allowing update) that the client-side optimistic versions skip.

---

## Step 5: Update Plugin and Composable ✅

**File:** `app/plugins/zero.client.ts`

Import mutators and pass them to the `Zero` constructor:

```typescript
import { mutators } from "~/db/zero-mutators";

const z = new Zero({
  userID,
  server: config.public.zeroServer,
  schema,
  mutators,
  kvStore: "idb",
  context: { userID },
});
```

**File:** `app/composables/useZero.ts`

Update the type from `Zero<Schema, undefined, ZeroContext>` to `Zero<Schema, typeof mutators, ZeroContext>` so that `z.mutate.*` is properly typed.

---

## Step 6: Create Budget Progress Composable ✅

**File:** `app/composables/useBudgetProgress.ts` (NEW)

Port the computation logic from `server/api/budgets/[id]/progress.get.ts` to a client-side composable that reads from Zero queries.

Inputs: `budgetId`
Queries used: `budgets.byId`, `budgetIncome.byBudget`, `fixedExpenses.byBudget`, `categoryAllocations.byBudget`, `transactions.all` (filtered by date range client-side)

Computes reactively (using Vue `computed`):
- `summary` — totalIncome, totalFixedExpenses, totalAllocated, totalSpent, totalRemaining, surplus, overallPercentUsed
- `period` — start, end, totalDays, daysElapsed, daysRemaining, percentComplete
- `categoryProgress[]` — per-category allocated/spent/remaining/percentUsed/status

This replaces `GET /api/budgets/{id}/progress`.

---

## Step 7: Create Category Averages Composable ✅

**File:** `app/composables/useCategoryAverages.ts` (NEW)

Port logic from `server/api/transactions/category-averages.get.ts`.

Inputs: `periodStart`, `period`
Queries used: `transactions.all` (filtered to last 3 months client-side)

Returns: `Array<{ categoryId: string; suggestedAmount: number }>`

This replaces `GET /api/transactions/category-averages`.

---

## Step 8: Migrate UI — Categories Pages ✅

**File:** `app/pages/categories/index.vue`

- Replace `useFetch("/api/categories")` → `useQuery(z, () => queries.categories.list())`
- Replace `$fetch("/api/categories/create", { method: "POST" })` → `z.mutate.categories.create({...})`
- Transaction count per category: compute from `transactions.byCategory()` query length

**File:** `app/pages/categories/[id].vue`

- Replace category fetch → Zero query filtered by id
- Replace transactions fetch → `useQuery(z, () => queries.transactions.byCategory(id))`
- Replace PATCH → `z.mutate.categories.update({...})`
- Replace DELETE → `z.mutate.categories.delete({id})`

---

## Step 9: Migrate UI — Transaction Display ✅

**File:** `app/components/TransactionTable.vue`

- Replace `useFetch("/api/transactions/{accountId}")` → `useQuery(z, () => queries.transactions.byAccount(accountId))`
- Replace `useFetch("/api/categories")` → `useQuery(z, () => queries.categories.list())`
- Replace category assignment `$fetch` → `z.mutate.transactions.assignCategory({transactionId, categoryId})`

---

## Step 10: Migrate UI — Budgets Pages ✅

**File:** `app/pages/budgets/index.vue`

- Replace `useFetch("/api/budgets")` → `useQuery(z, () => queries.budgets.list())`

**File:** `app/pages/budgets/[id]/index.vue`

- Replace `useFetch("/api/budgets/{id}/progress")` → `useBudgetProgress(budgetId)` composable
- Replace budget DELETE → `z.mutate.budgets.delete({id})`

**File:** `app/pages/budgets/create.vue` + `app/pages/budgets/[id]/edit.vue`

- These delegate to `BudgetWizard` component — changes happen there

---

## Step 11: Migrate UI — Budget Wizard ✅

**File:** `app/components/BudgetWizard.vue`

- Replace budget create/update `$fetch` calls → `z.mutate.budgets.create(...)` / `z.mutate.budgets.update(...)`
- Replace income create/update/delete → `z.mutate.budgetIncome.*`
- Replace fixed expense create/update/delete → `z.mutate.fixedExpenses.*`
- Replace allocation create/update/delete → `z.mutate.allocations.*`
- The wizard currently builds items in local state then submits sequentially — with Zero mutators, each operation is individually optimistic

**File:** `app/components/BudgetWizardStep2.vue` (Income)

- Replace `useFetch("/api/transactions/all", { query: { type: "CREDIT" } })` → `useQuery(z, () => queries.transactions.all())` filtered to CREDIT client-side

**File:** `app/components/BudgetWizardStep3.vue` (Fixed Expenses)

- Replace category and transaction fetches → Zero queries

**File:** `app/components/BudgetWizardStep4.vue` (Allocations)

- Replace `useFetch("/api/categories")` → Zero query
- Replace `useFetch("/api/transactions/category-averages")` → `useCategoryAverages(...)` composable

---

## Step 12: Deprecate Replaced Server API Routes ⬜

After all UI pages are migrated and verified:

**Keep permanently** (write to Postgres, Zero replicates):
- `server/api/accounts/` — Akahu sync routes
- `server/api/transactions/infer-frequency.get.ts` — compute-heavy analysis
- `server/api/zero/` — Zero query + mutate endpoints
- `server/api/auth/` — Better Auth routes

**Deprecate** (replaced by Zero queries + mutators):
- `server/api/categories/` — all routes (9 files)
- `server/api/transactions/` — read routes + category assignment (keep infer-frequency)
- `server/api/budgets/` — all routes (~35 files)

Mark deprecated routes with a comment. Remove after one sprint of stability.

---

## Files Summary

### Create

| File | Purpose |
|------|---------|
| `app/db/zero-mutators.ts` | Shared mutator definitions (categories, transactions, budgets, etc.) |
| `app/composables/useBudgetProgress.ts` | Client-side budget progress computation |
| `app/composables/useCategoryAverages.ts` | Client-side 3-month category spending averages |

### Modify

| File | Change |
|------|--------|
| `config/drizzle-zero.config.ts` | Add 9 tables with all fields |
| `app/db/zero-schema.gen.ts` | Regenerated via `pnpm zero:generate` |
| `app/db/zero-queries.ts` | Add ~12 queries for all tables |
| `app/plugins/zero.client.ts` | Register mutators with Zero instance |
| `app/composables/useZero.ts` | Update type to include mutators |
| `server/api/zero/mutate.post.ts` | Implement `handleMutateRequest` with all mutators |
| `app/pages/categories/index.vue` | Zero queries + mutators |
| `app/pages/categories/[id].vue` | Zero queries + mutators |
| `app/pages/budgets/index.vue` | Zero query |
| `app/pages/budgets/[id]/index.vue` | `useBudgetProgress` composable + delete mutator |
| `app/pages/budgets/create.vue` | Delegates to BudgetWizard (may need minor updates) |
| `app/pages/budgets/[id]/edit.vue` | Delegates to BudgetWizard (may need minor updates) |
| `app/components/TransactionTable.vue` | Zero queries + category assignment mutator |
| `app/components/BudgetWizard.vue` | Zero mutators for all budget CRUD |
| `app/components/BudgetWizardStep2.vue` | Zero query for transactions |
| `app/components/BudgetWizardStep3.vue` | Zero queries for categories + transactions |
| `app/components/BudgetWizardStep4.vue` | Zero query + `useCategoryAverages` |

### Unchanged

- `db/schema.ts` — Drizzle schema (no changes)
- `server/api/zero/query.post.ts` — Already handles any registered query
- `server/api/accounts/` — Akahu sync routes remain (write to Postgres, Zero replicates)
- Auth system (Better Auth)

---

## Verification

1. `pnpm zero:generate` — Verify `zero-schema.gen.ts` contains all 10 tables
2. `pnpm dev:zero-cache` — Confirm zero-cache connects and replicates all tables
3. `pnpm dev` — App loads, navigate each page:
   - `/categories` — List loads from Zero, create/edit/delete work
   - `/categories/{id}` — Detail + transactions load, edit/delete work
   - `/accounts/{id}` — Transactions display from Zero, category assignment works
   - `/budgets` — List loads from Zero
   - `/budgets/create` — Full wizard flow works (income, expenses, allocations all save via mutators)
   - `/budgets/{id}` — Progress page computes from Zero data, delete works
   - `/budgets/{id}/edit` — Edit wizard loads existing data, saves changes
4. Test optimistic updates — mutations reflect immediately before server confirms
5. Test error rollback — if server rejects a mutation (e.g., invalid data), UI reverts
6. Browser DevTools → Application → IndexedDB — verify Zero data is stored locally
7. Refresh pages — data loads instantly from IDB cache before sync completes
