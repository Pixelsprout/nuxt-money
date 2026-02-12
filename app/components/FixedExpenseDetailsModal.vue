<script setup lang="ts">
import type { FixedExpense } from "#db/schema";

const props = defineProps<{
  expense: FixedExpense | null;
  budgetId: string;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  refresh: [];
}>();

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

function handleRefresh() {
  emit("refresh");
}
</script>

<template>
  <UModal
    :model-value="open"
    @update:model-value="(val) => emit('update:open', val)"
    :title="expense?.name || 'Fixed Expense'"
  >
    <template #body>
      <div v-if="expense" class="space-y-6">
        <!-- Expense Details -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-500">Amount</span>
            <span class="font-semibold text-red-600">
              {{ formatCurrency(expense.amount) }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-500">Frequency</span>
            <span class="font-medium capitalize">
              {{ expense.frequency.toLowerCase() }}
            </span>
          </div>

          <div v-if="expense.nextDueDate" class="flex items-center justify-between">
            <span class="text-sm text-gray-500">Next Due Date</span>
            <span class="font-medium">
              {{ formatDate(expense.nextDueDate) }}
            </span>
          </div>

          <div v-if="expense.description" class="pt-2 border-t">
            <span class="text-sm text-gray-500">Description</span>
            <p class="mt-1 text-sm">{{ expense.description }}</p>
          </div>
        </div>

        <!-- Tagged Transactions -->
        <div class="border-t pt-4">
          <h4 class="font-semibold mb-4">Tagged Transactions</h4>
          <ExpenseTransactionList
            :budget-id="budgetId"
            :fixed-expense-id="expense.id"
            @refresh="handleRefresh"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
