<script setup lang="ts">
import type { CategoryAllocation, TransactionCategory } from "#db/schema";
import { nanoid } from "nanoid";

const modelValue = defineModel<CategoryAllocation[]>({ required: true });

const props = defineProps<{
  budgetPeriod: "MONTHLY" | "QUARTERLY" | "YEARLY";
  periodStart: Date;
}>();

// Fetch categories
const { data: categoriesData } = await useFetch<{
  categories: TransactionCategory[];
}>("/api/categories");

const categories = computed(() => categoriesData.value?.categories || []);

// Track which categories have allocations
const allocatedCategoryIds = computed(
  () => new Set(modelValue.value.map((a) => a.categoryId))
);

const unallocatedCategories = computed(() =>
  categories.value.filter((c) => !allocatedCategoryIds.value.has(c.id))
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
  { immediate: true }
);

const addAllocation = (categoryId: string) => {
  const allocation: CategoryAllocation = {
    id: nanoid(),
    budgetId: "",
    categoryId,
    allocatedAmount: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  modelValue.value.push(allocation);
  allocationAmounts[categoryId] = 0;
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
  modelValue.value.reduce((sum, a) => sum + a.allocatedAmount, 0)
);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Category Allocations</h2>
      <p class="text-muted mt-1">
        Set budget limits for your spending categories like groceries, entertainment, etc.
      </p>
    </div>

    <!-- Allocated Categories -->
    <div v-if="modelValue.length > 0" class="space-y-4">
      <div class="border rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-2 text-left text-sm font-medium">Category</th>
              <th class="px-4 py-2 text-left text-sm font-medium">Budget Amount</th>
              <th class="px-4 py-2 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="allocation in modelValue" :key="allocation.id">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    :style="{ backgroundColor: getCategoryById(allocation.categoryId)?.color }"
                  ></span>
                  <span>{{ getCategoryById(allocation.categoryId)?.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <UInput
                  :model-value="allocationAmounts[allocation.categoryId]"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-32"
                  @update:model-value="updateAmount(allocation.categoryId, $event as number)"
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

    <div v-else-if="categories.length === 0" class="p-4 bg-warning/10 rounded-lg">
      <p class="text-sm text-warning">
        You don't have any categories yet. Create some categories first to allocate budgets.
      </p>
    </div>
  </div>
</template>
