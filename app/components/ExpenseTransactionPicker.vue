<script setup lang="ts">
import { useQuery } from "zero-vue";
import type { FixedExpense, AkahuTransaction } from "#db/schema";
import { queries } from "~/db/zero-queries";

const props = defineProps<{
  expense: FixedExpense;
  budgetId: string;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  tagged: [expense: FixedExpense];
}>();

const isDesktop = useSSRMediaQuery("(min-width: 768px)");

const searchTerm = ref("");
const selectedTransaction = ref<AkahuTransaction | null>(null);
const referenceDateDueDate = ref<string>("");
const loading = ref(false);
const error = ref<string | null>(null);

const z = useZero();

// Fetch all transactions from Zero
const { data: allTransactions } = useQuery(
  z,
  () => queries.transactions.all({ userID: z.userID }),
);

// Fetch already tagged transactions for this expense item from Zero
const { data: links } = useQuery(
  z,
  () =>
    queries.fixedExpenseTransactions.byExpense(
      { fixedExpenseId: props.expense.id },
      { userID: z.userID },
    ),
);

// DEBIT transactions only
const transactions = computed(() =>
  allTransactions.value.filter((t) => t.type === "DEBIT"),
);

// Set of already-tagged transaction IDs
const taggedTransactionIds = computed(
  () => new Set(links.value.map((l) => l.transactionId)),
);

// Reset form when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      error.value = null;
      selectedTransaction.value = null;
      referenceDateDueDate.value = "";
    }
  },
);

// Filter transactions
const filteredTransactions = computed(() => {
  let filtered = transactions.value as AkahuTransaction[];

  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.description.toLowerCase().includes(search) ||
        t.merchant?.toLowerCase().includes(search),
    );
  }

  return [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(Math.abs(value));
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
  const transactionDate = new Date(transaction.date);
  referenceDateDueDate.value = transactionDate.toISOString().split("T")[0];
}

async function confirmTagging() {
  if (!selectedTransaction.value) {
    error.value = "Please select a transaction";
    return;
  }

  if (!referenceDateDueDate.value) {
    error.value = "Please select a due date";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const { data, error: tagError } = await useFetch(
      `/api/budgets/${props.budgetId}/fixed-expenses/${props.expense.id}/tag-transaction`,
      {
        method: "POST",
        body: {
          transactionId: selectedTransaction.value.id,
          referenceDateDueDate: referenceDateDueDate.value,
        },
      },
    );

    if (tagError.value) {
      error.value = tagError.value.message || "Failed to tag transaction";
      return;
    }

    if (data.value && data.value.fixedExpense) {
      emit("tagged", data.value.fixedExpense);
      emit("update:open", false);

      useToast().add({
        title: "Transaction Tagged",
        description: `Tagged to ${props.expense.name}`,
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
    :description="`Tag a transaction to ${expense.name}`"
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

        <!-- Transaction List -->
        <div class="space-y-2 max-h-96 overflow-y-auto">
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
                  <span class="text-red-600 font-semibold">
                    {{
                      formatCurrency((transaction.amount as any)?.value || 0)
                    }}
                  </span>
                  <span
                    v-if="transaction.merchant"
                    class="text-xs text-gray-400"
                  >
                    {{ transaction.merchant }}
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
              Due Date
            </label>
            <input
              v-model="referenceDateDueDate"
              type="date"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
            <p class="text-xs text-gray-500 mt-1">
              Reference date for calculating future due dates
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
          :disabled="!selectedTransaction || !referenceDateDueDate"
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
          Tag a transaction to {{ expense.name }}
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

      <!-- Transaction List -->
      <div class="space-y-2 max-h-96 overflow-y-auto">
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
                <span class="text-red-600 font-semibold">
                  {{ formatCurrency((transaction.amount as any)?.value || 0) }}
                </span>
                <span v-if="transaction.merchant" class="text-xs text-gray-400">
                  {{ transaction.merchant }}
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
            Due Date
          </label>
          <input
            v-model="referenceDateDueDate"
            type="date"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <p class="text-xs text-gray-500 mt-1">
            Reference date for calculating future due dates
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col gap-2">
        <UButton
          color="primary"
          :loading="loading"
          :disabled="!selectedTransaction || !referenceDateDueDate"
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
