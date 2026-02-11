<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import type {
  Budget,
  BudgetIncome,
  FixedExpense,
  CategoryAllocation,
} from "#db/schema";

// Extend types to track IDs for edit mode
type TrackableIncome = BudgetIncome & { _id?: string };
type TrackableExpense = FixedExpense & { _id?: string };
type TrackableAllocation = CategoryAllocation & { _id?: string };

const props = defineProps<{
  budgetId?: string;
}>();

const emit = defineEmits<{
  complete: [budget: Budget];
  cancel: [];
}>();

const toast = useToast();
const currentStep = ref(0);
const isSubmitting = ref(false);
const isDirty = ref(false);
const draftBudgetId = ref<string | null>(null);
const allowNavigation = ref(false);
const showUnsavedChangesDialog = ref(false);
const isLoadingData = ref(false);

// Edit mode detection
const isEditMode = computed(() => !!props.budgetId);

// Deletion tracking for edit mode
const deletedIncomeIds = ref<string[]>([]);
const deletedExpenseIds = ref<string[]>([]);
const deletedAllocationIds = ref<string[]>([]);

// Budget state
const budgetData = reactive({
  name: "",
  period: "MONTHLY" as "MONTHLY" | "QUARTERLY" | "YEARLY",
  periodStart: new Date(),
  periodEnd: new Date(),
});

// Calculate period end date based on start date and period type
const calculatePeriodEnd = (
  start: Date,
  periodType: "MONTHLY" | "QUARTERLY" | "YEARLY",
) => {
  const end = new Date(start);

  switch (periodType) {
    case "QUARTERLY":
      end.setMonth(end.getMonth() + 3);
      end.setDate(end.getDate() - 1);
      break;
    case "YEARLY":
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      break;
    case "MONTHLY":
    default:
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
  }

  return end;
};

// Set default period dates
const updatePeriodDates = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  budgetData.periodStart = start;
  budgetData.periodEnd = calculatePeriodEnd(start, budgetData.period);
};

// Initialize period dates
updatePeriodDates();

// Watch for period type changes to recalculate end date
watch(
  () => budgetData.period,
  (newPeriod) => {
    if (!isLoadingData.value) {
      budgetData.periodEnd = calculatePeriodEnd(
        budgetData.periodStart,
        newPeriod,
      );
    }
  },
);

// Watch for period start changes to recalculate end date
watch(
  () => budgetData.periodStart,
  (newStart) => {
    if (!isLoadingData.value) {
      budgetData.periodEnd = calculatePeriodEnd(newStart, budgetData.period);
    }
  },
);

// Income, expenses, and allocations
const incomeItems = ref<TrackableIncome[]>([]);
const fixedExpenseItems = ref<TrackableExpense[]>([]);
const allocationItems = ref<TrackableAllocation[]>([]);

// Track dirty state for unsaved changes
watch(
  () => ({
    budgetData: { ...budgetData },
    incomeItems: incomeItems.value,
    fixedExpenseItems: fixedExpenseItems.value,
    allocationItems: allocationItems.value,
  }),
  () => {
    if (!isLoadingData.value) {
      isDirty.value = true;
    }
  },
  { deep: true },
);

// Track deletions when items are removed
const trackPreviousItems = () => {
  const previousIncome = [...incomeItems.value];
  const previousExpenses = [...fixedExpenseItems.value];
  const previousAllocations = [...allocationItems.value];

  watch(
    () => incomeItems.value.length,
    () => {
      const currentIds = new Set(
        incomeItems.value.map((i) => i._id).filter(Boolean),
      );
      const removedIds = previousIncome
        .filter((i) => i._id && !currentIds.has(i._id))
        .map((i) => i._id!);
      deletedIncomeIds.value.push(...removedIds);
      previousIncome.splice(0, previousIncome.length, ...incomeItems.value);
    },
  );

  watch(
    () => fixedExpenseItems.value.length,
    () => {
      const currentIds = new Set(
        fixedExpenseItems.value.map((e) => e._id).filter(Boolean),
      );
      const removedIds = previousExpenses
        .filter((e) => e._id && !currentIds.has(e._id))
        .map((e) => e._id!);
      deletedExpenseIds.value.push(...removedIds);
      previousExpenses.splice(
        0,
        previousExpenses.length,
        ...fixedExpenseItems.value,
      );
    },
  );

  watch(
    () => allocationItems.value.length,
    () => {
      const currentIds = new Set(
        allocationItems.value.map((a) => a._id).filter(Boolean),
      );
      const removedIds = previousAllocations
        .filter((a) => a._id && !currentIds.has(a._id))
        .map((a) => a._id!);
      deletedAllocationIds.value.push(...removedIds);
      previousAllocations.splice(
        0,
        previousAllocations.length,
        ...allocationItems.value,
      );
    },
  );
};

