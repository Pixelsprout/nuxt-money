import { defineMutator, defineMutators } from "@rocicorp/zero";
import { nanoid } from "nanoid";
import { z } from "zod";

// ─── Type helpers ──────────────────────────────────────────────────────────

type Ctx = { userID: string };

// ─── Category Schemas ────────────────────────────────────────────────────────

const createCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const updateCategorySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  description: z.string().nullable().optional(),
  updatedAt: z.number(),
});

const deleteCategorySchema = z.object({
  id: z.string(),
});

// ─── Transaction Schemas ──────────────────────────────────────────────────────

const assignCategorySchema = z.object({
  transactionId: z.string(),
  categoryId: z.string().nullable(),
  // Fields needed for server-side transaction reference upsert
  merchant: z.string().nullable().optional(),
  description: z.string().optional(),
  fromAccount: z.string().nullable().optional(),
  amountValue: z.number().nullable().optional(),
});

// ─── Transaction Reference Schemas ───────────────────────────────────────────

const upsertTransactionReferenceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  merchant: z.string(),
  description: z.string(),
  fromAccount: z.string(),
  categoryId: z.string(),
  amountCondition: z
    .object({
      operator: z.enum(["gte", "lte", "eq", "gt", "lt"]),
      value: z.number(),
    })
    .nullable()
    .optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const updateTransactionReferenceSchema = z.object({
  id: z.string(),
  amountCondition: z
    .object({
      operator: z.enum(["gte", "lte", "eq", "gt", "lt"]),
      value: z.number(),
    })
    .nullable()
    .optional(),
  updatedAt: z.number(),
});

const deleteTransactionReferenceSchema = z.object({
  id: z.string(),
});

// ─── Budget Schemas ───────────────────────────────────────────────────────────

const createBudgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  period: z.string(),
  periodStart: z.number(),
  periodEnd: z.number(),
  status: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const updateBudgetSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  period: z.string().optional(),
  periodStart: z.number().optional(),
  periodEnd: z.number().optional(),
  status: z.string().optional(),
  updatedAt: z.number(),
});

const deleteBudgetSchema = z.object({
  id: z.string(),
});

// ─── Budget Income Schemas ────────────────────────────────────────────────────

const createBudgetIncomeSchema = z.object({
  id: z.string(),
  budgetId: z.string(),
  name: z.string(),
  amount: z.number(),
  frequency: z.string(),
  notes: z.string().nullable().optional(),
  expectedFromAccount: z.string().nullable().optional(),
  autoTagEnabled: z.boolean().optional(),
  adjustForWeekends: z.boolean().optional(),
  referenceDatePayday: z.number().nullable().optional(),
  nextPaydayDate: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const updateBudgetIncomeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  amount: z.number().optional(),
  frequency: z.string().optional(),
  notes: z.string().nullable().optional(),
  expectedFromAccount: z.string().nullable().optional(),
  autoTagEnabled: z.boolean().optional(),
  adjustForWeekends: z.boolean().optional(),
  updatedAt: z.number(),
});

const deleteBudgetIncomeSchema = z.object({
  id: z.string(),
});

// ─── Fixed Expense Schemas ────────────────────────────────────────────────────

const matchPatternSchema = z
  .object({
    merchant: z.string().optional(),
    description: z.string().optional(),
  })
  .nullable()
  .optional();

