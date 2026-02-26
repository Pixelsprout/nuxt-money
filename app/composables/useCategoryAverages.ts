import { useQuery } from "zero-vue";
import { queries } from "~/db/zero-queries";

export function useCategoryAverages(
  periodStart: Ref<Date> | Date,
  period: Ref<"MONTHLY" | "QUARTERLY" | "YEARLY"> | "MONTHLY" | "QUARTERLY" | "YEARLY",
) {
  const z = useZero();
  const startRef = isRef(periodStart) ? periodStart : ref(periodStart);
  const periodRef = isRef(period) ? period : ref(period);

  const { data: allTransactions } = useQuery(
    z,
    () => queries.transactions.all({ userID: z.userID }),
  );

  const suggestions = computed(() => {
    const lookbackEnd = startRef.value;
    const lookbackStart = new Date(lookbackEnd);
    lookbackStart.setMonth(lookbackStart.getMonth() - 3);
    const lookbackEndMs = lookbackEnd.getTime();
    const lookbackStartMs = lookbackStart.getTime();

    // Group transactions by category within lookback window
    const spendByCategory = new Map<string, number>();

    for (const t of allTransactions.value) {
      if (!t.categoryId) continue;
      const d = t.date instanceof Date ? t.date.getTime() : Number(t.date);
      if (d < lookbackStartMs || d > lookbackEndMs) continue;

      const amount = (t.amount as any)?.value ?? 0;
      if (amount >= 0 && t.type !== "DEBIT") continue; // Only debits/expenses

      const absAmount = Math.abs(amount);
      spendByCategory.set(
        t.categoryId,
        (spendByCategory.get(t.categoryId) ?? 0) + absAmount,
      );
    }

    const currentPeriod = periodRef.value;
    const result: Array<{ categoryId: string; suggestedAmount: number }> = [];

    for (const [categoryId, totalSpending] of spendByCategory.entries()) {
      const monthlyAverage = totalSpending / 3;

      let suggestedAmount: number;
      switch (currentPeriod) {
        case "QUARTERLY":
          suggestedAmount = monthlyAverage * 3;
          break;
        case "YEARLY":
          suggestedAmount = monthlyAverage * 12;
          break;
        case "MONTHLY":
        default:
          suggestedAmount = monthlyAverage;
      }

      const suggestedCents = Math.round(suggestedAmount * 100);
      if (suggestedCents > 0) {
        result.push({ categoryId, suggestedAmount: suggestedCents });
      }
    }

    return result.sort((a, b) => b.suggestedAmount - a.suggestedAmount);
  });

  return suggestions;
}
