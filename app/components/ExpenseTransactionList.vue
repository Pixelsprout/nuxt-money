<script setup lang="ts">
import { useQuery } from "zero-vue";
import type { AkahuTransaction, FixedExpense } from "#db/schema";
import { queries } from "~/db/zero-queries";

const props = defineProps<{
  budgetId: string;
  fixedExpenseId: string;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const showTransactionPicker = ref(false);
const z = useZero();

// Fetch linked transaction records from Zero
const { data: links } = useQuery(
  z,
  () =>
    queries.fixedExpenseTransactions.byExpense(
      { fixedExpenseId: props.fixedExpenseId },
      { userID: z.userID },
    ),
);

// Fetch all transactions from Zero to join with links
const { data: allTransactions } = useQuery(
  z,
  () => queries.transactions.all({ userID: z.userID }),
);

// Fetch expense item from Zero
const { data: expenseItems } = useQuery(
  z,
  () =>
    queries.fixedExpenses.byBudget(
      { budgetId: props.budgetId },
      { userID: z.userID },
    ),
);

const expense = computed<FixedExpense | null>(
  () =>
    expenseItems.value.find((e) => e.id === props.fixedExpenseId) ?? null,
);

// Build a lookup map for transactions
const transactionMap = computed(() => {
  const map = new Map<string, AkahuTransaction>();
  for (const t of allTransactions.value) {
    map.set(t.id, t as AkahuTransaction);
  }
  return map;
});

// Joined tagged data sorted by transaction date desc
const taggedData = computed(() => {
  return links.value
    .map((link) => ({
      id: link.id,
      transaction: transactionMap.value.get(link.transactionId) ?? null,
      linkedAt: link.linkedAt,
      autoTagged: link.autoTagged,
    }))
    .filter((item) => item.transaction !== null)
    .sort(
      (a, b) =>
        new Date(b.transaction!.date).getTime() -
        new Date(a.transaction!.date).getTime(),
    );
});

// Summary computed from Zero data
const summary = computed(() => {
  const totalTagged = taggedData.value.length;
  const totalAmount = taggedData.value.reduce((sum, item) => {
    const amount = (item.transaction?.amount as any)?.value ?? 0;
    return sum + Math.abs(amount);
  }, 0);
  const averageAmount = totalTagged > 0 ? totalAmount / totalTagged : 0;
  const nextDueDate = expense.value?.nextDueDate ?? null;
  return { totalTagged, totalAmount, averageAmount, nextDueDate };
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(Math.abs(value));
};

const formatDate = (date: string | Date | number | null) => {
  if (!date) return "Not set";
  return new Date(date).toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

async function handleUntag(linkId: string) {
  const confirmed = confirm("Are you sure you want to untag this transaction?");
  if (!confirmed) return;

  try {
    await z.mutate.fixedExpenseTransactions.unlink({ id: linkId });

    useToast().add({
      title: "Transaction Untagged",
      description: "Transaction has been untagged successfully",
      color: "green",
    });

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
  emit("refresh");
}
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
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard>
        <div class="text-sm text-gray-500">Total Tagged</div>
        <div class="text-2xl font-semibold mt-1">
          {{ summary.totalTagged }}
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-gray-500">Total Amount</div>
        <div class="text-2xl font-semibold mt-1 text-red-600">
          {{ formatCurrency(summary.totalAmount) }}
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-gray-500">Average Amount</div>
        <div class="text-2xl font-semibold mt-1">
          {{ formatCurrency(summary.averageAmount) }}
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-gray-500">Next Due Date</div>
        <div class="text-2xl font-semibold mt-1">
          {{ formatDate(summary.nextDueDate) }}
        </div>
      </UCard>
    </div>

    <!-- Empty State -->
    <div
      v-if="taggedData.length === 0"
      class="text-center py-12 bg-gray-50 rounded-lg"
    >
      <p class="text-gray-500">No transactions tagged yet</p>
      <p class="text-sm text-gray-400 mt-2">
        Tag transactions to track when this expense is due
      </p>
    </div>

    <!-- Transactions List -->
    <div v-else class="space-y-3">
      <div
        v-for="item in taggedData"
        :key="item.id"
        class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <p class="font-medium text-gray-900">
                {{ item.transaction!.description }}
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
              <span>{{ formatDate(item.transaction!.date) }}</span>
              <span class="text-red-600 font-semibold">
                {{
                  formatCurrency((item.transaction!.amount as any)?.value || 0)
                }}
              </span>
              <span
                v-if="item.transaction!.merchant"
                class="text-xs text-gray-400"
              >
                {{ item.transaction!.merchant }}
              </span>
            </div>

            <div class="text-xs text-gray-400 mt-1">
              Tagged {{ new Date(item.linkedAt as number).toLocaleDateString() }}
            </div>
          </div>

          <UButton
            color="red"
            variant="ghost"
            size="sm"
            icon="i-heroicons-x-mark"
            @click="handleUntag(item.id)"
          />
        </div>
      </div>
    </div>

    <!-- Transaction Picker Modal -->
    <ExpenseTransactionPicker
      v-if="expense"
      :expense="expense"
      :budget-id="budgetId"
      :open="showTransactionPicker"
      @update:open="showTransactionPicker = $event"
      @tagged="handleTransactionTagged"
    />
  </div>
</template>
