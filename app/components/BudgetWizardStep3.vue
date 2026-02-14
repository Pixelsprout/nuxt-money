<script setup lang="ts">
import type { FixedExpense, TransactionCategory } from "#db/schema";
import { createReusableTemplate } from "@vueuse/core";
import { nanoid } from "nanoid";

const [DefineFormTemplate, ReuseFormTemplate] = createReusableTemplate();
const isDesktop = useSSRMediaQuery("(min-width: 768px)");

const modelValue = defineModel<FixedExpense[]>({ required: true });

const props = defineProps<{
  budgetPeriod: "MONTHLY" | "QUARTERLY" | "YEARLY";
}>();

const showModal = ref(false);
const editingItem = ref<FixedExpense | null>(null);
const entryMode = ref<"transaction" | "manual">("transaction");
const selectedTransaction = ref<any>(null);

// Fetch categories
const { data: categoriesData } = await useFetch<{
  categories: TransactionCategory[];
}>("/api/categories");

const categories = computed(() => categoriesData.value?.categories || []);

const formData = reactive({
  name: "",
  amount: 0,
  frequency: "MONTHLY" as
    | "WEEKLY"
    | "FORTNIGHTLY"
    | "MONTHLY"
    | "QUARTERLY"
    | "YEARLY",
  categoryId: null as string | null,
  description: "",
  matchPatternMerchant: "",
  matchPatternDescription: "",
});

// Transaction selector for picking expenses
const searchTerm = ref("");
const loadingTransactions = ref(false);
const transactions = ref<any[]>([]);

async function loadTransactions() {
  loadingTransactions.value = true;
  try {
    const { data } = await useFetch<{
      success: boolean;
      transactions: any[];
    }>("/api/transactions/all", {
      query: { type: "DEBIT" }, // Only show DEBIT transactions for expenses
    });
    transactions.value = data.value?.transactions || [];
  } catch (err) {
    console.error("Failed to load transactions:", err);
  } finally {
    loadingTransactions.value = false;
  }
}

const filteredTransactions = computed(() => {
  let filtered = transactions.value;
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase();
    filtered = filtered.filter(
      (t: any) =>
        t.description.toLowerCase().includes(search) ||
        t.merchant?.toLowerCase().includes(search),
    );
  }
  return filtered.slice(0, 50); // Limit to 50 for performance
});

function selectTransaction(transaction: any) {
  selectedTransaction.value = transaction;

  // Pre-populate form fields from transaction
  formData.name = transaction.description || "";
  formData.amount = Math.abs((transaction.amount as any)?.value || 0);
  formData.categoryId = transaction.categoryId || null;

  // Pre-populate match patterns from transaction
  if (transaction.merchant) {
    formData.matchPatternMerchant = transaction.merchant;
  }
  formData.matchPatternDescription = transaction.description || "";
}

function toggleToManual() {
  entryMode.value = "manual";
}

function toggleToTransaction() {
  entryMode.value = "transaction";
  selectedTransaction.value = null;
}

const frequencyOptions = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

const resetForm = () => {
  formData.name = "";
  formData.amount = 0;
  formData.frequency = "MONTHLY";
  formData.categoryId = null;
  formData.description = "";
  formData.matchPatternMerchant = "";
  formData.matchPatternDescription = "";
  editingItem.value = null;
  entryMode.value = "transaction";
  selectedTransaction.value = null;
  searchTerm.value = "";
};

const openAddModal = () => {
  resetForm();
  showModal.value = true;
  loadTransactions(); // Load transactions when modal opens
};

const openEditModal = (item: FixedExpense) => {
  editingItem.value = item;
  formData.name = item.name;
  formData.amount = item.amount / 100;
  formData.frequency = item.frequency as typeof formData.frequency;
  formData.categoryId = item.categoryId;
  formData.description = item.description || "";
  showModal.value = true;
};

