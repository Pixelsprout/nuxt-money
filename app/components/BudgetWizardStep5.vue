<script setup lang="ts">
import type {
  BudgetIncome,
  FixedExpense,
  CategoryAllocation,
  TransactionCategory,
} from "#db/schema";

const props = defineProps<{
  budgetData: {
    name: string;
    period: "MONTHLY" | "QUARTERLY" | "YEARLY";
    periodStart: Date;
    periodEnd: Date;
  };
  incomeItems: BudgetIncome[];
  fixedExpenseItems: FixedExpense[];
  allocationItems: CategoryAllocation[];
  totalIncome: number;
  totalFixedExpenses: number;
  totalAllocations: number;
  surplus: number;
}>();

// Fetch categories for names
const { data: categoriesData } = await useFetch<{
  categories: TransactionCategory[];
}>("/api/categories");

const categories = computed(() => categoriesData.value?.categories || []);

const getCategoryName = (categoryId: string | null) => {
  if (!categoryId) return "Uncategorized";
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.name || "Unknown";
};

const getCategoryColor = (categoryId: string | null) => {
  if (!categoryId) return "#64748b";
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.color || "#64748b";
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const periodLabel = computed(() => {
  switch (props.budgetData.period) {
    case "QUARTERLY":
      return "Quarterly";
    case "YEARLY":
      return "Yearly";
    default:
      return "Monthly";
  }
});

const surplusStatus = computed(() => {
  if (props.surplus > 0) return "surplus";
  if (props.surplus < 0) return "deficit";
  return "balanced";
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Review Your Budget</h2>
      <p class="text-muted mt-1">
        Review all the details before creating your budget.
      </p>
    </div>

    <!-- Budget Summary Card -->
    <div class="p-6 border rounded-lg space-y-4">
      <div class="flex justify-between items-start">
        <div>
          <h3 class="text-lg font-semibold">{{ budgetData.name }}</h3>
          <p class="text-sm text-muted">{{ periodLabel }} Budget</p>
        </div>
        <UBadge color="primary" variant="subtle">
          {{ budgetData.period }}
        </UBadge>
      </div>

      <ClientOnly>
        <div class="flex gap-4 text-sm text-muted">
          <span>{{ formatDate(budgetData.periodStart) }}</span>
          <span>→</span>
          <span>{{ formatDate(budgetData.periodEnd) }}</span>
        </div>
      </ClientOnly>
    </div>

    <!-- Financial Summary -->
    <ClientOnly>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Income -->
        <div class="p-4 border rounded-lg">
          <div class="flex justify-between items-center mb-3">
            <h4 class="font-medium">Income</h4>
            <span class="text-lg font-bold text-success">
              {{ formatCurrency(totalIncome) }}
            </span>
          </div>
          <div v-if="incomeItems.length > 0" class="space-y-2">
            <div
              v-for="item in incomeItems"
              :key="item.id"
              class="flex justify-between text-sm"
            >
              <span class="text-muted">{{ item.name }}</span>
              <span
                >{{ formatCurrency(item.amount) }}/{{
                  item.frequency.toLowerCase()
                }}</span
              >
            </div>
          </div>
          <p v-else class="text-sm text-muted">No income sources added</p>
        </div>

        <!-- Fixed Expenses -->
        <div class="p-4 border rounded-lg">
          <div class="flex justify-between items-center mb-3">
            <h4 class="font-medium">Fixed Expenses</h4>
            <span class="text-lg font-bold text-error">
              {{ formatCurrency(totalFixedExpenses) }}
            </span>
          </div>
          <div v-if="fixedExpenseItems.length > 0" class="space-y-2">
            <div
              v-for="item in fixedExpenseItems"
              :key="item.id"
              class="flex justify-between text-sm"
            >
              <span class="text-muted">{{ item.name }}</span>
              <span
                >{{ formatCurrency(item.amount) }}/{{
                  item.frequency.toLowerCase()
                }}</span
              >
            </div>
          </div>
          <p v-else class="text-sm text-muted">No fixed expenses added</p>
        </div>
      </div>
    </ClientOnly>

    <!-- Category Allocations -->
    <ClientOnly>
      <div class="p-4 border rounded-lg">
        <div class="flex justify-between items-center mb-3">
          <h4 class="font-medium">Category Allocations</h4>
          <span class="text-lg font-bold">
            {{ formatCurrency(totalAllocations) }}
          </span>
        </div>
        <div v-if="allocationItems.length > 0" class="space-y-2">
          <div
            v-for="item in allocationItems"
            :key="item.id"
            class="flex justify-between text-sm"
          >
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                :style="{ backgroundColor: getCategoryColor(item.categoryId) }"
              ></span>
              <span class="text-muted">{{
                getCategoryName(item.categoryId)
              }}</span>
            </div>
            <span>{{ formatCurrency(item.allocatedAmount) }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-muted">No category allocations added</p>
      </div>
    </ClientOnly>

    <!-- Surplus/Deficit Summary -->
    <ClientOnly>
      <div
        class="p-6 rounded-lg"
        :class="{
          'bg-success/10 border border-success/20': surplusStatus === 'surplus',
          'bg-error/10 border border-error/20': surplusStatus === 'deficit',
          'bg-muted/50': surplusStatus === 'balanced',
        }"
      >
        <div class="flex justify-between items-center">
          <div>
            <h4 class="font-semibold">
              {{
                surplusStatus === "surplus"
                  ? "Surplus"
                  : surplusStatus === "deficit"
                    ? "Deficit"
                    : "Balanced"
              }}
            </h4>
            <p class="text-sm text-muted">
              Income - Fixed Expenses - Allocations
            </p>
          </div>
          <span
            class="text-2xl font-bold"
            :class="{
              'text-success': surplusStatus === 'surplus',
              'text-error': surplusStatus === 'deficit',
            }"
          >
            {{ formatCurrency(surplus) }}
          </span>
        </div>

        <div
          class="mt-4 pt-4 border-t border-current/10 grid grid-cols-3 gap-4 text-sm"
        >
          <div>
            <p class="text-muted">Total Income</p>
            <p class="font-medium text-success">
              {{ formatCurrency(totalIncome) }}
            </p>
          </div>
          <div>
            <p class="text-muted">Total Expenses</p>
            <p class="font-medium text-error">
              {{ formatCurrency(totalFixedExpenses + totalAllocations) }}
            </p>
          </div>
          <div>
            <p class="text-muted">Remaining</p>
            <p class="font-medium">{{ formatCurrency(surplus) }}</p>
          </div>
        </div>
      </div>
    </ClientOnly>

    <div
      v-if="surplusStatus === 'deficit'"
      class="p-4 bg-warning/10 rounded-lg"
    >
      <p class="text-sm text-warning">
        <strong>Warning:</strong> Your expenses exceed your income. Consider
        adjusting your budget allocations.
      </p>
    </div>
  </div>
</template>
