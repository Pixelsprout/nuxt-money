<script setup lang="ts">
import { onMounted, onBeforeUnmount, toRaw } from "vue";
import { useQuery } from "zero-vue";
import { nanoid } from "nanoid";
import type {
  Budget,
  BudgetIncome,
  FixedExpense,
  CategoryAllocation,
} from "#db/schema";
import { queries } from "~/db/zero-queries";

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

const z = useZero();
const toast = useToast();
const route = useRoute();
const router = useRouter();

// Initialize currentStep from URL query parameter, default to 0
const initialStep = parseInt(route.query.step as string) || 0;
const currentStep = ref(Math.max(0, Math.min(initialStep, 4)));

const isSubmitting = ref(false);
const isDirty = ref(false);
const draftBudgetId = ref<string | null>(null);
const allowNavigation = ref(false);
const showUnsavedChangesDialog = ref(false);
const budgetStatus = ref<string | null>(null);
const isDataPopulated = ref(false);

// Edit mode detection
const isEditMode = computed(() => !!props.budgetId);
const isEditingDraft = computed(() => budgetStatus.value === "DRAFT");

// Deletion tracking for edit mode
const deletedIncomeIds = ref<string[]>([]);
const deletedExpenseIds = ref<string[]>([]);
const deletedAllocationIds = ref<string[]>([]);

// Budget state
const _now = new Date();
const _defaultStart = new Date(
  _now.getFullYear(),
  _now.getMonth(),
  _now.getDate() + 1,
);
const budgetData = reactive({
  name: "",
  period: "MONTHLY" as "MONTHLY" | "QUARTERLY" | "YEARLY",
  periodStart: _defaultStart,
  periodEnd: new Date(_now.getFullYear(), _now.getMonth() + 1, _now.getDate()),
});

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

const updatePeriodDates = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  budgetData.periodStart = start;
  budgetData.periodEnd = calculatePeriodEnd(start, budgetData.period);
};

watch(
  () => budgetData.period,
  (newPeriod) => {
    if (isDataPopulated.value) {
      budgetData.periodEnd = calculatePeriodEnd(
        budgetData.periodStart,
        newPeriod,
      );
    }
  },
);

watch(
  () => budgetData.periodStart,
  (newStart) => {
    if (isDataPopulated.value) {
      budgetData.periodEnd = calculatePeriodEnd(newStart, budgetData.period);
    }
  },
);

// Income, expenses, and allocations in local wizard state
const incomeItems = ref<TrackableIncome[]>([]);
const fixedExpenseItems = ref<TrackableExpense[]>([]);
const allocationItems = ref<TrackableAllocation[]>([]);

// Track dirty state
watch(
  () => ({
    budgetData: { ...budgetData },
    incomeItems: incomeItems.value,
    fixedExpenseItems: fixedExpenseItems.value,
    allocationItems: allocationItems.value,
  }),
  () => {
    if (isDataPopulated.value) {
      isDirty.value = true;
    }
  },
  { deep: true },
);

// Track deletions when items are removed in edit mode
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

// Load existing budget data from Zero when in edit mode
const { data: zeroBudgets, status: budgetsStatus } = useQuery(z, () =>
  props.budgetId
    ? queries.budgets.byId({ id: props.budgetId }, { userID: z.userID })
    : queries.budgets.list({ userID: z.userID }),
);
const { data: zeroIncomeItems, status: incomeStatus } = useQuery(z, () =>
  props.budgetId
    ? queries.budgetIncome.byBudget(
        { budgetId: props.budgetId },
        { userID: z.userID },
      )
    : queries.budgetIncome.byBudget(
        { budgetId: "__none__" },
        { userID: z.userID },
      ),
);
const { data: zeroExpenseItems, status: expensesStatus } = useQuery(z, () =>
  props.budgetId
    ? queries.fixedExpenses.byBudget(
        { budgetId: props.budgetId },
        { userID: z.userID },
      )
    : queries.fixedExpenses.byBudget(
        { budgetId: "__none__" },
        { userID: z.userID },
      ),
);
const { data: zeroAllocationItems, status: allocationsStatus } = useQuery(
  z,
  () =>
    props.budgetId
      ? queries.categoryAllocations.byBudget(
          { budgetId: props.budgetId },
          { userID: z.userID },
        )
      : queries.categoryAllocations.byBudget(
          { budgetId: "__none__" },
          { userID: z.userID },
        ),
);

