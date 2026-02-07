<script setup lang="ts">
import type { TransactionCategory } from "#db/schema";

const props = defineProps<{
  modelValue: string | null;
  categories: TransactionCategory[];
  transactionId: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
  created: [];
  updated: [];
}>();

const toast = useToast();
const loading = ref(false);
const showCreateModal = ref(false);
const newCategoryName = ref("");
const newCategoryColor = ref("#64748b"); // Default neutral gray
const searchTerm = ref("");

// Find the current category object based on selected ID
const selectedCategory = computed(() => {
  if (!props.modelValue) return null;
  return props.categories.find((c) => c.id === props.modelValue) || null;
});

// Transform categories for USelectMenu - returns full objects
const categoryOptions = computed(() => {
  return props.categories.map((c) => ({
    label: c.name,
    value: c.id,
    color: c.color || "#64748b",
  }));
});

// The selected category ID for v-model
const selectedCategoryId = computed({
  get: () => props.modelValue,
  set: async (categoryId: string | null) => {
    if (!categoryId || categoryId === props.modelValue) return;

    await updateTransactionCategory(categoryId);
  },
});

// Update transaction category
const updateTransactionCategory = async (
  categoryId: string,
  showToast = true,
) => {
  loading.value = true;

  try {
    const response = await $fetch<{
      success: boolean;
    }>(`/api/transactions/${props.transactionId}/category`, {
      method: "PATCH",
      body: {
        categoryId,
      },
    });

    if (response.success) {
      emit("update:modelValue", categoryId);
      emit("updated");

      if (showToast) {
        toast.add({
          title: "Category updated",
          color: "success",
          icon: "i-lucide-check-circle",
        });
      }
    }
  } catch (error: any) {
    console.error("Failed to update category:", error);
    toast.add({
      title: "Failed to update category",
      description: error.message || "Please try again",
      color: "error",
      icon: "i-lucide-alert-circle",
    });
  } finally {
    loading.value = false;
  }
};

// Open the create modal with prefilled search term
const openCreateModal = () => {
  newCategoryName.value = searchTerm.value;
  newCategoryColor.value = "#64748b"; // Default neutral gray
  showCreateModal.value = true;
};

// Handle creating new category from modal
const handleCreate = async () => {
  if (!newCategoryName.value.trim()) {
    toast.add({
      title: "Category name is required",
      color: "error",
      icon: "i-lucide-alert-circle",
    });
    return;
  }

  loading.value = true;

  try {
    const response = await $fetch<{
      success: boolean;
      category: TransactionCategory;
    }>("/api/categories/create", {
      method: "POST",
      body: {
        name: newCategoryName.value.trim(),
        color: newCategoryColor.value,
      },
    });

    if (response.success) {
      toast.add({
        title: "Category created and assigned",
        color: "success",
        icon: "i-lucide-check-circle",
      });

      // Close modal
      showCreateModal.value = false;
      newCategoryName.value = "";
      searchTerm.value = "";

      // Emit created event so parent can refresh categories
      emit("created");

      // Assign the new category to this transaction (without showing another toast)
      await updateTransactionCategory(response.category.id, false);
    }
  } catch (error: any) {
    console.error("Failed to create category:", error);
    toast.add({
      title: "Failed to create category",
      description: error.message || "Please try again",
      color: "error",
      icon: "i-lucide-alert-circle",
    });
    loading.value = false;
  }
};
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <USelectMenu
      v-model="selectedCategoryId"
      v-model:search-term="searchTerm"
      :items="categoryOptions"
      :loading="loading"
      :disabled="loading"
      placeholder="Unassigned"
      value-key="value"
    >
      <template #default>
        <UBadge
          v-if="selectedCategory"
          size="sm"
          :style="{
            backgroundColor: selectedCategory.color || '#64748b',
            color: 'white',
          }"
        >
          {{ selectedCategory.name }}
        </UBadge>
        <UBadge v-else color="warning" variant="soft" size="sm">
          Unassigned
        </UBadge>
      </template>
      <template #item-label="{ item }">
        <UBadge
          size="sm"
          :style="{ backgroundColor: item.color, color: 'white' }"
        >
          {{ item.label }}
        </UBadge>
      </template>
    </USelectMenu>

    <UButton
      icon="i-lucide-plus"
      size="xs"
      color="neutral"
      variant="ghost"
      @click="openCreateModal"
      title="Create new category"
    />

    <UModal v-model:open="showCreateModal" title="Create New Category">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Category Name</label>
            <UInput
              v-model="newCategoryName"
              placeholder="e.g., Groceries"
              :disabled="loading"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Color</label>
            <div class="flex items-center gap-3">
              <UColorPicker v-model="newCategoryColor" />
              <UBadge
                size="sm"
                :style="{ backgroundColor: newCategoryColor, color: 'white' }"
              >
                Preview
              </UBadge>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            @click="showCreateModal = false"
            :disabled="loading"
          >
            Cancel
          </UButton>
          <UButton
            icon="i-lucide-plus"
            :loading="loading"
            @click="handleCreate"
          >
            Create Category
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
