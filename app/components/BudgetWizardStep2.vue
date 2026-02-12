<script setup lang="ts">
import type { BudgetIncome } from "#db/schema";
import { createReusableTemplate } from "@vueuse/core";
import { nanoid } from "nanoid";

const [DefineFormTemplate, ReuseFormTemplate] = createReusableTemplate();
const isDesktop = useSSRMediaQuery("(min-width: 768px)");

const modelValue = defineModel<BudgetIncome[]>({ required: true });

const props = defineProps<{
  budgetPeriod: "MONTHLY" | "QUARTERLY" | "YEARLY";
}>();

const showModal = ref(false);
const editingItem = ref<BudgetIncome | null>(null);
const entryMode = ref<"transaction" | "manual">("transaction");
const selectedTransaction = ref<any>(null);

const formData = reactive({
  name: "",
  amount: 0,
  frequency: "MONTHLY" as "WEEKLY" | "FORTNIGHTLY" | "MONTHLY",
  notes: "",
  expectedFromAccount: "",
  autoTagEnabled: true,
  adjustForWeekends: true,
});

// Transaction selector for picking from_account
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
      query: { type: "CREDIT" },
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

  // Extract from_account
  if (
    transaction.meta &&
    typeof transaction.meta === "object" &&
    "other_account" in transaction.meta
  ) {
    formData.expectedFromAccount = transaction.meta.other_account as string;
  }
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
];

const resetForm = () => {
  formData.name = "";
  formData.amount = 0;
  formData.frequency = "MONTHLY";
  formData.notes = "";
  formData.expectedFromAccount = "";
  formData.autoTagEnabled = true;
  formData.adjustForWeekends = true;
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

const openEditModal = (item: BudgetIncome) => {
  editingItem.value = item;
  formData.name = item.name;
  formData.amount = item.amount / 100; // Convert from cents
  formData.frequency = item.frequency as typeof formData.frequency;
  formData.notes = item.notes || "";
  formData.expectedFromAccount = item.expectedFromAccount || "";
  formData.autoTagEnabled = item.autoTagEnabled ?? true;
  formData.adjustForWeekends = item.adjustForWeekends ?? true;
  showModal.value = true;
};

const saveItem = () => {
  if (!formData.name.trim() || formData.amount <= 0) return;

  const item: BudgetIncome = {
    id: editingItem.value?.id || nanoid(),
    budgetId: "",
    userId: "",
    name: formData.name.trim(),
    amount: Math.round(formData.amount * 100), // Convert to cents
    frequency: formData.frequency,
    notes: formData.notes || null,
    expectedFromAccount: formData.expectedFromAccount || null,
    autoTagEnabled: formData.autoTagEnabled,
    adjustForWeekends: formData.adjustForWeekends,
    referenceDatePayday: null,
    nextPaydayDate: null,
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

const totalMonthlyIncome = computed(() => {
  return modelValue.value.reduce((sum, item) => {
    let monthlyAmount = item.amount;
    if (item.frequency === "WEEKLY") {
      monthlyAmount = item.amount * 4.33;
    } else if (item.frequency === "FORTNIGHTLY") {
      monthlyAmount = item.amount * 2.17;
    }
    return sum + monthlyAmount;
  }, 0);
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Income Sources</h2>
      <p class="text-muted mt-1">
        Add your income sources like salaries, investments, or other regular
        income.
      </p>
    </div>

    <!-- Income Table -->
    <div v-if="modelValue.length > 0" class="space-y-4">
      <div class="border rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-2 text-left text-sm font-medium">Name</th>
              <th class="px-4 py-2 text-left text-sm font-medium">Amount</th>
              <th class="px-4 py-2 text-left text-sm font-medium">Frequency</th>
              <th class="px-4 py-2 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="item in modelValue" :key="item.id">
              <td class="px-4 py-3">{{ item.name }}</td>
              <td class="px-4 py-3 text-success font-medium">
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
        <span class="font-medium">Total Monthly Income:</span>
        <span class="text-lg font-bold text-success">
          {{ formatCurrency(totalMonthlyIncome) }}
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 border rounded-lg border-dashed">
      <p class="text-muted">No income sources added yet.</p>
      <p class="text-sm text-muted mt-1">
        Add your salary or other income sources.
      </p>
    </div>

    <UButton icon="i-lucide-plus" @click="openAddModal">
      Add Income Source
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
          Manually Set Income
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
                  <span class="text-green-600 font-semibold">
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
                  v-if="
                    transaction.meta &&
                    typeof transaction.meta === 'object' &&
                    'other_account' in transaction.meta
                  "
                  class="text-xs text-gray-400 mt-1"
                >
                  From: {{ transaction.meta.other_account }}
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
          class="border-t pt-4 mt-4 mx- bg-gray-50 p-4"
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
              <span class="font-medium text-green-600">
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
              v-if="formData.expectedFromAccount"
              class="flex justify-between"
            >
              <span class="text-gray-600">From Account:</span>
              <span class="font-mono text-xs">{{
                formData.expectedFromAccount
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Manual Entry View -->
      <div v-else class="space-y-4">
        <UInput
          v-model="formData.name"
          label="Income Name"
          placeholder="e.g., Salary, Dividends"
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

        <UTextarea
          v-model="formData.notes"
          label="Notes (optional)"
          placeholder="Any additional details..."
        />

        <UInput
          v-model="formData.expectedFromAccount"
          label="Expected Bank Account (optional)"
          placeholder="e.g., 00-0000-0000000-00"
        >
          <template #help>
            <span class="text-xs text-gray-500">
              Used for auto-tagging income transactions
            </span>
          </template>
        </UInput>

        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <UCheckbox v-model="formData.autoTagEnabled" />
            <label class="text-sm">
              Auto-tag future transactions from this account
            </label>
          </div>

          <div class="flex items-center gap-2">
            <UCheckbox v-model="formData.adjustForWeekends" />
            <label class="text-sm">
              Adjust paydays to Friday if they fall on weekends
            </label>
          </div>
        </div>
      </div>
    </DefineFormTemplate>

    <!-- Desktop Modal -->
    <UModal
      v-if="isDesktop"
      v-model:open="showModal"
      :title="editingItem ? 'Edit Income' : 'Add Income'"
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
      :title="editingItem ? 'Edit Income' : 'Add Income'"
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