const isLoadingData = computed(() => {
  if (!props.budgetId) return false;
  if (isDataPopulated.value) return false;
  // Still loading until all four Zero queries have resolved
  return (
    budgetsStatus.value !== "complete" ||
    incomeStatus.value !== "complete" ||
    expensesStatus.value !== "complete" ||
    allocationsStatus.value !== "complete"
  );
});

// Populate local state from Zero data when editing.
// All four data sources and their statuses are watched together to avoid
// populating with empty arrays before Zero has finished its initial sync.
watch(
  [
    zeroBudgets,
    zeroIncomeItems,
    zeroExpenseItems,
    zeroAllocationItems,
    budgetsStatus,
    incomeStatus,
    expensesStatus,
    allocationsStatus,
  ],
  ([
    budgets,
    income,
    expenses,
    allocations,
    bStatus,
    iStatus,
    eStatus,
    aStatus,
  ]) => {
    if (!props.budgetId) return;
    const budget = budgets[0];
    if (!budget) return;

    // Keep status / id in sync whenever the budget record updates
    budgetStatus.value = budget.status;
    draftBudgetId.value = budget.id;

    if (isDataPopulated.value) return;

    // Wait until all queries have finished their initial sync so that empty
    // arrays are truly empty rather than "not yet loaded".
    if (
      bStatus !== "complete" ||
      iStatus !== "complete" ||
      eStatus !== "complete" ||
      aStatus !== "complete"
    )
      return;

    budgetData.name = budget.name;
    budgetData.period = budget.period as "MONTHLY" | "QUARTERLY" | "YEARLY";
    budgetData.periodStart = new Date(budget.periodStart);
    budgetData.periodEnd = new Date(budget.periodEnd);

    incomeItems.value = income.map((item) => ({ ...item, _id: item.id }));
    fixedExpenseItems.value = expenses.map((item) => ({
      ...item,
      _id: item.id,
    }));
    allocationItems.value = allocations.map((item) => ({
      ...item,
      _id: item.id,
    }));

    isDataPopulated.value = true;
    isDirty.value = false;

    if (isEditMode.value) {
      trackPreviousItems();
    }
  },
  { immediate: true },
);

// Watch currentStep and update URL
watch(currentStep, (newStep) => {
  router.replace({ query: { ...route.query, step: newStep.toString() } });
});

// Totals
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

const canGoNext = computed(() => {
  switch (currentStep.value) {
    case 0:
      return budgetData.name.trim().length > 0;
    default:
      return true;
  }
});

const goNext = () => {
  if (currentStep.value < 4 && canGoNext.value) currentStep.value++;
};

const goPrev = () => {
  if (currentStep.value > 0) currentStep.value--;
};

