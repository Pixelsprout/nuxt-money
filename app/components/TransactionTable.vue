<script setup lang="ts">
import { h, resolveComponent } from "vue";
import { useQuery } from "zero-vue";
import type { AkahuTransaction } from "#db/schema";
import type { TableColumn } from "@nuxt/ui";
import { useDebounceFn } from "@vueuse/core";
import { queries } from "~/db/zero-queries";

const UBadge = resolveComponent("UBadge");
const CategorySelector = resolveComponent("CategorySelector");

const props = defineProps<{
  accountId?: string;
  transactions?: AkahuTransaction[];
  columns?: TableColumn<AkahuTransaction>[];
  budgetId?: string;
}>();

const z = useZero();
const searchTerm = ref("");
const typeFilter = ref<"ALL" | "DEBIT" | "CREDIT">("ALL");

// Income tagging modal state
const incomeTagModalOpen = ref(false);
const selectedTransactionForTagging = ref<AkahuTransaction | null>(null);

function openIncomeTagModal(transaction: AkahuTransaction) {
  selectedTransactionForTagging.value = transaction;
  incomeTagModalOpen.value = true;
}

function handleIncomeTagged() {
  // Zero replicates changes automatically — no manual refresh needed
}

// Fetch transactions from Zero if accountId provided
const { data: accountTransactions } = useQuery(
  z,
  () =>
    props.accountId
      ? queries.transactions.byAccount(
          { accountId: props.accountId },
          { userID: z.userID },
        )
      : queries.transactions.all({ userID: z.userID }),
);

const allTransactions = computed<AkahuTransaction[]>(() => {
  if (props.transactions) return props.transactions as AkahuTransaction[];
  return accountTransactions.value as AkahuTransaction[];
});

// Fetch categories from Zero
const { data: categories } = useQuery(
  z,
  () => queries.categories.list({ userID: z.userID }),
);

// Debounced search
const debouncedSearch = ref("");
const updateSearch = useDebounceFn((value: string) => {
  debouncedSearch.value = value;
}, 300);

watch(searchTerm, (newValue) => {
  updateSearch(newValue);
});

const filteredTransactions = computed(() => {
  let filtered = allTransactions.value;

  if (debouncedSearch.value) {
    const search = debouncedSearch.value.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.description.toLowerCase().includes(search) ||
        t.merchant?.toLowerCase().includes(search) ||
        (t.category as string | null)?.toLowerCase().includes(search),
    );
  }

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
  if (type === "CREDIT") return "success";
  return "error";
};

// Default table columns
const defaultColumns: TableColumn<AkahuTransaction>[] = [
  {
    accessorKey: "date",
    header: "Date",
    size: 120,
    cell: ({ row }) => formatDate(row.getValue("date")),
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
        { class: type === "CREDIT" ? "text-success" : "text-error" },
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
        onUpdated: async () => {
          // Zero replicates — no manual refresh needed
        },
      });
    },
  },
  {
    accessorKey: "income",
    header: "Income",
    size: 150,
    cell: ({ row }) => {
      const transaction = row.original;
      const UButton = resolveComponent("UButton");

      if (!props.budgetId || transaction.type !== "CREDIT") {
        return "-";
      }

      return h(
        UButton,
        {
          size: "xs",
          variant: "outline",
          color: "primary",
          onClick: () => openIncomeTagModal(transaction),
        },
        () => "Tag Income",
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
          color: getTypeColor(type),
          variant: "subtle",
          class: "capitalize",
        },
        () => type,
      );
    },
  },
];

const tableColumns = computed(() => props.columns || defaultColumns);
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

    <!-- Table -->
    <div class="overflow-x-auto">
      <UTable
        :data="filteredTransactions"
        :columns="tableColumns"
        virtualize
        class="min-w-full table-fixed border-separate border-spacing-0 h-[600px]"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
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

    <!-- Income Tagging Modal -->
    <TransactionIncomeTagModal
      v-if="selectedTransactionForTagging && budgetId"
      :transaction="selectedTransactionForTagging"
      :budget-id="budgetId"
      :open="incomeTagModalOpen"
      @update:open="incomeTagModalOpen = $event"
      @tagged="handleIncomeTagged"
    />
  </div>
</template>