const createFixedExpenseSchema = z.object({
  id: z.string(),
  budgetId: z.string(),
  name: z.string(),
  amount: z.number(),
  frequency: z.string(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  matchPattern: matchPatternSchema,
  nextDueDate: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const updateFixedExpenseSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  amount: z.number().optional(),
  frequency: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  matchPattern: matchPatternSchema,
  updatedAt: z.number(),
});

const deleteFixedExpenseSchema = z.object({
  id: z.string(),
});

// ─── Category Allocation Schemas ──────────────────────────────────────────────

const createCategoryAllocationSchema = z.object({
  id: z.string(),
  budgetId: z.string(),
  categoryId: z.string(),
  allocatedAmount: z.number(),
  notes: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const updateCategoryAllocationSchema = z.object({
  id: z.string(),
  allocatedAmount: z.number().optional(),
  notes: z.string().nullable().optional(),
  updatedAt: z.number(),
});

const deleteCategoryAllocationSchema = z.object({
  id: z.string(),
});

// ─── Budget Transaction Linking Schemas ───────────────────────────────────────

const linkBudgetIncomeTransactionSchema = z.object({
  id: z.string(),
  incomeId: z.string(),
  transactionId: z.string(),
  fromAccount: z.string().nullable().optional(),
  linkedAt: z.number(),
  autoTagged: z.boolean().optional(),
});

const unlinkBudgetIncomeTransactionSchema = z.object({
  id: z.string(),
});

const linkFixedExpenseTransactionSchema = z.object({
  id: z.string(),
  fixedExpenseId: z.string(),
  transactionId: z.string(),
  linkedAt: z.number(),
  autoTagged: z.boolean().optional(),
});

const unlinkFixedExpenseTransactionSchema = z.object({
  id: z.string(),
});

// ─── Mutator Definitions ──────────────────────────────────────────────────────

export const mutators = defineMutators({
  categories: {
    create: defineMutator(
      createCategorySchema,
      async ({ tx, args, ctx }) => {
        const now = Date.now();
        await tx.mutate.transactionCategory.insert({
          id: args.id,
          userId: (ctx as Ctx).userID,
          name: args.name,
          color: args.color,
          description: args.description ?? null,
          createdAt: args.createdAt ?? now,
          updatedAt: args.updatedAt ?? now,
        });
      },
    ),

    update: defineMutator(
      updateCategorySchema,
      async ({ tx, args }) => {
        await tx.mutate.transactionCategory.update({
          id: args.id,
          ...(args.name !== undefined && { name: args.name }),
          ...(args.color !== undefined && { color: args.color }),
          ...(args.description !== undefined && {
            description: args.description,
          }),
          updatedAt: args.updatedAt,
        });
      },
    ),

    delete: defineMutator(
      deleteCategorySchema,
      async ({ tx, args }) => {
        await tx.mutate.transactionCategory.delete({ id: args.id });
      },
    ),
  },

  transactions: {
    assignCategory: defineMutator(
      assignCategorySchema,
      async ({ tx, args, ctx }) => {
        const now = Date.now();
        // Optimistic: update the transaction's categoryId in ZQL cache
        await tx.mutate.akahuTransaction.update({
          id: args.transactionId,
          categoryId: args.categoryId,
          updatedAt: now,
        });

        // Server-side: also upsert a transaction reference for auto-categorization
        if (tx.location === "server" && args.categoryId && args.description) {
          const normalizedMerchant = args.merchant ?? "";
          const normalizedFromAccount = args.fromAccount ?? "";
          await tx.mutate.transactionReference.upsert({
            id: nanoid(),
            userId: (ctx as Ctx).userID,
            merchant: normalizedMerchant,
            description: args.description,
            fromAccount: normalizedFromAccount,
            categoryId: args.categoryId,
            createdAt: now,
            updatedAt: now,
          });
        }
      },
    ),
  },

  transactionReferences: {
    upsert: defineMutator(
      upsertTransactionReferenceSchema,
      async ({ tx, args, ctx }) => {
        const now = Date.now();
        await tx.mutate.transactionReference.upsert({
          id: args.id,
          userId: (ctx as Ctx).userID,
          merchant: args.merchant,
          description: args.description,
          fromAccount: args.fromAccount,
          categoryId: args.categoryId,
          amountCondition: args.amountCondition ?? null,
          createdAt: args.createdAt ?? now,
          updatedAt: args.updatedAt ?? now,
        });
      },
    ),

    update: defineMutator(
      updateTransactionReferenceSchema,
      async ({ tx, args }) => {
        await tx.mutate.transactionReference.update({
          id: args.id,
          amountCondition: args.amountCondition ?? null,
          updatedAt: args.updatedAt,
        });
      },
    ),

    delete: defineMutator(
      deleteTransactionReferenceSchema,
      async ({ tx, args }) => {
        await tx.mutate.transactionReference.delete({ id: args.id });
      },
    ),
  },

  budgets: {
    create: defineMutator(
      createBudgetSchema,
      async ({ tx, args, ctx }) => {
        const now = Date.now();
        await tx.mutate.budget.insert({
          id: args.id,
          userId: (ctx as Ctx).userID,
          name: args.name,
          period: args.period,
          periodStart: args.periodStart,
          periodEnd: args.periodEnd,
          status: args.status ?? "DRAFT",
          createdAt: args.createdAt ?? now,
          updatedAt: args.updatedAt ?? now,
        });
      },
    ),

    update: defineMutator(
      updateBudgetSchema,
      async ({ tx, args }) => {
        await tx.mutate.budget.update({
          id: args.id,
          ...(args.name !== undefined && { name: args.name }),
          ...(args.period !== undefined && { period: args.period }),
          ...(args.periodStart !== undefined && {
            periodStart: args.periodStart,
          }),
          ...(args.periodEnd !== undefined && { periodEnd: args.periodEnd }),
          ...(args.status !== undefined && { status: args.status }),
          updatedAt: args.updatedAt,
        });
      },
    ),

    delete: defineMutator(
      deleteBudgetSchema,
      async ({ tx, args }) => {
        await tx.mutate.budget.delete({ id: args.id });
      },
    ),
  },

  budgetIncome: {
    create: defineMutator(
      createBudgetIncomeSchema,
      async ({ tx, args, ctx }) => {
        const now = Date.now();
        await tx.mutate.budgetIncome.insert({
          id: args.id,
          budgetId: args.budgetId,
          userId: (ctx as Ctx).userID,
          name: args.name,
          amount: args.amount,
          frequency: args.frequency,
          notes: args.notes ?? null,
          expectedFromAccount: args.expectedFromAccount ?? null,
          autoTagEnabled: args.autoTagEnabled ?? true,
          adjustForWeekends: args.adjustForWeekends ?? true,
          referenceDatePayday: args.referenceDatePayday ?? null,
          nextPaydayDate: args.nextPaydayDate ?? null,
          createdAt: args.createdAt ?? now,
          updatedAt: args.updatedAt ?? now,
        });
      },
    ),

    update: defineMutator(
      updateBudgetIncomeSchema,
      async ({ tx, args }) => {
        await tx.mutate.budgetIncome.update({
          id: args.id,
          ...(args.name !== undefined && { name: args.name }),
          ...(args.amount !== undefined && { amount: args.amount }),
          ...(args.frequency !== undefined && { frequency: args.frequency }),
          ...(args.notes !== undefined && { notes: args.notes }),
          ...(args.expectedFromAccount !== undefined && {
            expectedFromAccount: args.expectedFromAccount,
          }),
          ...(args.autoTagEnabled !== undefined && {
            autoTagEnabled: args.autoTagEnabled,
          }),
          ...(args.adjustForWeekends !== undefined && {
            adjustForWeekends: args.adjustForWeekends,
          }),
          updatedAt: args.updatedAt,
        });
      },
    ),

    delete: defineMutator(
      deleteBudgetIncomeSchema,
      async ({ tx, args }) => {
        await tx.mutate.budgetIncome.delete({ id: args.id });
      },
    ),
  },

  fixedExpenses: {
    create: defineMutator(
      createFixedExpenseSchema,
      async ({ tx, args, ctx }) => {
        const now = Date.now();
        await tx.mutate.fixedExpense.insert({
          id: args.id,
          budgetId: args.budgetId,
          userId: (ctx as Ctx).userID,
          name: args.name,
          amount: args.amount,
          frequency: args.frequency,
          categoryId: args.categoryId ?? null,
          description: args.description ?? null,
          matchPattern: args.matchPattern ?? null,
          nextDueDate: args.nextDueDate ?? null,
          createdAt: args.createdAt ?? now,
          updatedAt: args.updatedAt ?? now,
        });
      },
    ),

    update: defineMutator(
      updateFixedExpenseSchema,
      async ({ tx, args }) => {
        await tx.mutate.fixedExpense.update({
          id: args.id,
          ...(args.name !== undefined && { name: args.name }),
          ...(args.amount !== undefined && { amount: args.amount }),
          ...(args.frequency !== undefined && { frequency: args.frequency }),
          ...(args.categoryId !== undefined && {
            categoryId: args.categoryId,
          }),
          ...(args.description !== undefined && {
            description: args.description,
          }),
          ...(args.matchPattern !== undefined && {
            matchPattern: args.matchPattern,
          }),
          updatedAt: args.updatedAt,
        });
      },
    ),

    delete: defineMutator(
      deleteFixedExpenseSchema,
      async ({ tx, args }) => {
        await tx.mutate.fixedExpense.delete({ id: args.id });
      },
    ),
  },

  allocations: {
    create: defineMutator(
      createCategoryAllocationSchema,
      async ({ tx, args }) => {
        const now = Date.now();
        await tx.mutate.categoryAllocation.insert({
          id: args.id,
          budgetId: args.budgetId,
          categoryId: args.categoryId,
          allocatedAmount: args.allocatedAmount,
          notes: args.notes ?? null,
          createdAt: args.createdAt ?? now,
          updatedAt: args.updatedAt ?? now,
        });
      },
    ),

    update: defineMutator(
      updateCategoryAllocationSchema,
      async ({ tx, args }) => {
        await tx.mutate.categoryAllocation.update({
          id: args.id,
          ...(args.allocatedAmount !== undefined && {
            allocatedAmount: args.allocatedAmount,
          }),
          ...(args.notes !== undefined && { notes: args.notes }),
          updatedAt: args.updatedAt,
        });
      },
    ),

    delete: defineMutator(
      deleteCategoryAllocationSchema,
      async ({ tx, args }) => {
        await tx.mutate.categoryAllocation.delete({ id: args.id });
      },
    ),
  },

  budgetIncomeTransactions: {
    link: defineMutator(
      linkBudgetIncomeTransactionSchema,
      async ({ tx, args }) => {
        const now = Date.now();
        await tx.mutate.budgetIncomeTransaction.insert({
          id: args.id,
          incomeId: args.incomeId,
          transactionId: args.transactionId,
          fromAccount: args.fromAccount ?? null,
          linkedAt: args.linkedAt ?? now,
          autoTagged: args.autoTagged ?? false,
        });
      },
    ),

    unlink: defineMutator(
      unlinkBudgetIncomeTransactionSchema,
      async ({ tx, args }) => {
        await tx.mutate.budgetIncomeTransaction.delete({ id: args.id });
      },
    ),
  },

  fixedExpenseTransactions: {
    link: defineMutator(
      linkFixedExpenseTransactionSchema,
      async ({ tx, args }) => {
        const now = Date.now();
        await tx.mutate.fixedExpenseTransaction.insert({
          id: args.id,
          fixedExpenseId: args.fixedExpenseId,
          transactionId: args.transactionId,
          linkedAt: args.linkedAt ?? now,
          autoTagged: args.autoTagged ?? false,
        });
      },
    ),

    unlink: defineMutator(
      unlinkFixedExpenseTransactionSchema,
      async ({ tx, args }) => {
        await tx.mutate.fixedExpenseTransaction.delete({ id: args.id });
      },
    ),
  },
});

export type Mutators = typeof mutators;