// Load existing budget data in edit mode
const loadBudgetData = async () => {
  if (!props.budgetId) return;

  isLoadingData.value = true;

  try {
    const response = await $fetch<{
      budget: Budget;
      income: BudgetIncome[];
      fixedExpenses: FixedExpense[];
      allocations: CategoryAllocation[];
    }>(`/api/budgets/${props.budgetId}`);

    // Populate budget metadata
    budgetData.name = response.budget.name;
    budgetData.period = response.budget.period as
      | "MONTHLY"
      | "QUARTERLY"
      | "YEARLY";
    budgetData.periodStart = new Date(response.budget.periodStart);
    budgetData.periodEnd = new Date(response.budget.periodEnd);

    // Populate items with _id tracking
    incomeItems.value = response.income.map((item) => ({
      ...item,
      _id: item.id,
    }));

    fixedExpenseItems.value = response.fixedExpenses.map((item) => ({
      ...item,
      _id: item.id,
    }));

    allocationItems.value = response.allocations.map((item) => ({
      ...item,
      _id: item.id,
    }));

    // Set draft budget ID for save operations
    draftBudgetId.value = props.budgetId;

    // Mark as not dirty after loading
    isDirty.value = false;
  } catch (error: any) {
    console.error("Error loading budget data:", error);
    toast.add({
      title: "Error",
      description: error.data?.message || "Failed to load budget data",
      color: "error",
    });
  } finally {
    isLoadingData.value = false;
  }
};

// Calculated totals
const totalIncome = computed(() =>
  incomeItems.value.reduce((sum, item) => sum + item.amount, 0),
);

const totalFixedExpenses = computed(() =>
  fixedExpenseItems.value.reduce((sum, item) => sum + item.amount, 0),
);

const totalAllocations = computed(() =>
  allocationItems.value.reduce((sum, item) => sum + item.allocatedAmount, 0),
);

const surplus = computed(
  () => totalIncome.value - totalFixedExpenses.value - totalAllocations.value,
);

// Stepper items
const steps = [
  { value: 0, title: "Budget Basics", description: "Name and period" },
  { value: 1, title: "Income", description: "Add income sources" },
  { value: 2, title: "Fixed Expenses", description: "Recurring expenses" },
  { value: 3, title: "Allocations", description: "Category budgets" },
  { value: 4, title: "Review", description: "Confirm and create" },
];

// Navigation
const canGoNext = computed(() => {
  switch (currentStep.value) {
    case 0:
      return budgetData.name.trim().length > 0;
    case 1:
      return true; // Income is optional
    case 2:
      return true; // Fixed expenses are optional
    case 3:
      return true; // Allocations are optional
    default:
      return true;
  }
});

const goNext = () => {
  if (currentStep.value < 4 && canGoNext.value) {
    currentStep.value++;
  }
};

const goPrev = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
};