// Helper: apply income/expense/allocation mutations for a given budgetId
const applyMutations = async (
  targetBudgetId: string,
  status: string,
  isUpdate: boolean,
) => {
  const now = Date.now();

  if (isUpdate) {
    // Update budget metadata
    await z.mutate.budgets.update({
      id: targetBudgetId,
      name: budgetData.name,
      period: budgetData.period,
      periodStart: budgetData.periodStart.getTime(),
      periodEnd: budgetData.periodEnd.getTime(),
      status,
      updatedAt: now,
    });
  } else {
    // Create budget
    await z.mutate.budgets.create({
      id: targetBudgetId,
      name: budgetData.name,
      period: budgetData.period,
      periodStart: budgetData.periodStart.getTime(),
      periodEnd: budgetData.periodEnd.getTime(),
      status,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Handle income items
  for (const income of incomeItems.value) {
    if (income._id) {
      await z.mutate.budgetIncome.update({
        id: income._id,
        name: income.name,
        amount: income.amount,
        frequency: income.frequency,
        notes: income.notes ?? null,
        expectedFromAccount: income.expectedFromAccount ?? null,
        autoTagEnabled: income.autoTagEnabled ?? true,
        adjustForWeekends: income.adjustForWeekends ?? true,
        updatedAt: now,
      });
    } else {
      await z.mutate.budgetIncome.create({
        id: nanoid(),
        budgetId: targetBudgetId,
        name: income.name,
        amount: income.amount,
        frequency: income.frequency,
        notes: income.notes ?? null,
        expectedFromAccount: income.expectedFromAccount ?? null,
        autoTagEnabled: income.autoTagEnabled ?? true,
        adjustForWeekends: income.adjustForWeekends ?? true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  for (const incomeId of deletedIncomeIds.value) {
    await z.mutate.budgetIncome.delete({ id: incomeId });
  }

  // Handle fixed expenses
  for (const expense of fixedExpenseItems.value) {
    if (expense._id) {
      await z.mutate.fixedExpenses.update({
        id: expense._id,
        name: expense.name,
        amount: expense.amount,
        frequency: expense.frequency,
        categoryId: expense.categoryId ?? null,
        description: expense.description ?? null,
        matchPattern: expense.matchPattern
          ? { ...toRaw(expense.matchPattern) }
          : null,
        updatedAt: now,
      });
    } else {
      await z.mutate.fixedExpenses.create({
        id: nanoid(),
        budgetId: targetBudgetId,
        name: expense.name,
        amount: expense.amount,
        frequency: expense.frequency,
        categoryId: expense.categoryId ?? null,
        description: expense.description ?? null,
        matchPattern: expense.matchPattern
          ? { ...toRaw(expense.matchPattern) }
          : null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  for (const expenseId of deletedExpenseIds.value) {
    await z.mutate.fixedExpenses.delete({ id: expenseId });
  }

  // Handle allocations
  for (const allocation of allocationItems.value) {
    if (allocation._id) {
      await z.mutate.allocations.update({
        id: allocation._id,
        allocatedAmount: allocation.allocatedAmount,
        notes: allocation.notes ?? null,
        updatedAt: now,
      });
    } else {
      await z.mutate.allocations.create({
        id: nanoid(),
        budgetId: targetBudgetId,
        categoryId: allocation.categoryId,
        allocatedAmount: allocation.allocatedAmount,
        notes: allocation.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  for (const allocationId of deletedAllocationIds.value) {
    await z.mutate.allocations.delete({ id: allocationId });
  }
};

// Submit budget (create or edit)
const submitBudget = async () => {
  isSubmitting.value = true;

  try {
    const budgetId = props.budgetId || draftBudgetId.value || nanoid();
    const isUpdate = !!(props.budgetId || draftBudgetId.value);

    await applyMutations(budgetId, "ACTIVE", isUpdate);

    toast.add({
      title: isEditMode.value ? "Budget published" : "Budget created",
      description: `${budgetData.name} has been ${isEditMode.value ? "published" : "created"} successfully.`,
      color: "success",
    });

    isDirty.value = false;
    allowNavigation.value = true;

    // Construct a minimal Budget object for the emit
    const budget = {
      id: budgetId,
      name: budgetData.name,
      period: budgetData.period,
      status: "ACTIVE",
    } as Budget;

    emit("complete", budget);
  } catch (error: any) {
    console.error("Error saving budget:", error);
    toast.add({
      title: "Error",
      description: "Failed to save budget",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
};

const handleSubmit = () => {
  submitBudget();
};

// Save draft
const saveDraft = async (navigateAway: boolean = true) => {
  try {
    const budgetId = props.budgetId || draftBudgetId.value || nanoid();
    const isUpdate = !!(props.budgetId || draftBudgetId.value);

    if (!isUpdate) {
      draftBudgetId.value = budgetId;
      budgetStatus.value = "DRAFT";
    }

    await applyMutations(budgetId, "DRAFT", isUpdate);

    isDirty.value = false;

    toast.add({
      title: "Draft Saved",
      description: "Your budget has been saved as a draft.",
      color: "success",
    });

    if (navigateAway) {
      allowNavigation.value = true;
      navigateTo("/budgets");
    }
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

const handleSaveDraft = async () => {
  try {
    const shouldNavigate = !isEditingDraft.value;
    await saveDraft(shouldNavigate);
  } catch (error: any) {
    console.error("Failed to save draft:", error);
    toast.add({
      title: "Error",
      description: "Failed to save draft",
      color: "error",
    });
  }
};

const handleSaveDraftAndNavigate = async () => {
  try {
    await saveDraft(true);
    showUnsavedChangesDialog.value = false;
  } catch (error: any) {
    console.error("Failed to save draft:", error);
  }
};

const handleDiscardChanges = () => {
  allowNavigation.value = true;
  showUnsavedChangesDialog.value = false;
  emit("cancel");
};

onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);

  if (!isEditMode.value) {
    updatePeriodDates();
    isDataPopulated.value = true;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Loading state in edit mode before Zero data arrives -->
    <div
      v-if="isEditMode && isLoadingData"
      class="flex items-center justify-center py-12"
    >
      <div class="text-center space-y-4">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"
        ></div>
        <p class="text-sm text-gray-500">Loading budget data...</p>
      </div>
    </div>

    <template v-else>
      <!-- Stepper Header -->
      <UStepper
        v-model="currentStep"
        :items="steps"
        class="w-full"
        :ui="{ description: 'hidden md:block' }"
      />

      <!-- Step Content -->
      <div class="min-h-100">
        <div v-if="currentStep === 0" class="space-y-6">
          <BudgetWizardStep1
            v-model:name="budgetData.name"
            v-model:period="budgetData.period"
            v-model:period-start="budgetData.periodStart"
            v-model:period-end="budgetData.periodEnd"
          />
        </div>

        <div v-else-if="currentStep === 1" class="space-y-6">
          <BudgetWizardStep2
            v-model="incomeItems"
            :budget-period="budgetData.period"
          />
        </div>

        <div v-else-if="currentStep === 2" class="space-y-6">
          <BudgetWizardStep3
            v-model="fixedExpenseItems"
            :budget-period="budgetData.period"
          />
        </div>

        <div v-else-if="currentStep === 3" class="space-y-6">
          <BudgetWizardStep4
            v-model="allocationItems"
            :budget-period="budgetData.period"
            :period-start="budgetData.periodStart"
            :fixed-expense-items="fixedExpenseItems"
          />
        </div>

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
      <div
        class="flex flex-col-reverse sm:flex-row sm:justify-between gap-4 py-4 border-t"
      >
        <div class="flex gap-2">
          <UButton
            v-if="currentStep > 0"
            variant="outline"
            color="neutral"
            icon="i-lucide-arrow-left"
            class="justify-center flex-1"
            @click="goPrev"
          >
            Previous
          </UButton>
          <UButton
            v-if="currentStep < 4"
            class="flex-1 justify-center sm:hidden"
            :disabled="!canGoNext"
            icon="i-lucide-arrow-right"
            trailing
            @click="goNext"
          >
            Next
          </UButton>
        </div>

        <div class="flex flex-wrap gap-2 justify-end">
          <UButton variant="ghost" color="neutral" @click="handleCancel">
            Cancel
          </UButton>

          <UButton
            v-if="!isEditMode || isEditingDraft"
            variant="outline"
            icon="i-lucide-save"
            :disabled="!budgetData.name.trim()"
            @click="handleSaveDraft"
          >
            Save as Draft
          </UButton>

          <UButton
            v-if="currentStep < 4"
            class="flex-1 justify-center hidden sm:flex"
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
            :icon="
              isEditMode && !isEditingDraft
                ? 'i-lucide-save'
                : isEditMode
                  ? 'i-lucide-rocket'
                  : 'i-lucide-check'
            "
            color="success"
            @click="handleSubmit"
          >
            {{
              isEditMode && !isEditingDraft
                ? "Save Changes"
                : isEditMode
                  ? "Publish Budget"
                  : "Create Budget"
            }}
          </UButton>
        </div>
      </div>
    </template>

    <ClientOnly>
      <UnsavedChangesConfirmationDialog
        v-model:open="showUnsavedChangesDialog"
        @save-draft="handleSaveDraftAndNavigate"
        @discard="handleDiscardChanges"
      />
    </ClientOnly>
  </div>
</template>
