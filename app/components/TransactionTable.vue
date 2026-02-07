<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { AkahuTransaction, TransactionCategory } from "#db/schema";
import type { TableColumn } from "@nuxt/ui";
import { useDebounceFn } from "@vueuse/core";

const UBadge = resolveComponent("UBadge");
const CategorySelector = resolveComponent("CategorySelector");

const props = defineProps<{
  accountId: string;
}>();

const searchTerm = ref("");
const typeFilter = ref<"ALL" | "DEBIT" | "CREDIT">("ALL");
const loading = ref(false);

// Fetch all transactions
const {
  data: transactionsData,
  refresh,
  pending,
} = await useFetch<{
  success: boolean;
  transactions: AkahuTransaction[];
  total: number;
}>(`/api/transactions/${props.accountId}`, {
  key: `transactions-${props.accountId}`,
});

const allTransactions = computed<AkahuTransaction[]>(() => {
  return transactionsData.value?.transactions || [];
});

// Fetch categories
const { data: categoriesData, refresh: refreshCategories } = await useFetch<{
  success: boolean;
  categories: TransactionCategory[];
}>("/api/categories", {
  credentials: "include",
});

const categories = computed(() => categoriesData.value?.categories || []);

// Update loading state
watch(pending, (isPending) => {
  loading.value = isPending;
});

// Debounced search
const debouncedSearch = ref("");
const updateSearch = useDebounceFn((value: string) => {
  debouncedSearch.value = value;
}, 300);

watch(searchTerm, (newValue) => {
  updateSearch(newValue);
});

// Filtered transactions based on search and type filter
const filteredTransactions = computed(() => {
  let filtered = allTransactions.value;

  // Apply search filter
  if (debouncedSearch.value) {
    const search = debouncedSearch.value.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.description.toLowerCase().includes(search) ||
        t.merchant?.toLowerCase().includes(search) ||
        t.category?.toLowerCase().includes(search),
    );
  }

  // Apply type filter
  if (typeFilter.value !== "ALL") {
    filtered = filtered.filter((t) => t.type === typeFilter.value);
  }

  return filtered;
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(value);
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getTypeColor = (type: string | null) => {
  if (type === "CREDIT") {
    return "success";
  }
  return "error";
};

// Table columns
const columns: TableColumn<AkahuTransaction>[] = [
  {
    accessorKey: "date",
    header: "Date",
    size: 120,
    cell: ({ row }) => {
      return formatDate(row.getValue("date"));
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
        formatCurrency(value),
      );
    },
  },
  {
    accessorKey: "categoryId",
    header: "Category",
    size: 200,
    cell: ({ row }) => {
      const transaction = row.original;

      return h(CategorySelector, {
        modelValue: transaction.categoryId,
        categories: categories.value,
        transactionId: transaction.id,
        onCreated: async () => {
          await refreshCategories();
        },
        onUpdated: async () => {
          await refresh();
        },
      });
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
          color: getTypeColor(type),
          variant: "subtle",
          class: "capitalize",
        },
        () => type,
      );
    },
  },
];

defineExpose({ refresh });
</script>

<template>
  <div class="space-y-4">
    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-4">
      <UInput
        v-model="searchTerm"
        placeholder="Search transactions..."
        icon="i-lucide-search"
        class="flex-1"
      />

      <div class="flex gap-2">
        <UButton
          :variant="typeFilter === 'ALL' ? 'solid' : 'outline'"
          color="neutral"
          @click="typeFilter = 'ALL'"
        >
          All
        </UButton>
        <UButton
          :variant="typeFilter === 'DEBIT' ? 'solid' : 'outline'"
          color="neutral"
          @click="typeFilter = 'DEBIT'"
        >
          Debits
        </UButton>
        <UButton
          :variant="typeFilter === 'CREDIT' ? 'solid' : 'outline'"
          color="neutral"
          @click="typeFilter = 'CREDIT'"
        >
          Credits
        </UButton>
      </div>
    </div>

    <!-- Results count -->
    <div class="text-sm text-muted">
      Showing {{ filteredTransactions.length }} of
      {{ allTransactions.length }} transactions
    </div>

    <!-- Table with virtualization -->
    <div class="overflow-x-auto">
      <UTable
        :data="filteredTransactions"
        :columns="columns"
        :loading="loading"
        class="min-w-full table-fixed border-separate border-spacing-0"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
        }"
      >
        <template #empty>
          <div class="text-center py-12">
            <p class="text-muted">No transactions found</p>
            <p class="text-sm text-muted mt-2">
              Try syncing transactions or adjusting your filters
            </p>
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
