<script setup lang="ts">
import type { Budget, BudgetIncome, FixedExpense, CategoryAllocation } from "#db/schema";

const props = defineProps<{
  budgetId?: string;
}>();

const emit = defineEmits<{
  complete: [budget: Budget];
  cancel: [];
}>();

const toast = useToast();
const currentStep = ref(1);
const isSubmitting = ref(false);

// Budget state
const budgetData = reactive({
  name: "",
  period: "MONTHLY" as "MONTHLY" | "QUARTERLY" | "YEARLY",
  periodStart: new Date(),
  periodEnd: new Date(),
});

// Set default period dates
const updatePeriodDates = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  let end: Date;

  switch (budgetData.period) {
    case "QUARTERLY":
      end = new Date(start);
      end.setMonth(end.getMonth() + 3);
      end.setDate(end.getDate() - 1);
      break;
    case "YEARLY":
      end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      break;
    case "MONTHLY":
    default:
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
  }

  budgetData.periodStart = start;
  budgetData.periodEnd = end;
};

// Initialize period dates
updatePeriodDates();

watch(() => budgetData.period, updatePeriodDates);

// Income, expenses, and allocations
const incomeItems = ref<BudgetIncome[]>([]);
const fixedExpenseItems = ref<FixedExpense[]>([]);
const allocationItems = ref<CategoryAllocation[]>([]);

// Calculated totals
const totalIncome = computed(() =>
  incomeItems.value.reduce((sum, item) => sum + item.amount, 0)
);

const totalFixedExpenses = computed(() =>
  fixedExpenseItems.value.reduce((sum, item) => sum + item.amount, 0)
);

const totalAllocations = computed(() =>
  allocationItems.value.reduce((sum, item) => sum + item.allocatedAmount, 0)
);

const surplus = computed(
  () => totalIncome.value - totalFixedExpenses.value - totalAllocations.value
);

// Stepper items
const steps = [
  { value: 1, title: "Budget Basics", description: "Name and period" },
  { value: 2, title: "Income", description: "Add income sources" },
  { value: 3, title: "Fixed Expenses", description: "Recurring expenses" },
  { value: 4, title: "Allocations", description: "Category budgets" },
  { value: 5, title: "Review", description: "Confirm and create" },
];

// Navigation
const canGoNext = computed(() => {
  switch (currentStep.value) {
    case 1:
      return budgetData.name.trim().length > 0;
    case 2:
      return true; // Income is optional
    case 3:
      return true; // Fixed expenses are optional
    case 4:
      return true; // Allocations are optional
    default:
      return true;
  }
});

const goNext = () => {
  if (currentStep.value < 5 && canGoNext.value) {
    currentStep.value++;
  }
};

const goPrev = () => {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
};

// Submit budget
const submitBudget = async () => {
  isSubmitting.value = true;

  try {
    // Create the budget
    const { budget } = await $fetch<{ budget: Budget }>(
      "/api/budgets/create",
      {
        method: "POST",
        body: {
          name: budgetData.name,
          period: budgetData.period,
          periodStart: budgetData.periodStart.toISOString(),
          periodEnd: budgetData.periodEnd.toISOString(),
        },
      }
    );

    // Add income items
    for (const income of incomeItems.value) {
      await $fetch(`/api/budgets/${budget.id}/income/create`, {
        method: "POST",
        body: {
          name: income.name,
          amount: income.amount,
          frequency: income.frequency,
          notes: income.notes,
        },
      });
    }

    // Add fixed expenses
    for (const expense of fixedExpenseItems.value) {
      await $fetch(`/api/budgets/${budget.id}/fixed-expenses/create`, {
        method: "POST",
        body: {
          name: expense.name,
          amount: expense.amount,
          frequency: expense.frequency,
          categoryId: expense.categoryId,
          description: expense.description,
        },
      });
    }

    // Add allocations
    for (const allocation of allocationItems.value) {
      await $fetch(`/api/budgets/${budget.id}/allocations/create`, {
        method: "POST",
        body: {
          categoryId: allocation.categoryId,
          allocatedAmount: allocation.allocatedAmount,
          notes: allocation.notes,
        },
      });
    }

    toast.add({
      title: "Budget created",
      description: `${budget.name} has been created successfully.`,
      color: "success",
    });

    emit("complete", budget);
  } catch (error: any) {
    console.error("Error creating budget:", error);
    toast.add({
      title: "Error",
      description: error.data?.message || "Failed to create budget",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Stepper Header -->
    <UStepper v-model="currentStep" :items="steps" class="w-full" />

    <!-- Step Content -->
    <div class="min-h-[400px]">
      <!-- Step 1: Budget Basics -->
      <div v-if="currentStep === 1" class="space-y-6">
        <BudgetWizardStep1
          v-model:name="budgetData.name"
          v-model:period="budgetData.period"
          v-model:period-start="budgetData.periodStart"
          v-model:period-end="budgetData.periodEnd"
        />
      </div>

      <!-- Step 2: Income -->
      <div v-else-if="currentStep === 2" class="space-y-6">
        <BudgetWizardStep2
          v-model="incomeItems"
          :budget-period="budgetData.period"
        />
      </div>

      <!-- Step 3: Fixed Expenses -->
      <div v-else-if="currentStep === 3" class="space-y-6">
        <BudgetWizardStep3
          v-model="fixedExpenseItems"
          :budget-period="budgetData.period"
        />
      </div>

      <!-- Step 4: Allocations -->
      <div v-else-if="currentStep === 4" class="space-y-6">
        <BudgetWizardStep4
          v-model="allocationItems"
          :budget-period="budgetData.period"
          :period-start="budgetData.periodStart"
        />
      </div>

      <!-- Step 5: Review -->
      <div v-else-if="currentStep === 5" class="space-y-6">
        <BudgetWizardStep5
          :budget-data="budgetData"
          :income-items="incomeItems"
          :fixed-expense-items="fixedExpenseItems"
          :allocation-items="allocationItems"
          :total-income="totalIncome"
          :total-fixed-expenses="totalFixedExpenses"
          :total-allocations="totalAllocations"
          :surplus="surplus"
        />
      </div>
    </div>

    <!-- Navigation Buttons -->
    <div class="flex justify-between pt-4 border-t">
      <UButton
        v-if="currentStep > 1"
        variant="outline"
        color="neutral"
        icon="i-lucide-arrow-left"
        @click="goPrev"
      >
        Previous
      </UButton>
      <div v-else></div>

      <div class="flex gap-2">
        <UButton variant="ghost" color="neutral" @click="emit('cancel')">
          Cancel
        </UButton>

        <UButton
          v-if="currentStep < 5"
          :disabled="!canGoNext"
          icon="i-lucide-arrow-right"
          trailing
          @click="goNext"
        >
          Next
        </UButton>

        <UButton
          v-else
          :loading="isSubmitting"
          icon="i-lucide-check"
          color="success"
          @click="submitBudget"
        >
          Create Budget
        </UButton>
      </div>
    </div>
  </div>
</template>
