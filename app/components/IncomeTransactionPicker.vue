<script setup lang="ts">
import type { BudgetIncome, AkahuTransaction } from "#db/schema";

const props = defineProps<{
  income: BudgetIncome;
  budgetId: string;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  tagged: [income: BudgetIncome];
}>();

const isDesktop = useSSRMediaQuery("(min-width: 768px)");

const searchTerm = ref("");
const selectedTransaction = ref<AkahuTransaction | null>(null);
const referenceDatePayday = ref<string>("");
const loading = ref(false);
const error = ref<string | null>(null);

// Fetch all user's transactions (CREDIT only for income)
const {
  data: transactionsData,
  pending: loadingTransactions,
  refresh: refreshTransactions,
} = await useFetch<{
  success: boolean;
  transactions: AkahuTransaction[];
}>("/api/transactions/all", {
  immediate: false,
  query: {
    type: "CREDIT", // Only show credit transactions for income
  },
});

// Fetch already tagged transactions for this income item
const { data: taggedData, refresh: refreshTagged } = await useFetch<{
  transactions: Array<{
    id: string;
    transaction: AkahuTransaction;
  }>;
}>(`/api/budgets/${props.budgetId}/income/${props.income.id}/transactions`, {
  immediate: false,
});

// Watch open state to fetch data when modal opens
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      error.value = null;
      selectedTransaction.value = null;
      referenceDatePayday.value = "";
      await Promise.all([refreshTransactions(), refreshTagged()]);
    }
  },
);

const taggedTransactionIds = computed(() => {
  return new Set(
    taggedData.value?.transactions.map((t) => t.transaction.id) || [],
  );
});

// Filter transactions
const filteredTransactions = computed(() => {
  let filtered = transactionsData.value?.transactions || [];

  // Apply search filter
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.description.toLowerCase().includes(search) ||
        t.merchant?.toLowerCase().includes(search),
    );
  }

  // Sort by date (most recent first)
  filtered = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return filtered;
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

function selectTransaction(transaction: AkahuTransaction) {
  selectedTransaction.value = transaction;
  // Pre-populate reference date from transaction date
  const transactionDate = new Date(transaction.date);
  referenceDatePayday.value = transactionDate.toISOString().split("T")[0];
}

function getFromAccount(transaction: AkahuTransaction): string | null {
  if (
    transaction.meta &&
    typeof transaction.meta === "object" &&
    "other_account" in transaction.meta
  ) {
    return transaction.meta.other_account as string;
  }
  return null;
}