const saveItem = () => {
  if (!formData.name.trim() || formData.amount <= 0) return;

  // Build match pattern
  const matchPattern: { merchant?: string; description?: string } | null =
    formData.matchPatternMerchant || formData.matchPatternDescription
      ? {
          ...(formData.matchPatternMerchant && {
            merchant: formData.matchPatternMerchant,
          }),
          ...(formData.matchPatternDescription && {
            description: formData.matchPatternDescription,
          }),
        }
      : null;

  const item: FixedExpense = {
    id: editingItem.value?.id || nanoid(),
    budgetId: "",
    userId: "",
    name: formData.name.trim(),
    amount: Math.round(formData.amount * 100),
    frequency: formData.frequency,
    categoryId: formData.categoryId,
    description: formData.description || null,
    matchPattern: matchPattern,
    nextDueDate: null,
    createdAt: editingItem.value?.createdAt || new Date(),
    updatedAt: new Date(),
  };

  if (editingItem.value) {
    const index = modelValue.value.findIndex(
      (i) => i.id === editingItem.value!.id,
    );
    if (index !== -1) {
      modelValue.value[index] = item;
    }
  } else {
    modelValue.value.push(item);
  }

  showModal.value = false;
  resetForm();
};

const deleteItem = (id: string) => {
  const index = modelValue.value.findIndex((i) => i.id === id);
  if (index !== -1) {
    modelValue.value.splice(index, 1);
  }
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
};

const getCategoryName = (categoryId: string | null) => {
  if (!categoryId) return "Uncategorized";
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.name || "Unknown";
};

const getCategoryColor = (categoryId: string | null) => {
  if (!categoryId) return "#64748b";
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.color || "#64748b";
};

