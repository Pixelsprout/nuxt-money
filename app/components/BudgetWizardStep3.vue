<script setup lang="ts">
import type { FixedExpense, TransactionCategory } from "#db/schema";
import { createReusableTemplate, useMediaQuery } from "@vueuse/core";
import { nanoid } from "nanoid";

const [DefineFormTemplate, ReuseFormTemplate] = createReusableTemplate();
const isDesktop = useMediaQuery("(min-width: 768px)");

const modelValue = defineModel<FixedExpense[]>({ required: true });

const props = defineProps<{
  budgetPeriod: "MONTHLY" | "QUARTERLY" | "YEARLY";
}>();

const showModal = ref(false);
const editingItem = ref<FixedExpense | null>(null);

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
});

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
  editingItem.value = null;
};

const openAddModal = () => {
  resetForm();
  showModal.value = true;
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

  const item: FixedExpense = {
    id: editingItem.value?.id || nanoid(),
    budgetId: "",
    userId: "",
    name: formData.name.trim(),
    amount: Math.round(formData.amount * 100),
    frequency: formData.frequency,
    categoryId: formData.categoryId,
    description: formData.description || null,
    matchPattern: null,
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
      <div class="border rounded-lg overflow-hidden">
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
      <div class="space-y-4">
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
