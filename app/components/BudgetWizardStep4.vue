<script setup lang="ts">
import type {
  CategoryAllocation,
  FixedExpense,
  TransactionCategory,
} from "#db/schema";
import { nanoid } from "nanoid";

const modelValue = defineModel<CategoryAllocation[]>({ required: true });

const props = defineProps<{
  budgetPeriod: "MONTHLY" | "QUARTERLY" | "YEARLY";
  periodStart: Date;
  fixedExpenseItems: FixedExpense[];
}>();

// Fetch categories
const { data: categoriesData } = await useFetch<{
  categories: TransactionCategory[];
}>("/api/categories");

const categories = computed(() => categoriesData.value?.categories || []);

// Fetch 3-month spending averages per category to pre-fill allocations
const { data: averagesData } = await useFetch<{
  suggestions: Array<{ categoryId: string; suggestedAmount: number }>;
}>("/api/transactions/category-averages", {
  query: {
    periodStart: computed(() => props.periodStart.toISOString()),
    period: computed(() => props.budgetPeriod),
  },
});

// Normalize any frequency to a monthly amount (in cents)
const normalizeToMonthly = (amountCents: number, frequency: string): number => {
  switch (frequency) {
    case "WEEKLY":
      return Math.round(amountCents * 4.33);
    case "FORTNIGHTLY":
      return Math.round(amountCents * 2.17);
    case "QUARTERLY":
      return Math.round(amountCents / 3);
    case "YEARLY":
      return Math.round(amountCents / 12);
    case "MONTHLY":
    default:
      return amountCents;
  }
};

// Sum of fixed expenses per category (normalized to monthly, in cents)
const fixedExpensesByCategory = computed(() => {
  const map = new Map<string, number>();
  props.fixedExpenseItems.forEach((expense) => {
    if (expense.categoryId) {
      const monthlyAmount = normalizeToMonthly(
        expense.amount,
        expense.frequency,
      );
      const current = map.get(expense.categoryId) || 0;
      map.set(expense.categoryId, current + monthlyAmount);
    }
  });
  return map;
});

// Track which categories have allocations
const allocatedCategoryIds = computed(
  () => new Set(modelValue.value.map((a) => a.categoryId)),
);

const unallocatedCategories = computed(() =>
  categories.value.filter((c) => !allocatedCategoryIds.value.has(c.id)),
);

// Allocation amounts per category (in dollars for editing)
const allocationAmounts = reactive<Record<string, number>>({});

// Initialize amounts from model
watch(
  modelValue,
  (items) => {
    items.forEach((item) => {
      if (!(item.categoryId in allocationAmounts)) {
        allocationAmounts[item.categoryId] = item.allocatedAmount / 100;
      }
    });
  },
  { immediate: true },
);

// Build a lookup map from categoryId → suggestedAmount (cents) for use in addAllocation
const suggestedAmounts = computed(() => {
  const map = new Map<string, number>();
  for (const s of averagesData.value?.suggestions ?? []) {
    map.set(s.categoryId, s.suggestedAmount);
  }
  return map;
});

