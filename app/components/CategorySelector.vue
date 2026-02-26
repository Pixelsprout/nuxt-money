<script setup lang="ts">
import type { TransactionCategory } from "#db/schema";
import { createReusableTemplate } from "@vueuse/core";
import { nanoid } from "nanoid";

const [DefineCreateCategoryTemplate, ReuseCreateCategoryTemplate] =
  createReusableTemplate();
const isDesktop = useSSRMediaQuery("(min-width: 768px)");

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
const z = useZero();
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

// Check if we should show the "Create category" option
const showCreateOption = computed(() => {
  if (!searchTerm.value.trim()) return false;
  const searchLower = searchTerm.value.toLowerCase();
  return !props.categories.some((c) =>
    c.name.toLowerCase().includes(searchLower),
  );
});

// Transform categories for USelectMenu - returns full objects
const categoryOptions = computed(() => {
  const options = props.categories.map((c) => ({
    label: c.name,
    value: c.id,
    color: c.color || "#64748b",
  }));

  // Add "Create category" option if search doesn't match any category
  if (showCreateOption.value) {
    options.unshift({
      label: `Create "${searchTerm.value}"`,
      value: "__create__",
      color: "#64748b",
    });
  }

  return options;
});

// The selected category ID for v-model
const selectedCategoryId = computed({
  get: () => props.modelValue ?? undefined,
  set: (categoryId: string | null | undefined) => {
    if (!categoryId) return;

    // Handle the "Create category" option
    if (categoryId === "__create__") {
      openCreateModal();
      return;
    }

    if (categoryId === props.modelValue) return;

    updateTransactionCategory(categoryId);
  },
});

// Update transaction category
const updateTransactionCategory = async (
  categoryId: string,
  showToast = true,
) => {
  loading.value = true;

  try {
    await z.mutate.transactions.assignCategory({
      transactionId: props.transactionId,
      categoryId,
    });

    emit("update:modelValue", categoryId);
    emit("updated");

    if (showToast) {
      toast.add({
        title: "Category updated",
        color: "success",
        icon: "i-lucide-check-circle",
      });
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
    const now = Date.now();
    const newId = nanoid();

    await z.mutate.categories.create({
      id: newId,
      name: newCategoryName.value.trim(),
      color: newCategoryColor.value,
      createdAt: now,
      updatedAt: now,
    });

    toast.add({
      title: "Category created and assigned",
      color: "success",
      icon: "i-lucide-check-circle",
    });

    showCreateModal.value = false;
    newCategoryName.value = "";
    searchTerm.value = "";

    emit("created");

    // Assign the new category to this transaction (without showing another toast)
    await updateTransactionCategory(newId, false);
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
  <div>
    <USelectMenu
      v-model="selectedCategoryId"
      v-model:search-term="searchTerm"
      :items="categoryOptions"
      :loading="loading"
      :disabled="loading"
      placeholder="Unassigned"
      value-key="value"
      :ui="{ content: 'min-w-fit' }"
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

    <!-- Reusable template for modal/drawer content -->
    <DefineCreateCategoryTemplate>
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
          <ColorSwatchPicker v-model="newCategoryColor" />
        </div>
      </div>
    </DefineCreateCategoryTemplate>

    <!-- Desktop: Modal -->
    <UModal
      v-if="isDesktop"
      v-model:open="showCreateModal"
      title="Create New Category"
    >
      <template #body>
        <ReuseCreateCategoryTemplate />
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

    <!-- Mobile: Drawer -->
    <UDrawer v-else v-model:open="showCreateModal" title="Create New Category">
      <template #body>
        <ReuseCreateCategoryTemplate />
      </template>

      <template #footer>
        <UButton
          variant="ghost"
          color="neutral"
          @click="showCreateModal = false"
          :disabled="loading"
          class="justify-center"
        >
          Cancel
        </UButton>
        <UButton
          icon="i-lucide-plus"
          :loading="loading"
          @click="handleCreate"
          class="justify-center"
        >
          Create Category
        </UButton>
      </template>
    </UDrawer>
  </div>
</template>