// Submit budget (create mode)
const submitBudget = async () => {
  isSubmitting.value = true;

  try {
    // Create the budget
    const { budget } = await $fetch<{ budget: Budget }>("/api/budgets/create", {
      method: "POST",
      body: {
        name: budgetData.name,
        period: budgetData.period,
        periodStart: budgetData.periodStart.toISOString(),
        periodEnd: budgetData.periodEnd.toISOString(),
      },
    });

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

// Submit budget (edit mode)
const submitBudgetEdit = async () => {
  if (!props.budgetId) return;

  isSubmitting.value = true;

  try {
    // Update budget metadata and change status to ACTIVE
    const { budget } = await $fetch<{ budget: Budget }>(
      `/api/budgets/${props.budgetId}`,
      {
        method: "PATCH",
        body: {
          name: budgetData.name,
          period: budgetData.period,
          periodStart: budgetData.periodStart.toISOString(),
          periodEnd: budgetData.periodEnd.toISOString(),
          status: "ACTIVE",
        },
      },
    );

    // Handle income items
    for (const income of incomeItems.value) {
      if (income._id) {
        // Update existing
        await $fetch(`/api/budgets/${props.budgetId}/income/${income._id}`, {
          method: "PATCH",
          body: {
            name: income.name,
            amount: income.amount,
            frequency: income.frequency,
            notes: income.notes,
          },
        });
      } else {
        // Create new
        await $fetch(`/api/budgets/${props.budgetId}/income/create`, {
          method: "POST",
          body: {
            name: income.name,
            amount: income.amount,
            frequency: income.frequency,
            notes: income.notes,
          },
        });
      }
    }

    // Delete removed income items
    for (const incomeId of deletedIncomeIds.value) {
      await $fetch(`/api/budgets/${props.budgetId}/income/${incomeId}`, {
        method: "DELETE",
      });
    }

    // Handle fixed expenses
    for (const expense of fixedExpenseItems.value) {
      if (expense._id) {
        // Update existing
        await $fetch(
          `/api/budgets/${props.budgetId}/fixed-expenses/${expense._id}`,
          {
            method: "PATCH",
            body: {
              name: expense.name,
              amount: expense.amount,
              frequency: expense.frequency,
              categoryId: expense.categoryId,
              description: expense.description,
            },
          },
        );
      } else {
        // Create new
        await $fetch(`/api/budgets/${props.budgetId}/fixed-expenses/create`, {
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
    }

    // Delete removed expense items
    for (const expenseId of deletedExpenseIds.value) {
      await $fetch(
        `/api/budgets/${props.budgetId}/fixed-expenses/${expenseId}`,
        {
          method: "DELETE",
        },
      );
    }

    // Handle allocations
    for (const allocation of allocationItems.value) {
      if (allocation._id) {
        // Update existing
        await $fetch(
          `/api/budgets/${props.budgetId}/allocations/${allocation._id}`,
          {
            method: "PATCH",
            body: {
              categoryId: allocation.categoryId,
              allocatedAmount: allocation.allocatedAmount,
              notes: allocation.notes,
            },
          },
        );
      } else {
        // Create new
        await $fetch(`/api/budgets/${props.budgetId}/allocations/create`, {
          method: "POST",
          body: {
            categoryId: allocation.categoryId,
            allocatedAmount: allocation.allocatedAmount,
            notes: allocation.notes,
          },
        });
      }
    }

    // Delete removed allocation items
    for (const allocationId of deletedAllocationIds.value) {
      await $fetch(
        `/api/budgets/${props.budgetId}/allocations/${allocationId}`,
        {
          method: "DELETE",
        },
      );
    }

    toast.add({
      title: "Budget published",
      description: `${budget.name} has been published successfully.`,
      color: "success",
    });

    emit("complete", budget);
  } catch (error: any) {
    console.error("Error updating budget:", error);
    toast.add({
      title: "Error",
      description: error.data?.message || "Failed to update budget",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
};

// Main submit handler
const handleSubmit = () => {
  if (isEditMode.value) {
    submitBudgetEdit();
  } else {
    submitBudget();
  }
};

// Save draft
const saveDraft = async () => {
  try {
    if (draftBudgetId.value) {
      // Update existing draft
      await $fetch(`/api/budgets/${draftBudgetId.value}`, {
        method: "PATCH",
        body: {
          name: budgetData.name,
          period: budgetData.period,
          periodStart: budgetData.periodStart.toISOString(),
          periodEnd: budgetData.periodEnd.toISOString(),
          status: "DRAFT",
        },
      });
    } else {
      // Create new draft
      const { budget } = await $fetch<{ budget: Budget }>(
        "/api/budgets/create",
        {
          method: "POST",
          body: {
            name: budgetData.name,
            period: budgetData.period,
            periodStart: budgetData.periodStart.toISOString(),
            periodEnd: budgetData.periodEnd.toISOString(),
            status: "DRAFT",
          },
        },
      );
      draftBudgetId.value = budget.id;
    }

    isDirty.value = false;
    allowNavigation.value = true;

    // Navigate to budgets list
    navigateTo("/budgets");
  } catch (error: any) {
    console.error("Error saving draft:", error);
    throw error;
  }
};

// Browser close warning handler
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (isDirty.value && !allowNavigation.value) {
    event.preventDefault();
    event.returnValue = "";
  }
};

const handleCancel = () => {
  if (isDirty.value && !allowNavigation.value) {
    showUnsavedChangesDialog.value = true;
  } else {
    emit("cancel");
  }
};

const handleSaveDraftAndNavigate = async () => {
  try {
    await saveDraft();
    showUnsavedChangesDialog.value = false;
  } catch (error: any) {
    console.error("Failed to save draft:", error);
    // Keep dialog open on error so user can retry or discard
  }
};

const handleDiscardChanges = () => {
  allowNavigation.value = true;
  showUnsavedChangesDialog.value = false;
  emit("cancel");
};

onMounted(async () => {
  window.addEventListener("beforeunload", handleBeforeUnload);

  // Load data if in edit mode
  if (isEditMode.value) {
    await loadBudgetData();
  }

  // Track deletions for edit mode
  if (isEditMode.value) {
    trackPreviousItems();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div v-if="isLoadingData" class="flex items-center justify-center py-12">
      <div class="text-center space-y-4">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"
        ></div>
        <p class="text-sm text-gray-500">Loading budget data...</p>
      </div>
    </div>

    <template v-else>
      <!-- Stepper Header -->
      <UStepper v-model="currentStep" :items="steps" class="w-full" />

      <!-- Step Content -->
      <div class="min-h-100">
        <!-- Step 1: Budget Basics -->
        <div v-if="currentStep === 0" class="space-y-6">
          <BudgetWizardStep1
            v-model:name="budgetData.name"
            v-model:period="budgetData.period"
            v-model:period-start="budgetData.periodStart"
            v-model:period-end="budgetData.periodEnd"
          />
        </div>

        <!-- Step 2: Income -->
        <div v-else-if="currentStep === 1" class="space-y-6">
          <BudgetWizardStep2
            v-model="incomeItems"
            :budget-period="budgetData.period"
          />
        </div>

        <!-- Step 3: Fixed Expenses -->
        <div v-else-if="currentStep === 2" class="space-y-6">
          <BudgetWizardStep3
            v-model="fixedExpenseItems"
            :budget-period="budgetData.period"
          />
        </div>

        <!-- Step 4: Allocations -->
        <div v-else-if="currentStep === 3" class="space-y-6">
          <BudgetWizardStep4
            v-model="allocationItems"
            :budget-period="budgetData.period"
            :period-start="budgetData.periodStart"
          />
        </div>

        <!-- Step 5: Review -->
        <div v-else-if="currentStep === 4" class="space-y-6">
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
          v-if="currentStep > 0"
          variant="outline"
          color="neutral"
          icon="i-lucide-arrow-left"
          @click="goPrev"
        >
          Previous
        </UButton>
        <div v-else></div>

        <div class="flex gap-2">
          <UButton variant="ghost" color="neutral" @click="handleCancel">
            Cancel
          </UButton>

          <UButton
            v-if="currentStep < 4"
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
            :icon="isEditMode ? 'i-lucide-rocket' : 'i-lucide-check'"
            color="success"
            @click="handleSubmit"
          >
            {{ isEditMode ? "Publish Budget" : "Create Budget" }}
          </UButton>
        </div>
      </div>
    </template>

    <UnsavedChangesConfirmationDialog
      v-model:open="showUnsavedChangesDialog"
      @save-draft="handleSaveDraftAndNavigate"
      @discard="handleDiscardChanges"
    />
  </div>
</template>