const totalMonthlyExpenses = computed(() => {
  return modelValue.value.reduce((sum, item) => {
    let monthlyAmount = item.amount;
    switch (item.frequency) {
      case "WEEKLY":
        monthlyAmount = item.amount * 4.33;
        break;
      case "FORTNIGHTLY":
        monthlyAmount = item.amount * 2.17;
        break;
      case "QUARTERLY":
        monthlyAmount = item.amount / 3;
        break;
      case "YEARLY":
        monthlyAmount = item.amount / 12;
        break;
    }
    return sum + monthlyAmount;
  }, 0);
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Fixed Expenses</h2>
      <p class="text-muted mt-1">
        Add recurring fixed expenses like rent, insurance, subscriptions, etc.
      </p>
    </div>

    <!-- Expenses Table -->
    <div v-if="modelValue.length > 0" class="space-y-4">
      <!-- Mobile: Stacked cards -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="item in modelValue"
          :key="item.id"
          class="border rounded-lg p-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium truncate">{{ item.name }}</p>
              <p v-if="item.description" class="text-xs text-muted truncate">
                {{ item.description }}
              </p>
              <div class="flex flex-wrap items-center gap-2 mt-1.5">
                <UBadge
                  :style="{
                    backgroundColor: getCategoryColor(item.categoryId) + '20',
                    color: getCategoryColor(item.categoryId),
                  }"
                  size="xs"
                >
                  {{ getCategoryName(item.categoryId) }}
                </UBadge>
                <span class="text-error font-medium text-sm">
                  {{ formatCurrency(item.amount) }}
                </span>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ item.frequency }}
                </UBadge>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-pencil"
                @click="openEditModal(item)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                @click="deleteItem(item.id)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop: Table -->
      <div class="border rounded-lg overflow-hidden hidden md:block">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-2 text-left text-sm font-medium">Name</th>
              <th class="px-4 py-2 text-left text-sm font-medium">Category</th>
              <th class="px-4 py-2 text-left text-sm font-medium">Amount</th>
              <th class="px-4 py-2 text-left text-sm font-medium">Frequency</th>
              <th class="px-4 py-2 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="item in modelValue" :key="item.id">
              <td class="px-4 py-3">
                <div>
                  <p class="font-medium">{{ item.name }}</p>
                  <p v-if="item.description" class="text-xs text-muted">
                    {{ item.description }}
                  </p>
                </div>
              </td>
              <td class="px-4 py-3">
                <UBadge
                  :style="{
                    backgroundColor: getCategoryColor(item.categoryId) + '20',
                    color: getCategoryColor(item.categoryId),
                  }"
                >
                  {{ getCategoryName(item.categoryId) }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-error font-medium">
                {{ formatCurrency(item.amount) }}
              </td>
              <td class="px-4 py-3">
                <UBadge color="neutral" variant="subtle">
                  {{ item.frequency }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex gap-1 justify-end">
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    @click="openEditModal(item)"
                  />
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-trash-2"
                    @click="deleteItem(item.id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
        <span class="font-medium">Total Monthly Fixed Expenses:</span>
        <span class="text-lg font-bold text-error">
          {{ formatCurrency(totalMonthlyExpenses) }}
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 border rounded-lg border-dashed">
      <p class="text-muted">No fixed expenses added yet.</p>
      <p class="text-sm text-muted mt-1">
        Add your recurring bills and subscriptions.
      </p>
    </div>

    <UButton icon="i-lucide-plus" @click="openAddModal">
      Add Fixed Expense
    </UButton>

    <!-- Form Template -->
    <DefineFormTemplate>
      <!-- Mode Toggle -->
      <div class="flex justify-end mb-4">
        <UButton
          v-if="entryMode === 'transaction'"
          variant="outline"
          size="sm"
          @click="toggleToManual"
        >
          Manually Set Expense
        </UButton>
        <UButton
          v-else
          variant="outline"
          size="sm"
          icon="i-heroicons-arrow-left"
          @click="toggleToTransaction"
        >
          Select from Transaction
        </UButton>
      </div>

      <!-- Transaction Picker View -->
      <div v-if="entryMode === 'transaction'" class="space-y-4">
        <UInput
          v-model="searchTerm"
          placeholder="Search transactions..."
          icon="i-lucide-search"
        />

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

        <div v-else class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="transaction in filteredTransactions"
            :key="transaction.id"
            class="border rounded-lg p-3 cursor-pointer transition-colors"
            :class="{
              'border-primary-500 bg-primary-50':
                selectedTransaction?.id === transaction.id,
              'hover:border-gray-300':
                selectedTransaction?.id !== transaction.id,
            }"
            @click="selectTransaction(transaction)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <p class="font-medium text-gray-900 text-sm">
                  {{ transaction.description }}
                </p>
                <div class="flex items-center gap-4 mt-2 text-sm">
                  <span class="text-gray-500">
                    {{ new Date(transaction.date).toLocaleDateString() }}
                  </span>
                  <span class="text-red-600 font-semibold">
                    {{
                      new Intl.NumberFormat("en-NZ", {
                        style: "currency",
                        currency: "NZD",
                      }).format(
                        Math.abs((transaction.amount as any)?.value || 0),
                      )
                    }}
                  </span>
                </div>
                <div
                  v-if="transaction.merchant"
                  class="text-xs text-gray-400 mt-1"
                >
                  Merchant: {{ transaction.merchant }}
                </div>
              </div>

              <UIcon
                v-if="selectedTransaction?.id === transaction.id"
                name="i-heroicons-check-circle-solid"
                class="text-primary-500 text-xl flex-shrink-0"
              />
            </div>
          </div>

          <div
            v-if="filteredTransactions.length === 0"
            class="text-center py-8 text-gray-500"
          >
            <p>No transactions found</p>
          </div>
        </div>

        <!-- Selected Transaction Summary -->
        <div
          v-if="selectedTransaction"
          class="border-t pt-4 mt-4 bg-gray-50 p-4"
        >
          <h4 class="font-medium text-sm mb-2">Selected Transaction</h4>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Description:</span>
              <span class="font-medium">{{
                selectedTransaction.description
              }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Amount:</span>
              <span class="font-medium text-red-600">
                {{
                  new Intl.NumberFormat("en-NZ", {
                    style: "currency",
                    currency: "NZD",
                  }).format(
                    Math.abs((selectedTransaction.amount as any)?.value || 0),
                  )
                }}
              </span>
            </div>
            <div
              v-if="selectedTransaction.merchant"
              class="flex justify-between"
            >
              <span class="text-gray-600">Merchant:</span>
              <span class="font-medium">{{
                selectedTransaction.merchant
              }}</span>
            </div>
          </div>
          <div class="mt-3">
            <label class="text-sm font-medium block mb-2">Category</label>
            <USelectMenu
              v-model="formData.categoryId"
              :items="categories"
              value-key="id"
              label-key="name"
              placeholder="Select a category"
              searchable
            >
              <template #option="{ item }">
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :style="{ backgroundColor: item.color }"
                  ></span>
                  {{ item.name }}
                </div>
              </template>
            </USelectMenu>
          </div>
        </div>
      </div>

      <!-- Manual Entry View -->
      <div v-else class="space-y-4">
        <UInput
          v-model="formData.name"
          label="Expense Name"
          placeholder="e.g., Electricity, Netflix"
          required
        />

        <UInput
          v-model.number="formData.amount"
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          required
        >
          <template #leading>
            <span class="text-muted">$</span>
          </template>
        </UInput>

        <div>
          <label class="text-sm font-medium block mb-2">Frequency</label>
          <div class="flex gap-2 flex-wrap">
            <UButton
              v-for="option in frequencyOptions"
              :key="option.value"
              size="sm"
              :variant="
                formData.frequency === option.value ? 'solid' : 'outline'
              "
              :color="
                formData.frequency === option.value ? 'primary' : 'neutral'
              "
              @click="
                formData.frequency = option.value as typeof formData.frequency
              "
            >
              {{ option.label }}
            </UButton>
          </div>
        </div>

        <div>
          <label class="text-sm font-medium block mb-2">Category</label>
          <USelectMenu
            v-model="formData.categoryId"
            :items="categories"
            value-key="id"
            label-key="name"
            placeholder="Select a category"
            searchable
          >
            <template #option="{ item }">
              <div class="flex items-center gap-2">
                <span
                  class="w-3 h-3 rounded-full"
                  :style="{ backgroundColor: item.color }"
                ></span>
                {{ item.name }}
              </div>
            </template>
          </USelectMenu>
        </div>

        <UTextarea
          v-model="formData.description"
          label="Description (optional)"
          placeholder="Any additional details..."
        />

        <div class="space-y-3 border-t pt-4">
          <h4 class="text-sm font-medium">Auto-Matching (Optional)</h4>
          <p class="text-xs text-gray-500">
            Set patterns to automatically match future transactions to this
            expense
          </p>

          <UInput
            v-model="formData.matchPatternMerchant"
            label="Merchant Pattern"
            placeholder="e.g., Netflix, Spark"
          >
            <template #help>
              <span class="text-xs text-gray-500">
                Transactions from this merchant will be suggested for tagging
              </span>
            </template>
          </UInput>

          <UInput
            v-model="formData.matchPatternDescription"
            label="Description Pattern"
            placeholder="e.g., Electricity, Internet"
          >
            <template #help>
              <span class="text-xs text-gray-500">
                Transactions containing this text will be suggested for tagging
              </span>
            </template>
          </UInput>
        </div>
      </div>
    </DefineFormTemplate>

    <!-- Desktop Modal -->
    <UModal
      v-if="isDesktop"
      v-model:open="showModal"
      :title="editingItem ? 'Edit Expense' : 'Add Expense'"
    >
      <template #body>
        <ReuseFormTemplate />
      </template>
      <template #footer="{ close }">
        <div class="flex gap-2 justify-end">
          <UButton variant="outline" color="neutral" @click="close">
            Cancel
          </UButton>
          <UButton @click="saveItem">
            {{ editingItem ? "Update" : "Add" }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Mobile Drawer -->
    <UDrawer
      v-else
      v-model:open="showModal"
      :title="editingItem ? 'Edit Expense' : 'Add Expense'"
    >
      <template #body>
        <ReuseFormTemplate />
      </template>
      <template #footer>
        <UButton
          variant="outline"
          color="neutral"
          class="justify-center"
          @click="showModal = false"
        >
          Cancel
        </UButton>
        <UButton class="justify-center" @click="saveItem">
          {{ editingItem ? "Update" : "Add" }}
        </UButton>
      </template>
    </UDrawer>
  </div>
</template>
