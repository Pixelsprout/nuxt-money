<script setup lang="ts">
import type { TransactionCategory } from "#db/schema";

definePageMeta({ layout: "default" });

const showCreateModal = ref(false);
const isCreating = ref(false);
const loading = ref(false);

// Form state
const formData = reactive({
  name: "",
  color: "#3b82f6",
  description: "",
});

const { data: categoriesData, refresh } = await useFetch<{
  success: boolean;
  categories: TransactionCategory[];
}>("/api/categories");

const categoriesWithCounts = ref<
  Array<TransactionCategory & { transactionCount?: number }>
>([]);

const categories = computed<
  Array<TransactionCategory & { transactionCount?: number }>
>(() => {
  return categoriesWithCounts.value || [];
});

const refreshCategories = async () => {
  loading.value = true;
  try {
    await refresh();
    // Fetch transaction counts for each category
    if (categoriesData.value?.categories) {
      const categoriesWithData = await Promise.all(
        categoriesData.value.categories.map(async (category) => {
          try {
            const response = await $fetch<{
              success: boolean;
              category: TransactionCategory;
              transactionCount: number;
            }>(`/api/categories/${category.id}`);
            return {
              ...category,
              transactionCount: response.transactionCount,
            };
          } catch (error) {
            console.error(
              `Failed to fetch count for category ${category.id}:`,
              error,
            );
            return {
              ...category,
              transactionCount: 0,
            };
          }
        }),
      );
      categoriesWithCounts.value = categoriesWithData;
    }
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  formData.name = "";
  formData.color = "#3b82f6";
  formData.description = "";
};

const createCategory = async () => {
  if (!formData.name.trim()) {
    alert("Please enter a category name");
    return;
  }

  isCreating.value = true;
  try {
    await $fetch("/api/categories/create", {
      method: "POST",
      body: {
        name: formData.name,
        color: formData.color,
        description: formData.description || undefined,
      },
    });

    resetForm();
    showCreateModal.value = false;
    await refreshCategories();
  } catch (error) {
    console.error("Failed to create category:", error);
    alert("Failed to create category. Please try again.");
  } finally {
    isCreating.value = false;
  }
};

onMounted(() => {
  refreshCategories();
});
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Categories" />

    <UPageCard>
      <div class="space-y-6">
        <div>
          <p class="text-muted">
            Manage your transaction categories. Categories help organize and
            track your spending.
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-12 text-muted">
          Loading categories...
        </div>

        <!-- Empty State -->
        <div
          v-else-if="categories.length === 0"
          class="text-center py-12 space-y-4"
        >
          <div class="text-muted">
            <p class="text-lg">No categories yet</p>
            <p class="text-sm mt-2">
              Create your first category to start organizing your transactions
            </p>
          </div>
        </div>

        <!-- Categories Grid -->
        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <CategoryCard
            v-for="category in categories"
            :key="category.id"
            :category="category"
            :transaction-count="category.transactionCount"
            @deleted="refreshCategories"
          />
        </div>

        <!-- Create Category Modal -->
        <UModal v-model:open="showCreateModal" title="Create Category">
          <UButton icon="i-lucide-plus" @click="showCreateModal = true">
            Create Category
          </UButton>

          <template #body>
            <div class="space-y-4">
              <UInput
                v-model="formData.name"
                label="Name"
                placeholder="e.g., Groceries"
                required
                @keyup.enter="createCategory"
              />

              <div>
                <label class="text-sm font-medium block mb-2">Color</label>
                <input
                  v-model="formData.color"
                  type="color"
                  class="w-full h-10 rounded cursor-pointer"
                />
              </div>

              <UTextarea
                v-model="formData.description"
                label="Description (optional)"
                placeholder="What is this category for?"
              />
            </div>
          </template>

          <template #footer="{ close }">
            <div class="flex gap-2 justify-end">
              <UButton color="neutral" variant="outline" @click="close">
                Cancel
              </UButton>
              <UButton :loading="isCreating" @click="createCategory">
                Create
              </UButton>
            </div>
          </template>
        </UModal>
      </div>
    </UPageCard>
  </UDashboardPanel>
</template>
