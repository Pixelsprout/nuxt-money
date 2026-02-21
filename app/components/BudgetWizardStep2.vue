<script setup lang="ts">
import { useVirtualizer } from "@tanstack/vue-virtual";
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
const selectedTransactionIds = ref<Set<string>>(new Set());
const selectedCount = computed(() => selectedTransactionIds.value.size);

const formData = reactive({
  name: "",
  amount: 0,
  frequency: "MONTHLY" as "WEEKLY" | "FORTNIGHTLY" | "MONTHLY",
  notes: "",
  expectedFromAccount: "",
  autoTagEnabled: true,
  adjustForWeekends: true,
});

// Transaction selector
const searchTerm = ref("");
const loadingTransactions = ref(false);
const transactions = ref<any[]>([]);

const filteredTransactions = computed(() => {
  if (!searchTerm.value) return transactions.value;
  const search = searchTerm.value.toLowerCase();
  return transactions.value.filter(
    (t: any) =>
      t.description?.toLowerCase().includes(search) ||
      t.merchant?.toLowerCase().includes(search),
  );
});

const scrollContainerRef = ref<HTMLElement | null>(null);
const virtualizer = useVirtualizer(
  computed(() => ({
    count: filteredTransactions.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => 90,
    overscan: 5,
  })),
);

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

function toggleTransaction(transaction: any) {
  const ids = new Set(selectedTransactionIds.value);
  if (ids.has(transaction.id)) {
    ids.delete(transaction.id);
  } else {
    ids.add(transaction.id);
  }
  selectedTransactionIds.value = ids;
}

function addSelectedTransactions() {
  for (const id of selectedTransactionIds.value) {
    const t = transactions.value.find((t) => t.id === id);
    if (!t) continue;
    const item: BudgetIncome = {
      id: nanoid(),
      budgetId: "",
      userId: "",
      name: t.description || "",
      amount: Math.round(Math.abs((t.amount as any)?.value || 0) * 100),
      frequency: "MONTHLY",
      notes: null,
      expectedFromAccount:
        t.meta && typeof t.meta === "object" && "other_account" in t.meta
          ? (t.meta.other_account as string)
          : null,
      autoTagEnabled: true,
      adjustForWeekends: true,
      referenceDatePayday: null,
      nextPaydayDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    modelValue.value.push(item);
  }
  showModal.value = false;
  resetForm();
}

function handleAdd() {
  if (entryMode.value === "transaction" && !editingItem.value) {
    addSelectedTransactions();
  } else {
    saveItem();
  }
}

const footerAddLabel = computed(() => {
  if (editingItem.value) return "Update";
  if (entryMode.value === "transaction") {
    return selectedCount.value > 0 ? `Add ${selectedCount.value}` : "Add";
  }
  return "Add";
});

const isFooterAddDisabled = computed(() => {
  if (editingItem.value) return false;
  if (entryMode.value === "transaction") return selectedCount.value === 0;
  return false;
});

function toggleToManual() {
  entryMode.value = "manual";
}

function toggleToTransaction() {
  entryMode.value = "transaction";
  selectedTransactionIds.value = new Set();
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
  selectedTransactionIds.value = new Set();
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
              <div class="flex items-center gap-2 mt-1">
                <span class="text-success font-medium text-sm">
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

        <div
          v-else
          ref="scrollContainerRef"
          class="max-h-96 overflow-y-auto"
        >
          <div
            :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }"
          >
            <div
              v-for="virtualRow in virtualizer.getVirtualItems()"
              :key="virtualRow.index"
              :ref="virtualizer.measureElement"
              :data-index="virtualRow.index"
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '8px',
              }"
            >
              <div
                class="border rounded-lg p-3 cursor-pointer transition-colors"
                :class="{
                  'border-primary bg-primary/5': selectedTransactionIds.has(
                    filteredTransactions[virtualRow.index].id,
                  ),
                  'hover:border-gray-300': !selectedTransactionIds.has(
                    filteredTransactions[virtualRow.index].id,
                  ),
                }"
                @click="toggleTransaction(filteredTransactions[virtualRow.index])"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <p class="font-medium text-gray-900 text-sm">
                      {{ filteredTransactions[virtualRow.index].description }}
                    </p>
                    <div class="flex items-center gap-4 mt-2 text-sm">
                      <span class="text-gray-500">
                        {{
                          new Date(
                            filteredTransactions[virtualRow.index].date,
                          ).toLocaleDateString()
                        }}
                      </span>
                      <span class="text-green-600 font-semibold">
                        {{
                          new Intl.NumberFormat("en-NZ", {
                            style: "currency",
                            currency: "NZD",
                          }).format(
                            Math.abs(
                              (filteredTransactions[virtualRow.index].amount as any)
                                ?.value || 0,
                            ),
                          )
                        }}
                      </span>
                    </div>
                    <div
                      v-if="
                        filteredTransactions[virtualRow.index].meta &&
                        typeof filteredTransactions[virtualRow.index].meta ===
                          'object' &&
                        'other_account' in
                          filteredTransactions[virtualRow.index].meta
                      "
                      class="text-xs text-gray-400 mt-1"
                    >
                      From:
                      {{
                        filteredTransactions[virtualRow.index].meta.other_account
                      }}
                    </div>
                  </div>

                  <UIcon
                    v-if="
                      selectedTransactionIds.has(
                        filteredTransactions[virtualRow.index].id,
                      )
                    "
                    name="i-heroicons-check-circle-solid"
                    class="text-primary text-xl flex-shrink-0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="filteredTransactions.length === 0"
            class="text-center py-8 text-gray-500"
          >
            <p>No transactions found</p>
          </div>
        </div>

        <div v-if="selectedCount > 0" class="text-sm text-muted pt-1">
          {{ selectedCount }}
          {{ selectedCount === 1 ? "transaction" : "transactions" }} selected
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
          <UButton :disabled="isFooterAddDisabled" @click="handleAdd">
            {{ footerAddLabel }}
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
        <UButton
          class="justify-center"
          :disabled="isFooterAddDisabled"
          @click="handleAdd"
        >
          {{ footerAddLabel }}
        </UButton>
      </template>
    </UDrawer>
  </div>
</template>
