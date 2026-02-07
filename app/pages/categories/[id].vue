<script setup lang="ts">
import type { TransactionCategory, AkahuTransaction } from "#db/schema";
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";

const UBadge = resolveComponent("UBadge");

definePageMeta({ layout: "default" });

const route = useRoute();
const categoryId = route.params.id as string;

// Define columns without the category column
const transactionColumns: TableColumn<AkahuTransaction>[] = [
  {
    accessorKey: "date",
    header: "Date",
    size: 120,
    cell: ({ row }) => {
      return new Date(row.getValue("date")).toLocaleDateString("en-NZ", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    size: 300,
    cell: ({ row }) => {
      return h(
        "div",
        { class: "text-ellipsis overflow-hidden max-w-64" },
        row.getValue("description"),
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    size: 120,
    cell: ({ row }) => {
      const amount = row.getValue("amount") as any;
      const value = amount?.value || 0;
      const type = row.original.type;

      return h(
        "span",
        {
          class: type === "CREDIT" ? "text-success" : "text-error",
        },
        new Intl.NumberFormat("en-NZ", {
          style: "currency",
          currency: "NZD",
        }).format(value),
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    size: 100,
    cell: ({ row }) => {
      const type = row.getValue("type") as string | null;
      if (!type) return "-";

      return h(
        UBadge,
        {
          color: type === "CREDIT" ? "success" : "error",
          variant: "subtle",
          class: "capitalize",
        },
        () => type,
      );
    },
  },
];

// State
const editMode = ref(false);
const editedCategory = ref<{
  name: string;
  color: string;
  description: string;
}>({
  name: "",
  color: "#000000",
  description: "",
});
const saving = ref(false);

// Fetch category details
const {
  data: categoryData,
  pending: categoryPending,
  error: categoryError,
  refresh: refreshCategory,
} = await useFetch<{
  category: TransactionCategory;
  transactionCount: number;
}>(`/api/categories/${categoryId}`, {
  credentials: "include",
});

const category = computed(() => categoryData.value?.category);
const transactionCount = computed(
  () => categoryData.value?.transactionCount || 0,
);

// Fetch transactions for this category
const { data: transactionsData, pending: transactionsPending } =
  await useFetch<{
    success: boolean;
    transactions: AkahuTransaction[];
  }>(`/api/categories/${categoryId}/transactions`, {
    credentials: "include",
  });

const transactions = computed(() => transactionsData.value?.transactions || []);

// Watch for when category data is loaded and check if it exists
watch(
  () => categoryData.value,
  (data) => {
    if (data && !category.value) {
      throw createError({
        statusCode: 404,
        message: "Category not found",
      });
    }
    // Initialize editedCategory when category data loads
    if (category.value) {
      editedCategory.value = {
        name: category.value.name,
        color: category.value.color,
        description: category.value.description || "",
      };
    }
  },
  { immediate: true },
);

const handleDeleted = async () => {
  await navigateTo("/categories");
};

const handleEdit = () => {
  editMode.value = true;
};

const cancelEdit = () => {
  editMode.value = false;
  // Reset edited category to current values
  if (category.value) {
    editedCategory.value = {
      name: category.value.name,
      color: category.value.color,
      description: category.value.description || "",
    };
  }
};

const saveChanges = async () => {
  if (!editedCategory.value.name.trim()) {
    alert("Category name is required");
    return;
  }

  saving.value = true;
  try {
    await $fetch(`/api/categories/${categoryId}`, {
      method: "PATCH",
      body: {
        name: editedCategory.value.name,
        color: editedCategory.value.color,
        description: editedCategory.value.description,
      },
    });

    // Update category data
    if (categoryData.value?.category) {
      categoryData.value.category = {
        ...categoryData.value.category,
        name: editedCategory.value.name,
        color: editedCategory.value.color,
        description: editedCategory.value.description,
        updatedAt: new Date(),
      };
    }

    editMode.value = false;
    await refreshCategory();
  } catch (error) {
    console.error("Failed to save category:", error);
    alert("Failed to save category. Please try again.");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="category?.name || 'Category'">
        <template #left>
          <UButton
            icon="i-lucide-arrow-left"
            variant="ghost"
            color="neutral"
            to="/categories"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading State -->
      <div v-if="categoryPending" class="text-center py-12">
        <p class="text-muted">Loading category...</p>
      </div>

      <!-- Content -->
      <div v-else-if="category" class="space-y-6">
        <!-- Category Header -->
        <CategoryHeader
          :category="category"
          :transaction-count="transactionCount"
          @deleted="handleDeleted"
          @edit="handleEdit"
        />

        <!-- Edit Form Section -->
        <div v-if="editMode" class="border rounded-lg p-6 space-y-4">
          <h2 class="text-xl font-bold">Edit Category</h2>

          <div class="space-y-4">
            <!-- Name Input -->
            <div>
              <label class="block text-sm font-medium mb-2">Name</label>
              <UInput
                v-model="editedCategory.name"
                placeholder="Category name"
              />
            </div>

            <!-- Color Picker -->
            <div>
              <label class="block text-sm font-medium mb-2">Color</label>
              <div class="flex items-center gap-3">
                <input
                  v-model="editedCategory.color"
                  type="color"
                  class="w-12 h-12 rounded cursor-pointer"
                />
                <span class="text-sm text-muted">{{
                  editedCategory.color
                }}</span>
              </div>
            </div>

            <!-- Description Textarea -->
            <div>
              <label class="block text-sm font-medium mb-2">Description</label>
              <UTextarea
                v-model="editedCategory.description"
                placeholder="Category description (optional)"
                rows="3"
              />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2 justify-end pt-4">
            <UButton variant="outline" color="neutral" @click="cancelEdit">
              Cancel
            </UButton>
            <UButton :loading="saving" @click="saveChanges">
              Save Changes
            </UButton>
          </div>
        </div>

        <!-- Transaction Section -->
        <div class="space-y-4">
          <h2 class="text-xl font-bold">
            Transactions using this category ({{ transactionCount }})
          </h2>

          <div v-if="transactionsPending" class="text-center py-8">
            <p class="text-muted">Loading transactions...</p>
          </div>

          <div v-else-if="transactions.length > 0">
            <TransactionTable
              :transactions="transactions"
              :columns="transactionColumns"
            />
          </div>

          <div v-else class="text-center py-8 border rounded-lg bg-elevated/50">
            <p class="text-muted">No transactions in this category</p>
          </div>
        </div>
      </div>

      <!-- Error/Not Found State -->
      <div v-else class="text-center py-12">
        <p class="text-muted">Category not found</p>
        <UButton
          class="mt-4"
          icon="i-lucide-arrow-left"
          variant="outline"
          color="neutral"
          to="/categories"
        >
          Back to Categories
        </UButton>
      </div>
    </template>
  </UDashboardPanel>
</template>
