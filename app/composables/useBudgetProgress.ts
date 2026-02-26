import { useQuery } from "zero-vue";
import { queries } from "~/db/zero-queries";

export function useBudgetProgress(budgetId: Ref<string> | string) {
  const z = useZero();
  const id = isRef(budgetId) ? budgetId : ref(budgetId);

  const { data: budgets } = useQuery(
    z,
    () => queries.budgets.byId({ id: id.value }, { userID: z.userID }),
  );
  const { data: incomeItems } = useQuery(
    z,
    () => queries.budgetIncome.byBudget({ budgetId: id.value }, { userID: z.userID }),
  );
  const { data: expenseItems } = useQuery(
    z,
    () => queries.fixedExpenses.byBudget({ budgetId: id.value }, { userID: z.userID }),
  );
  const { data: allocationItems } = useQuery(
    z,
    () => queries.categoryAllocations.byBudget({ budgetId: id.value }, { userID: z.userID }),
  );
  const { data: allTransactions } = useQuery(
    z,
    () => queries.transactions.all({ userID: z.userID }),
  );

  const budget = computed(() => budgets.value?.[0] ?? null);

  const periodTransactions = computed(() => {
    if (!budget.value) return [];
    const start = budget.value.periodStart;
    const end = budget.value.periodEnd;
    return allTransactions.value.filter((t) => {
      const d = t.date instanceof Date ? t.date.getTime() : Number(t.date);
      return d >= start && d <= end;
    });
  });

  const categoryProgress = computed(() => {
    return allocationItems.value.map((allocation) => {
      const categoryTransactions = periodTransactions.value.filter(
        (t) => t.categoryId === allocation.categoryId,
      );

      const spent = categoryTransactions.reduce((sum, t) => {
        const amount = (t.amount as any)?.value ?? 0;
        if (amount < 0 || t.type === "DEBIT") {
          return sum + Math.abs(amount);
        }
        return sum;
      }, 0);

      const spentCents = Math.round(spent * 100);
      const allocatedCents = allocation.allocatedAmount;
      const remainingCents = allocatedCents - spentCents;
      const percentUsed =
        allocatedCents > 0
          ? Math.round((spentCents / allocatedCents) * 100)
          : 0;

      const status =
        percentUsed >= 100
          ? "OVER_BUDGET"
          : percentUsed >= 80
            ? "WARNING"
            : "ON_TRACK";

      return {
        categoryId: allocation.categoryId,
        allocated: allocatedCents,
        spent: spentCents,
        remaining: remainingCents,
        percentUsed,
        transactionCount: categoryTransactions.length,
        status,
      };
    });
  });

  const summary = computed(() => {
    const totalIncome = incomeItems.value.reduce(
      (sum, inc) => sum + inc.amount,
      0,
    );
    const totalFixedExpenses = expenseItems.value.reduce(
      (sum, exp) => sum + exp.amount,
      0,
    );
    const totalAllocated = allocationItems.value.reduce(
      (sum, a) => sum + a.allocatedAmount,
      0,
    );
    const totalSpent = categoryProgress.value.reduce(
      (sum, p) => sum + p.spent,
      0,
    );
    const totalRemaining = totalAllocated - totalSpent;
    const surplus = totalIncome - totalFixedExpenses - totalAllocated;
    const overallPercentUsed =
      totalAllocated > 0
        ? Math.round((totalSpent / totalAllocated) * 100)
        : 0;

    return {
      totalIncome,
      totalFixedExpenses,
      totalAllocated,
      totalSpent,
      totalRemaining,
      surplus,
      overallPercentUsed,
    };
  });

  const period = computed(() => {
    if (!budget.value) return null;

    const now = new Date();
    const periodStart = new Date(budget.value.periodStart);
    const periodEnd = new Date(budget.value.periodEnd);

    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysElapsed = Math.max(
      0,
      Math.ceil(
        (Math.min(now.getTime(), periodEnd.getTime()) -
          periodStart.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const percentComplete =
      totalDays > 0 ? Math.round((daysElapsed / totalDays) * 100) : 0;

    return {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      totalDays,
      daysElapsed,
      daysRemaining,
      percentComplete,
    };
  });

  return {
    budget,
    summary,
    period,
    categoryProgress,
    incomeItems,
    expenseItems,
    allocationItems,
  };
}
