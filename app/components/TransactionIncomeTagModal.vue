<script setup lang="ts">
import { useQuery } from "zero-vue";
import type { AkahuTransaction, BudgetIncome } from "#db/schema";
import { queries } from "~/db/zero-queries";

const props = defineProps<{
  transaction: AkahuTransaction;
  budgetId: string;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  tagged: [income: BudgetIncome];
}>();

const selectedIncomeId = ref<string | null>(null);
const referenceDatePayday = ref<string>("");
const adjustForWeekends = ref(true);
const loading = ref(false);
const error = ref<string | null>(null);

const z = useZero();

// Fetch income items for the budget from Zero
const { data: incomeItems } = useQuery(
  z,
  () =>
    queries.budgetIncome.byBudget(
      { budgetId: props.budgetId },
      { userID: z.userID },
    ),
);

// Pre-populate the payday date from transaction date
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.transaction) {
      selectedIncomeId.value = null;
      error.value = null;

      const transactionDate = new Date(props.transaction.date);
      referenceDatePayday.value = transactionDate.toISOString().split("T")[0];
    }
  },
);

const selectedIncome = computed(() => {
  if (!selectedIncomeId.value) return null;
  return incomeItems.value.find((i) => i.id === selectedIncomeId.value) ?? null;
});

const fromAccount = computed(() => {
  if (
    props.transaction.meta &&
    typeof props.transaction.meta === "object" &&
    "other_account" in props.transaction.meta
  ) {
    return props.transaction.meta.other_account as string;
  }
  return null;
});

async function handleTag() {
  if (!selectedIncomeId.value) {
    error.value = "Please select an income item";
    return;
  }

  if (!referenceDatePayday.value) {
    error.value = "Please select a payday date";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const { data, error: tagError } = await useFetch(
      `/api/budgets/${props.budgetId}/income/${selectedIncomeId.value}/tag-transaction`,
      {
        method: "POST",
        body: {
          transactionId: props.transaction.id,
          referenceDatePayday: referenceDatePayday.value,
        },
      },
    );

    if (tagError.value) {
      error.value = tagError.value.message || "Failed to tag transaction";
      return;
    }

    if (data.value && data.value.income) {
      emit("tagged", data.value.income);
      emit("update:open", false);

      useToast().add({
        title: "Transaction Tagged",
        description: `Tagged to ${data.value.income.name}`,
        color: "green",
      });
    }
  } catch (err: any) {
    error.value = err.message || "Failed to tag transaction";
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  emit("update:open", false);
}
</script>

<template>
  <UModal
    :model-value="open"
    @update:model-value="(val) => emit('update:open', val)"
    title="Tag Income Transaction"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Transaction Info -->
        <div class="rounded-md bg-gray-50 p-3">
          <p class="text-sm font-medium text-gray-700">
            {{ transaction.description }}
          </p>
          <p class="text-sm text-gray-500">
            {{
              new Intl.NumberFormat("en-NZ", {
                style: "currency",
                currency: "NZD",
              }).format((transaction.amount as any)?.value || 0)
            }}
            •
            {{ new Date(transaction.date).toLocaleDateString() }}
          </p>
          <p v-if="fromAccount" class="text-xs text-gray-400 mt-1">
            From: {{ fromAccount }}
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="rounded-md bg-red-50 p-3">
          <p class="text-sm text-red-800">{{ error }}</p>
        </div>

        <!-- Income Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Income Item
          </label>
          <USelectMenu
            v-model="selectedIncomeId"
            :options="incomeItems"
            option-attribute="name"
            value-attribute="id"
            placeholder="Select income item"
          >
            <template #label>
              {{ selectedIncome ? selectedIncome.name : "Select income item" }}
            </template>
            <template #option="{ option }">
              <div class="flex items-center justify-between w-full">
                <span>{{ option.name }}</span>
                <span class="text-xs text-gray-500">{{
                  option.frequency
                }}</span>
              </div>
            </template>
          </USelectMenu>
        </div>

        <!-- Selected Income Details -->
        <div
          v-if="selectedIncome"
          class="rounded-md bg-blue-50 p-3 text-sm text-blue-800"
        >
          <p>
            <strong>{{ selectedIncome.name }}</strong> •
            {{ selectedIncome.frequency }}
          </p>
          <p>
            Amount:
            {{
              new Intl.NumberFormat("en-NZ", {
                style: "currency",
                currency: "NZD",
              }).format(selectedIncome.amount / 100)
            }}
          </p>
          <p v-if="selectedIncome.expectedFromAccount" class="text-xs mt-1">
            Expected from: {{ selectedIncome.expectedFromAccount }}
          </p>
        </div>

        <!-- Payday Date -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Payday Date
          </label>
          <input
            v-model="referenceDatePayday"
            type="date"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <p class="text-xs text-gray-500 mt-1">
            This will be used as the reference for calculating future paydays
          </p>
        </div>

        <!-- Adjust for Weekends -->
        <div class="flex items-center space-x-2">
          <UCheckbox v-model="adjustForWeekends" />
          <label class="text-sm text-gray-700">
            Adjust paydays to Friday if they fall on weekends
          </label>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <UButton color="gray" variant="ghost" @click="handleClose">
          Cancel
        </UButton>
        <UButton
          color="primary"
          :loading="loading"
          :disabled="!selectedIncomeId || !referenceDatePayday"
          @click="handleTag"
        >
          Tag Transaction
        </UButton>
      </div>
    </template>
  </UModal>
</template>
