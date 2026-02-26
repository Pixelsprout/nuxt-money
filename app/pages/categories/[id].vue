<script setup lang="ts">
import { useQuery } from "zero-vue";
import type { AkahuTransaction } from "#db/schema";
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import { createReusableTemplate } from "@vueuse/core";
import { queries } from "~/db/zero-queries";

const UBadge = resolveComponent("UBadge");

const [DefineEditFormTemplate, ReuseEditFormTemplate] =
  createReusableTemplate();
const isDesktop = useSSRMediaQuery("(min-width: 768px)");

definePageMeta({ layout: "default" });

const z = useZero();
const route = useRoute();
const categoryId = route.params.id as string;

// Define columns
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

// Zero queries
const { data: categories } = useQuery(
  z,
  () => queries.categories.list({ userID: z.userID }),
);
const { data: transactions } = useQuery(
  z,
  () => queries.transactions.byCategory({ categoryId }, { userID: z.userID }),
);

const category = computed(
  () => categories.value.find((c) => c.id === categoryId) ?? null,
);
const transactionCount = computed(() => transactions.value.length);

// State
const referencesModalOpen = ref(false);
const editMode = ref(false);
const editedCategory = reactive({
  name: "",
  color: "#000000",
  description: "",
});
const saving = ref(false);

// Sync editedCategory when category loads
watch(
  category,
  (cat) => {
    if (cat) {
      editedCategory.name = cat.name;
      editedCategory.color = cat.color;
      editedCategory.description = cat.description ?? "";
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
  if (category.value) {
    editedCategory.name = category.value.name;
    editedCategory.color = category.value.color;
    editedCategory.description = category.value.description ?? "";
  }
};

const saveChanges = async () => {
  if (!editedCategory.name.trim()) return;

  saving.value = true;
  try {
    await z.mutate.categories.update({
      id: categoryId,
      name: editedCategory.name.trim(),
      color: editedCategory.color,
      description: editedCategory.description || null,
      updatedAt: Date.now(),
    });
    editMode.value = false;
  } catch (error) {
    console.error("Failed to save category:", error);
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
      <!-- Content -->
      <div v-if="category" class="space-y-6">
        <!-- Category Header -->
        <CategoryHeader
          :category="category"
          :transaction-count="transactionCount"
          @deleted="handleDeleted"
          @edit="handleEdit"
        />

        <!-- Reusable template for modal/drawer content -->
        <DefineEditFormTemplate>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Name</label>
              <UInput
                v-model="editedCategory.name"
                placeholder="Category name"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Color</label>
              <ColorSwatchPicker v-model="editedCategory.color" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Description</label>
              <UTextarea
                v-model="editedCategory.description"
                placeholder="Category description (optional)"
                :rows="3"
              />
            </div>
          </div>
        </DefineEditFormTemplate>

        <!-- Desktop: Modal -->
        <UModal
          v-if="isDesktop"
          v-model:open="editMode"
          title="Edit Category"
          description="Update the name, colour, and description for this category."
          :ui="{ footer: 'justify-end' }"
        >
          <template #body>
            <ReuseEditFormTemplate />
          </template>
          <template #footer>
            <UButton variant="outline" color="neutral" @click="cancelEdit">
              Cancel
            </UButton>
            <UButton :loading="saving" @click="saveChanges">
              Save Changes
            </UButton>
          </template>
        </UModal>

        <!-- Mobile: Drawer -->
        <UDrawer v-else v-model:open="editMode" title="Edit Category">
          <template #body>
            <ReuseEditFormTemplate />
          </template>
          <template #footer>
            <UButton
              variant="outline"
              color="neutral"
              @click="cancelEdit"
              class="justify-center"
            >
              Cancel
            </UButton>
            <UButton
              :loading="saving"
              @click="saveChanges"
              class="justify-center"
            >
              Save Changes
            </UButton>
          </template>
        </UDrawer>

        <!-- Transaction References Modal -->
        <TransactionReferencesModal
          v-model:open="referencesModalOpen"
          :category-id="categoryId"
        />

        <!-- Transaction Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold">
              Transactions using this category ({{ transactionCount }})
            </h2>
            <UButton
              icon="i-lucide-settings-2"
              variant="outline"
              color="neutral"
              size="sm"
              @click="referencesModalOpen = true"
            >
              Transaction References
            </UButton>
          </div>

          <div v-if="transactions.length > 0">
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

      <!-- Not Found State -->
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
