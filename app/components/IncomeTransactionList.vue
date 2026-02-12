<script setup lang="ts">
import type { BudgetIncome, AkahuTransaction } from "#db/schema";

const props = defineProps<{
  budgetId: string;
  incomeId: string;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const showTransactionPicker = ref(false);

// Fetch tagged transactions
const {
  data: taggedData,
  pending: loading,
  error,
  refresh: refreshTransactions,
} = await useFetch<{
  income: BudgetIncome;
  transactions: Array<{
    id: string;
    transaction: AkahuTransaction;
    linkedAt: string;
    fromAccount: string | null;
    autoTagged: boolean;
  }>;
  summary: {
    totalTagged: number;
    totalAmount: number;
    averageAmount: number;
    lastPayday: string | null;
    nextPayday: string | null;
  };
}>(`/api/budgets/${props.budgetId}/income/${props.incomeId}/transactions`, {
  immediate: true,
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(value);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

async function handleUntag(transactionId: string) {
  const confirmed = confirm("Are you sure you want to untag this transaction?");
  if (!confirmed) return;

  try {
    await $fetch(
      `/api/budgets/${props.budgetId}/income/${props.incomeId}/transactions/${transactionId}`,
      {
        method: "DELETE",
      },
    );

    useToast().add({
      title: "Transaction Untagged",
      description: "Transaction has been untagged successfully",
      color: "green",
    });

    await refreshTransactions();
    emit("refresh");
  } catch (err: any) {
    useToast().add({
      title: "Error",
      description: err.message || "Failed to untag transaction",
      color: "red",
    });
  }
}

function handleTransactionTagged() {
  refreshTransactions();
  emit("refresh");
}

defineExpose({ refresh: refreshTransactions });
</script>

<template>
  <div class="space-y-4">
    <!-- Add Transaction Button -->
    <div class="flex justify-end">
      <UButton icon="i-heroicons-plus" @click="showTransactionPicker = true">
        Tag Transaction
      </UButton>
    </div>

    <!-- Summary Cards -->
    <div
      v-if="taggedData?.summary"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <UCard>
        <div class="text-sm text-gray-500">Total Tagged</div>
        <div class="text-2xl font-semibold mt-1">
          {{ taggedData.summary.totalTagged }}
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-gray-500">Total Amount</div>
        <div class="text-2xl font-semibold mt-1 text-green-600">
          {{ formatCurrency(taggedData.summary.totalAmount) }}
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-gray-500">Average Amount</div>
        <div class="text-2xl font-semibold mt-1">
          {{ formatCurrency(taggedData.summary.averageAmount) }}
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-gray-500">Next Payday</div>
        <div class="text-2xl font-semibold mt-1">
          {{
            taggedData.summary.nextPayday
              ? formatDate(taggedData.summary.nextPayday)
              : "Not set"
          }}
        </div>
      </UCard>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div
          class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"
        ></div>
        <p class="text-sm text-gray-500 mt-2">Loading transactions...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="rounded-md bg-red-50 p-4">
      <p class="text-sm text-red-800">
        {{ error.message || "Failed to load transactions" }}
      </p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="
        !taggedData?.transactions || taggedData.transactions.length === 0
      "
      class="text-center py-12 bg-gray-50 rounded-lg"
    >
      <p class="text-gray-500">No transactions tagged yet</p>
      <p class="text-sm text-gray-400 mt-2">
        Tag transactions to track your income payments
      </p>
    </div>

    <!-- Transactions List -->
    <div v-else class="space-y-3">
      <div
        v-for="item in taggedData.transactions"
        :key="item.id"
        class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <p class="font-medium text-gray-900">
                {{ item.transaction.description }}
              </p>
              <UBadge
                v-if="item.autoTagged"
                color="blue"
                variant="subtle"
                size="xs"
              >
                Auto-tagged
              </UBadge>
            </div>

            <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>{{ formatDate(item.transaction.date) }}</span>
              <span class="text-green-600 font-semibold">
                {{
                  formatCurrency((item.transaction.amount as any)?.value || 0)
                }}
              </span>
              <span v-if="item.fromAccount" class="text-xs">
                From: {{ item.fromAccount }}
              </span>
            </div>

            <div class="text-xs text-gray-400 mt-1">
              Tagged {{ new Date(item.linkedAt).toLocaleDateString() }}
            </div>
          </div>

          <UButton
            color="red"
            variant="ghost"
            size="sm"
            icon="i-heroicons-x-mark"
            @click="handleUntag(item.transaction.id)"
          />
        </div>
      </div>
    </div>

    <!-- Transaction Picker Modal -->
    <IncomeTransactionPicker
      v-if="taggedData?.income"
      :income="taggedData.income"
      :budget-id="budgetId"
      :open="showTransactionPicker"
      @update:open="showTransactionPicker = $event"
      @tagged="handleTransactionTagged"
    />
  </div>
</template>