const addAllocation = (categoryId: string) => {
  const suggestedAmount = suggestedAmounts.value.get(categoryId) ?? 0;
  const allocation: CategoryAllocation = {
    id: nanoid(),
    budgetId: "",
    categoryId,
    allocatedAmount: suggestedAmount,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  modelValue.value.push(allocation);
  allocationAmounts[categoryId] = suggestedAmount / 100;
};

const removeAllocation = (categoryId: string) => {
  const index = modelValue.value.findIndex((a) => a.categoryId === categoryId);
  if (index !== -1) {
    modelValue.value.splice(index, 1);
    delete allocationAmounts[categoryId];
  }
};

const updateAmount = (categoryId: string, amount: number) => {
  allocationAmounts[categoryId] = amount;
  const allocation = modelValue.value.find((a) => a.categoryId === categoryId);
  if (allocation) {
    allocation.allocatedAmount = Math.round(amount * 100);
  }
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
};

const getCategoryById = (id: string) => {
  return categories.value.find((c) => c.id === id);
};

const totalAllocations = computed(() =>
  modelValue.value.reduce((sum, a) => sum + a.allocatedAmount, 0),
);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Category Allocations</h2>
      <p class="text-muted mt-1">
        Set budget limits for your spending categories like groceries,
        entertainment, etc.
      </p>
    </div>

    <!-- Allocated Categories -->
    <div v-if="modelValue.length > 0" class="space-y-4">
      <!-- Mobile: Stacked cards -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="allocation in modelValue"
          :key="allocation.id"
          class="border rounded-lg p-3"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <span
                class="w-3 h-3 rounded-full shrink-0"
                :style="{
                  backgroundColor: getCategoryById(allocation.categoryId)
                    ?.color,
                }"
              ></span>
              <span class="font-medium">{{
                getCategoryById(allocation.categoryId)?.name
              }}</span>
            </div>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click="removeAllocation(allocation.categoryId)"
            />
          </div>
          <div
            class="flex items-center justify-between gap-3 text-sm text-muted mb-2"
          >
            <span>Fixed expenses</span>
            <span>{{
              formatCurrency(
                fixedExpensesByCategory.get(allocation.categoryId) || 0,
              )
            }}</span>
          </div>
          <div>
            <label class="text-sm text-muted block mb-1">Allocation</label>
            <UInput
              :model-value="allocationAmounts[allocation.categoryId]"
              type="number"
              min="0"
              step="0.01"
              @update:model-value="
                updateAmount(allocation.categoryId, $event as number)
              "
            >
              <template #leading>
                <span class="text-muted text-sm">$</span>
              </template>
            </UInput>
          </div>
        </div>
      </div>

      <!-- Desktop: Table -->
      <div class="border rounded-lg overflow-hidden hidden md:block">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-2 text-left text-sm font-medium">Category</th>
              <th class="px-4 py-2 text-right text-sm font-medium">
                Fixed Expenses
              </th>
              <th class="px-4 py-2 text-left text-sm font-medium">
                Allocation
              </th>
              <th class="px-4 py-2 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="allocation in modelValue" :key="allocation.id">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :style="{
                      backgroundColor: getCategoryById(allocation.categoryId)
                        ?.color,
                    }"
                  ></span>
                  <span>{{
                    getCategoryById(allocation.categoryId)?.name
                  }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-right">
                <span class="text-sm text-muted">
                  {{
                    formatCurrency(
                      fixedExpensesByCategory.get(allocation.categoryId) || 0,
                    )
                  }}
                </span>
              </td>
              <td class="px-4 py-3">
                <UInput
                  :model-value="allocationAmounts[allocation.categoryId]"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-32"
                  @update:model-value="
                    updateAmount(allocation.categoryId, $event as number)
                  "
                >
                  <template #leading>
                    <span class="text-muted text-sm">$</span>
                  </template>
                </UInput>
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  @click="removeAllocation(allocation.categoryId)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
        <span class="font-medium">Total Allocations:</span>
        <span class="text-lg font-bold">
          {{ formatCurrency(totalAllocations) }}
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 border rounded-lg border-dashed">
      <p class="text-muted">No category allocations yet.</p>
      <p class="text-sm text-muted mt-1">
        Add categories to set spending limits.
      </p>
    </div>

    <!-- Add Category Button -->
    <div v-if="unallocatedCategories.length > 0">
      <label class="text-sm font-medium block mb-2">Add Category</label>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="category in unallocatedCategories"
          :key="category.id"
          size="sm"
          variant="outline"
          @click="addAllocation(category.id)"
        >
          <span
            class="w-2 h-2 rounded-full mr-1"
            :style="{ backgroundColor: category.color }"
          ></span>
          {{ category.name }}
        </UButton>
      </div>
    </div>

    <div
      v-else-if="categories.length === 0"
      class="p-4 bg-warning/10 rounded-lg"
    >
      <p class="text-sm text-warning">
        You don't have any categories yet. Create some categories first to
        allocate budgets.
      </p>
    </div>
  </div>
</template>
