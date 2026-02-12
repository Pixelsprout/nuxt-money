<script setup lang="ts">
import { createReusableTemplate } from "@vueuse/core";

const [DefineRolloverFormTemplate, ReuseRolloverFormTemplate] =
  createReusableTemplate();

const props = defineProps<{
  budgetId: string;
  budgetName: string;
}>();

const emit = defineEmits<{
  success: [newBudgetId: string];
}>();

const isDesktop = useSSRMediaQuery("(min-width: 768px)");
const open = defineModel<boolean>("open", { default: false });

const toast = useToast();

const loading = ref(false);
const error = ref("");
const newBudgetName = ref("");
const copiedItems = ref<{
  incomeCount: number;
  expenseCount: number;
  allocationCount: number;
} | null>(null);

const resetModal = () => {
  newBudgetName.value = "";
  copiedItems.value = null;
  error.value = "";
};

watch(open, async (value) => {
  if (value) {
    await fetchBudgetDetails();
  } else {
    resetModal();
  }
});

const fetchBudgetDetails = async () => {
  loading.value = true;
  error.value = "";

  try {
    const response = await $fetch(`/api/budgets/${props.budgetId}`);

    if (response.success) {
      const incomeCount = response.income?.length || 0;
      const expenseCount = response.fixedExpenses?.length || 0;
      const allocationCount = response.allocations?.length || 0;

      copiedItems.value = {
        incomeCount,
        expenseCount,
        allocationCount,
      };
    }
  } catch (err: any) {
    console.error("Failed to fetch budget details:", err);
    error.value = err.data?.message || "Failed to fetch budget details.";
  } finally {
    loading.value = false;
  }
};

const rollOverBudget = async () => {
  loading.value = true;
  error.value = "";

  try {
    const response = await $fetch(`/api/budgets/${props.budgetId}/rollover`, {
      method: "POST",
      body: {
        newBudgetName: newBudgetName.value || undefined,
      },
    });

    if (response.success) {
      toast.add({
        title: "Success",
        description: "Successfully created budget for next period",
        color: "green",
      });

      emit("success", response.newBudget.id);
      open.value = false;
    }
  } catch (err: any) {
    console.error("Failed to rollover budget:", err);
    error.value = err.data?.message || "Failed to rollover budget.";

    toast.add({
      title: "Error",
      description: error.value,
      color: "red",
    });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <!-- Reusable template for modal/drawer content -->
  <DefineRolloverFormTemplate>
    <div class="space-y-6">
      <!-- Error state -->
      <div v-if="error" class="text-sm text-red-500">
        {{ error }}
      </div>

      <!-- Budget Name Input -->
      <div>
        <UInput
          v-model="newBudgetName"
          label="Budget Name"
          placeholder="Auto-generated if left blank"
          :disabled="loading"
        />
      </div>

      <!-- Info Text -->
      <p class="text-sm text-muted-foreground">
        The new budget will be created as a draft so you can edit it before it
        becomes active
      </p>

      <!-- Loading State -->
      <div
        v-if="loading && copiedItems === null"
        class="text-center py-6 text-muted"
      >
        Loading budget details...
      </div>

      <!-- Copied Items Preview -->
      <div v-else-if="copiedItems" class="space-y-2">
        <div class="text-sm font-medium text-muted-foreground">
          Items that will be copied:
        </div>
        <ul class="space-y-1 text-sm">
          <li class="flex items-center gap-2">
            <span class="text-green-600">✓</span>
            {{ copiedItems.incomeCount }} income source(s)
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-600">✓</span>
            {{ copiedItems.expenseCount }} fixed expense(s)
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-600">✓</span>
            {{ copiedItems.allocationCount }} category allocation(s)
          </li>
        </ul>
      </div>
    </div>
  </DefineRolloverFormTemplate>

  <!-- Desktop: Modal -->
  <UModal v-if="isDesktop" v-model:open="open" title="Roll Over Budget">
    <template #body>
      <ReuseRolloverFormTemplate />
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="open = false">
          Cancel
        </UButton>
        <UButton :loading="loading" @click="rollOverBudget">
          Roll Over
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Mobile: Drawer -->
  <UDrawer v-else v-model:open="open" title="Roll Over Budget">
    <template #body>
      <ReuseRolloverFormTemplate />
    </template>

    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        @click="open = false"
        class="w-full justify-center"
      >
        Cancel
      </UButton>
      <UButton
        :loading="loading"
        @click="rollOverBudget"
        class="w-full justify-center"
      >
        Roll Over
      </UButton>
    </template>
  </UDrawer>
</template>
