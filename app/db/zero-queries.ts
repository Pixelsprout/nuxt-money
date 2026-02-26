import { defineQueries, defineQuery } from "@rocicorp/zero";
import { zql } from "./zero-schema.gen";

export const queries = defineQueries({
  accounts: {
    list: defineQuery(({ ctx }: { ctx: { userID: string } }) =>
      zql.akahuAccount.where("userId", ctx.userID),
    ),
  },

  categories: {
    list: defineQuery(({ ctx }: { ctx: { userID: string } }) =>
      zql.transactionCategory
        .where("userId", ctx.userID)
        .orderBy("name", "asc"),
    ),
  },

  transactionReferences: {
    list: defineQuery(({ ctx }: { ctx: { userID: string } }) =>
      zql.transactionReference.where("userId", ctx.userID),
    ),
    byCategory: defineQuery(
      ({
        args,
        ctx,
      }: {
        args: { categoryId: string };
        ctx: { userID: string };
      }) =>
        zql.transactionReference
          .where("userId", ctx.userID)
          .where("categoryId", args.categoryId),
    ),
  },

  transactions: {
    byAccount: defineQuery(
      ({
        args,
        ctx,
      }: {
        args: { accountId: string };
        ctx: { userID: string };
      }) =>
        zql.akahuTransaction
          .where("userId", ctx.userID)
          .where("accountId", args.accountId)
          .orderBy("date", "desc"),
    ),
    all: defineQuery(({ ctx }: { ctx: { userID: string } }) =>
      zql.akahuTransaction
        .where("userId", ctx.userID)
        .orderBy("date", "desc"),
    ),
    byCategory: defineQuery(
      ({
        args,
        ctx,
      }: {
        args: { categoryId: string };
        ctx: { userID: string };
      }) =>
        zql.akahuTransaction
          .where("userId", ctx.userID)
          .where("categoryId", args.categoryId)
          .orderBy("date", "desc"),
    ),
  },

  budgets: {
    list: defineQuery(({ ctx }: { ctx: { userID: string } }) =>
      zql.budget.where("userId", ctx.userID).orderBy("createdAt", "desc"),
    ),
    byId: defineQuery(
      ({
        args,
        ctx,
      }: {
        args: { id: string };
        ctx: { userID: string };
      }) =>
        zql.budget.where("userId", ctx.userID).where("id", args.id),
    ),
  },

  budgetIncome: {
    byBudget: defineQuery(
      ({
        args,
        ctx,
      }: {
        args: { budgetId: string };
        ctx: { userID: string };
      }) =>
        zql.budgetIncome
          .where("budgetId", args.budgetId)
          .where("userId", ctx.userID),
    ),
  },

  fixedExpenses: {
    byBudget: defineQuery(
      ({
        args,
        ctx,
      }: {
        args: { budgetId: string };
        ctx: { userID: string };
      }) =>
        zql.fixedExpense
          .where("budgetId", args.budgetId)
          .where("userId", ctx.userID),
    ),
  },

  categoryAllocations: {
    byBudget: defineQuery(
      ({ args }: { args: { budgetId: string }; ctx: { userID: string } }) =>
        zql.categoryAllocation.where("budgetId", args.budgetId),
    ),
  },

  budgetIncomeTransactions: {
    byIncome: defineQuery(
      ({
        args,
      }: {
        args: { incomeId: string };
        ctx: { userID: string };
      }) => zql.budgetIncomeTransaction.where("incomeId", args.incomeId),
    ),
  },

  fixedExpenseTransactions: {
    byExpense: defineQuery(
      ({
        args,
      }: {
        args: { fixedExpenseId: string };
        ctx: { userID: string };
      }) =>
        zql.fixedExpenseTransaction.where(
          "fixedExpenseId",
          args.fixedExpenseId,
        ),
    ),
  },
});
