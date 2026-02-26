<script setup lang="ts">
import { useQuery } from "zero-vue";
import { createReusableTemplate } from "@vueuse/core";
import { nanoid } from "nanoid";
import { queries } from "~/db/zero-queries";

const [DefineCreateFormTemplate, ReuseCreateFormTemplate] =
  createReusableTemplate();
const isDesktop = useSSRMediaQuery("(min-width: 768px)");

definePageMeta({ layout: "default" });

const z = useZero();
const showCreateModal = ref(false);
const isCreating = ref(false);

// Form state
const formData = reactive({
  name: "",
  color: "#3b82f6",
  description: "",
});

const { data: categories } = useQuery(
  z,
  () => queries.categories.list({ userID: z.userID }),
);

// Compute transaction counts per category from Zero
const { data: allTransactions } = useQuery(
  z,
  () => queries.transactions.all({ userID: z.userID }),
);

const transactionCountByCategory = computed(() => {
  const counts = new Map<string, number>();
  for (const t of allTransactions.value) {
    if (t.categoryId) {
      counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    }
  }
  return counts;
});

const categoriesWithCounts = computed(() =>
  categories.value.map((cat) => ({
    ...cat,
    transactionCount: transactionCountByCategory.value.get(cat.id) ?? 0,
  })),
);

const resetForm = () => {
  formData.name = "";
  formData.color = "#3b82f6";
  formData.description = "";
};

const createCategory = async () => {
  if (!formData.name.trim()) return;

  isCreating.value = true;
  try {
    const now = Date.now();
    await z.mutate.categories.create({
      id: nanoid(),
      name: formData.name.trim(),
      color: formData.color,
      description: formData.description || null,
      createdAt: now,
      updatedAt: now,
    });

    resetForm();
    showCreateModal.value = false;
  } catch (error) {
    console.error("Failed to create category:", error);
  } finally {
    isCreating.value = false;
  }
};
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Categories" />
    </template>

    <template #body>
      <div class="space-y-6">
        <div>
          <p class="text-muted">
            Manage your transaction categories. Categories help organize and
            track your spending.
          </p>
        </div>

        <!-- Empty State -->
        <div
          v-if="categories.length === 0"
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
            v-for="category in categoriesWithCounts"
            :key="category.id"
            :category="category"
            :transaction-count="category.transactionCount"
          />
        </div>

        <!-- Reusable template for modal/drawer content -->
        <DefineCreateFormTemplate>
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
              <ColorSwatchPicker v-model="formData.color" />
            </div>

            <UTextarea
              v-model="formData.description"
              label="Description (optional)"
              placeholder="What is this category for?"
            />
          </div>
        </DefineCreateFormTemplate>

        <!-- Desktop: Modal -->
        <UModal
          v-if="isDesktop"
          v-model:open="showCreateModal"
          title="Create Category"
        >
          <UButton icon="i-lucide-plus" @click="showCreateModal = true">
            Create Category
          </UButton>

          <template #body>
            <ReuseCreateFormTemplate />
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

        <!-- Mobile: Drawer -->
        <UDrawer v-else v-model:open="showCreateModal" title="Create Category">
          <UButton icon="i-lucide-plus" @click="showCreateModal = true">
            Create Category
          </UButton>

          <template #body>
            <ReuseCreateFormTemplate />
          </template>

          <template #footer>
            <UButton
              color="neutral"
              variant="outline"
              @click="showCreateModal = false"
              class="justify-center"
            >
              Cancel
            </UButton>
            <UButton
              :loading="isCreating"
              @click="createCategory"
              class="justify-center"
            >
              Create
            </UButton>
          </template>
        </UDrawer>
      </div>
    </template>
  </UDashboardPanel>
</template>
