<script setup lang="ts">
import type {
  Budget,
  BudgetIncome,
  FixedExpense,
  TransactionCategory,
} from "#db/schema";

definePageMeta({ layout: "default" });

const route = useRoute();
const toast = useToast();
const budgetId = route.params.id as string;

interface ProgressData {
  success: boolean;
  budget: Budget;
  summary: {
    totalIncome: number;
    totalFixedExpenses: number;
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
    surplus: number;
    overallPercentUsed: number;
  };
  period: {
    start: string;
    end: string;
    totalDays: number;
    daysElapsed: number;
    daysRemaining: number;
    percentComplete: number;
  };
  categoryProgress: Array<{
    category: TransactionCategory | null;
    allocated: number;
    spent: number;
    remaining: number;
    percentUsed: number;
    transactionCount: number;
    status: "ON_TRACK" | "WARNING" | "OVER_BUDGET";
  }>;
  income: BudgetIncome[];
  fixedExpenses: FixedExpense[];
}

const { data, pending, error, refresh } = await useFetch<ProgressData>(
  `/api/budgets/${budgetId}/progress`,
  {
    // Retry once if we get a 404 (budget might not be committed yet)
    retry: 1,
    retryDelay: 500,
  },
);

const budget = computed(() => data.value?.budget);
const summary = computed(() => data.value?.summary);
const period = computed(() => data.value?.period);
const categoryProgress = computed(() => data.value?.categoryProgress || []);
const income = computed(() => data.value?.income || []);
const fixedExpenses = computed(() => data.value?.fixedExpenses || []);

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getPeriodLabel = (period: string) => {
  switch (period) {
    case "QUARTERLY":
      return "Quarterly";
    case "YEARLY":
      return "Yearly";
    default:
      return "Monthly";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "ON_TRACK":
      return "success";
    case "WARNING":
      return "warning";
    case "OVER_BUDGET":
      return "error";
    default:
      return "neutral";
  }
};