async function confirmTagging() {
  if (!selectedTransaction.value) {
    error.value = "Please select a transaction";
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
      `/api/budgets/${props.budgetId}/income/${props.income.id}/tag-transaction`,
      {
        method: "POST",
        body: {
          transactionId: selectedTransaction.value.id,
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
        description: `Tagged to ${props.income.name}`,
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
  selectedTransaction.value = null;
}
</script>

<template>
  <!-- Desktop Modal -->
  <UModal
    v-if="isDesktop"
    :model-value="open"
    @update:model-value="(val) => emit('update:open', val)"
    title="Select Transaction"
    :description="`Tag a transaction to ${income.name}`"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Error Message -->
        <div v-if="error" class="rounded-md bg-red-50 p-3">
          <p class="text-sm text-red-800">{{ error }}</p>
        </div>

        <!-- Search -->
        <UInput
          v-model="searchTerm"
          placeholder="Search transactions..."
          icon="i-lucide-search"
        />

        <!-- Loading State -->
        <div
          v-if="loadingTransactions"
          class="flex items-center justify-center py-8"
        >
          <div class="text-center">
            <div
              class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"
            ></div>
            <p class="text-sm text-gray-500 mt-2">Loading transactions...</p>
          </div>
        </div>

        <!-- Transaction List -->
        <div v-else class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="transaction in filteredTransactions"
            :key="transaction.id"
            class="border rounded-lg p-3 cursor-pointer hover:border-primary-500 transition-colors"
            :class="{
              'border-primary-500 bg-primary-50':
                selectedTransaction?.id === transaction.id,
              'opacity-50': taggedTransactionIds.has(transaction.id),
            }"
            @click="selectTransaction(transaction)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <p class="font-medium text-gray-900">
                    {{ transaction.description }}
                  </p>
                  <UBadge
                    v-if="taggedTransactionIds.has(transaction.id)"
                    color="gray"
                    variant="subtle"
                    size="xs"
                  >
                    Already tagged
                  </UBadge>
                </div>

                <div class="flex items-center gap-4 mt-2 text-sm">
                  <span class="text-gray-500">
                    {{ formatDate(transaction.date) }}
                  </span>
                  <span class="text-green-600 font-semibold">
                    {{
                      formatCurrency((transaction.amount as any)?.value || 0)
                    }}
                  </span>
                  <span
                    v-if="getFromAccount(transaction)"
                    class="text-xs text-gray-400"
                  >
                    From: {{ getFromAccount(transaction) }}
                  </span>
                </div>
              </div>

              <UIcon
                v-if="selectedTransaction?.id === transaction.id"
                name="i-heroicons-check-circle-solid"
                class="text-primary-500 text-xl"
              />
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-if="filteredTransactions.length === 0"
            class="text-center py-8 text-gray-500"
          >
            <p>No transactions found</p>
            <p class="text-sm mt-1">
              Try adjusting your search or sync more transactions
            </p>
          </div>
        </div>

        <!-- Selected Transaction Details -->
        <div v-if="selectedTransaction" class="border-t pt-4 mt-4 space-y-4">
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
              Reference date for calculating future paydays
            </p>
          </div>
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
          :disabled="!selectedTransaction || !referenceDatePayday"
          @click="confirmTagging"
        >
          Tag Transaction
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Mobile Drawer -->
  <UDrawer
    v-else
    :model-value="open"
    @update:model-value="(val) => emit('update:open', val)"
  >
    <template #header>
      <div>
        <h3 class="text-lg font-semibold">Select Transaction</h3>
        <p class="text-sm text-gray-500 mt-1">
          Tag a transaction to {{ income.name }}
        </p>
      </div>
    </template>

    <div class="space-y-4 p-4">
      <!-- Error Message -->
      <div v-if="error" class="rounded-md bg-red-50 p-3">
        <p class="text-sm text-red-800">{{ error }}</p>
      </div>

      <!-- Search -->
      <UInput
        v-model="searchTerm"
        placeholder="Search transactions..."
        icon="i-lucide-search"
      />

      <!-- Loading State -->
      <div
        v-if="loadingTransactions"
        class="flex items-center justify-center py-8"
      >
        <div class="text-center">
          <div
            class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"
          ></div>
          <p class="text-sm text-gray-500 mt-2">Loading transactions...</p>
        </div>
      </div>

      <!-- Transaction List -->
      <div v-else class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="transaction in filteredTransactions"
          :key="transaction.id"
          class="border rounded-lg p-3 cursor-pointer hover:border-primary-500 transition-colors"
          :class="{
            'border-primary-500 bg-primary-50':
              selectedTransaction?.id === transaction.id,
            'opacity-50': taggedTransactionIds.has(transaction.id),
          }"
          @click="selectTransaction(transaction)"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <p class="font-medium text-gray-900 text-sm">
                  {{ transaction.description }}
                </p>
                <UBadge
                  v-if="taggedTransactionIds.has(transaction.id)"
                  color="gray"
                  variant="subtle"
                  size="xs"
                >
                  Tagged
                </UBadge>
              </div>

              <div class="flex flex-col gap-1 mt-2 text-sm">
                <span class="text-gray-500">
                  {{ formatDate(transaction.date) }}
                </span>
                <span class="text-green-600 font-semibold">
                  {{ formatCurrency((transaction.amount as any)?.value || 0) }}
                </span>
                <span
                  v-if="getFromAccount(transaction)"
                  class="text-xs text-gray-400"
                >
                  From: {{ getFromAccount(transaction) }}
                </span>
              </div>
            </div>

            <UIcon
              v-if="selectedTransaction?.id === transaction.id"
              name="i-heroicons-check-circle-solid"
              class="text-primary-500 text-xl"
            />
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="filteredTransactions.length === 0"
          class="text-center py-8 text-gray-500"
        >
          <p>No transactions found</p>
          <p class="text-sm mt-1">
            Try adjusting your search or sync more transactions
          </p>
        </div>
      </div>

      <!-- Selected Transaction Details -->
      <div v-if="selectedTransaction" class="border-t pt-4 mt-4 space-y-4">
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
            Reference date for calculating future paydays
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col gap-2">
        <UButton
          color="primary"
          :loading="loading"
          :disabled="!selectedTransaction || !referenceDatePayday"
          class="justify-center"
          @click="confirmTagging"
        >
          Tag Transaction
        </UButton>
        <UButton
          color="gray"
          variant="ghost"
          class="justify-center"
          @click="handleClose"
        >
          Cancel
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