const deleteBudget = async () => {
  if (!confirm("Are you sure you want to delete this budget?")) return;

  try {
    await $fetch(`/api/budgets/${budgetId}`, { method: "DELETE" });
    toast.add({
      title: "Budget deleted",
      color: "success",
    });
    navigateTo("/budgets");
  } catch (err: any) {
    toast.add({
      title: "Error",
      description: err.data?.message || "Failed to delete budget",
      color: "error",
    });
  }
};
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="budget?.name || 'Budget'">
        <template #left>
          <UButton variant="ghost" icon="i-lucide-arrow-left" to="/budgets" />
        </template>
        <template #right>
          <UButton
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            @click="deleteBudget"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="pending" class="text-center py-12 text-muted">
        Loading budget...
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-12 space-y-4">
        <p class="text-error">Failed to load budget.</p>
        <p class="text-sm text-muted">
          {{ error.data?.message || error.message || "Please try again." }}
        </p>
        <div class="flex gap-2 justify-center">
          <UButton variant="outline" icon="i-lucide-arrow-left" to="/budgets">
            Back to Budgets
          </UButton>
          <UButton icon="i-lucide-refresh-cw" @click="refresh"> Retry </UButton>
        </div>
      </div>

      <!-- Content -->
      <div v-else-if="budget" class="space-y-6">
        <!-- Budget Header -->
        <div
          class="flex flex-col sm:flex-row justify-between items-start gap-4"
        >
          <div>
            <h1 class="text-2xl font-bold">{{ budget.name }}</h1>
            <p class="text-muted">
              {{ getPeriodLabel(budget.period) }} •
              {{ formatDate(period!.start) }} - {{ formatDate(period!.end) }}
            </p>
          </div>
          <UBadge
            :color="budget.status === 'ACTIVE' ? 'success' : 'neutral'"
            size="lg"
          >
            {{ budget.status }}
          </UBadge>
        </div>

        <!-- Period Progress -->
        <div class="p-4 bg-muted/50 rounded-lg">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium">Period Progress</span>
            <span class="text-sm text-muted">
              {{ period?.daysElapsed }} of {{ period?.totalDays }} days
            </span>
          </div>
          <UProgress :model-value="period?.percentComplete" color="primary" />
          <p class="text-xs text-muted mt-1">
            {{ period?.daysRemaining }} days remaining
          </p>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-4 border rounded-lg">
            <p class="text-sm text-muted">Total Income</p>
            <p class="text-xl font-bold text-success">
              {{ formatCurrency(summary!.totalIncome) }}
            </p>
          </div>
          <div class="p-4 border rounded-lg">
            <p class="text-sm text-muted">Fixed Expenses</p>
            <p class="text-xl font-bold text-error">
              {{ formatCurrency(summary!.totalFixedExpenses) }}
            </p>
          </div>
          <div class="p-4 border rounded-lg">
            <p class="text-sm text-muted">Total Spent</p>
            <p class="text-xl font-bold">
              {{ formatCurrency(summary!.totalSpent) }}
            </p>
          </div>
          <div class="p-4 border rounded-lg">
            <p class="text-sm text-muted">Surplus</p>
            <p
              class="text-xl font-bold"
              :class="summary!.surplus >= 0 ? 'text-success' : 'text-error'"
            >
              {{ formatCurrency(summary!.surplus) }}
            </p>
          </div>
        </div>

        <!-- Budget Progress -->
        <div class="p-4 border rounded-lg">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-semibold">Budget Usage</h3>
            <span class="text-sm text-muted">
              {{ summary?.overallPercentUsed }}% used
            </span>
          </div>
          <UProgress
            :model-value="summary?.overallPercentUsed"
            :color="
              summary!.overallPercentUsed > 100
                ? 'error'
                : summary!.overallPercentUsed > 80
                  ? 'warning'
                  : 'success'
            "
          />
          <div class="flex justify-between text-sm mt-2">
            <span class="text-muted">
              {{ formatCurrency(summary!.totalSpent) }} spent
            </span>
            <span class="text-muted">
              {{ formatCurrency(summary!.totalAllocated) }} allocated
            </span>
          </div>
        </div>

        <!-- Category Progress -->
        <div v-if="categoryProgress.length > 0" class="space-y-4">
          <h3 class="font-semibold">Category Breakdown</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="cat in categoryProgress"
              :key="cat.category?.id || 'uncategorized'"
              class="p-4 border rounded-lg"
            >
              <div class="flex justify-between items-center mb-2">
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :style="{
                      backgroundColor: cat.category?.color || '#64748b',
                    }"
                  ></span>
                  <span class="font-medium">
                    {{ cat.category?.name || "Uncategorized" }}
                  </span>
                </div>
                <UBadge :color="getStatusColor(cat.status)" size="sm">
                  {{ cat.status.replace("_", " ") }}
                </UBadge>
              </div>
              <UProgress
                :model-value="cat.percentUsed"
                :color="getStatusColor(cat.status)"
                class="mb-2"
              />
              <div class="flex justify-between text-sm text-muted">
                <span>{{ formatCurrency(cat.spent) }} spent</span>
                <span>{{ formatCurrency(cat.allocated) }} allocated</span>
              </div>
              <p class="text-xs text-muted mt-1">
                {{ cat.transactionCount }} transactions
              </p>
            </div>
          </div>
        </div>

        <!-- Income & Expenses Lists -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Income -->
          <div class="space-y-3">
            <h3 class="font-semibold">Income Sources</h3>
            <div v-if="income.length > 0" class="space-y-2">
              <div
                v-for="item in income"
                :key="item.id"
                class="flex justify-between p-3 bg-muted/30 rounded-lg"
              >
                <span>{{ item.name }}</span>
                <span class="font-medium text-success">
                  {{ formatCurrency(item.amount) }}/{{
                    item.frequency.toLowerCase()
                  }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-muted">No income sources</p>
          </div>

          <!-- Fixed Expenses -->
          <div class="space-y-3">
            <h3 class="font-semibold">Fixed Expenses</h3>
            <div v-if="fixedExpenses.length > 0" class="space-y-2">
              <div
                v-for="item in fixedExpenses"
                :key="item.id"
                class="flex justify-between p-3 bg-muted/30 rounded-lg"
              >
                <span>{{ item.name }}</span>
                <span class="font-medium text-error">
                  {{ formatCurrency(item.amount) }}/{{
                    item.frequency.toLowerCase()
                  }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-muted">No fixed expenses</p>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
