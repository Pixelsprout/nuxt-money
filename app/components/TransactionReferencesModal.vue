<script setup lang="ts">
import { useQuery } from "zero-vue";
import type { TransactionReference, AmountCondition } from "#db/schema";
import type { TableColumn, SelectItem } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import { queries } from "~/db/zero-queries";

const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");

const props = defineProps<{
  categoryId: string;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const open = defineModel<boolean>("open", { default: false });
const toast = useToast();
const z = useZero();

// Fetch references from Zero
const { data: references } = useQuery(
  z,
  () =>
    queries.transactionReferences.byCategory(
      { categoryId: props.categoryId },
      { userID: z.userID },
    ),
);

// Edit state
const editingRefId = ref<string | null>(null);
const editOperator = ref<AmountCondition["operator"]>("gte");
const editValue = ref<number>(0);

const operatorItems: SelectItem[] = [
  { label: "≥ Greater or equal", value: "gte" },
  { label: "≤ Less or equal", value: "lte" },
  { label: "> Greater than", value: "gt" },
  { label: "< Less than", value: "lt" },
  { label: "= Equal to", value: "eq" },
];

const operatorSymbols: Record<string, string> = {
  gte: "≥",
  lte: "≤",
  gt: ">",
  lt: "<",
  eq: "=",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(value);
}

function startEdit(ref: TransactionReference) {
  editingRefId.value = ref.id;
  if (ref.amountCondition) {
    editOperator.value = ref.amountCondition.operator;
    editValue.value = ref.amountCondition.value;
  } else {
    editOperator.value = "gte";
    editValue.value = 0;
  }
}

function cancelEdit() {
  editingRefId.value = null;
}

async function saveAmountCondition(refId: string) {
  try {
    const condition: AmountCondition | null =
      editValue.value > 0
        ? { operator: editOperator.value, value: editValue.value }
        : null;

    await z.mutate.transactionReferences.update({
      id: refId,
      amountCondition: condition,
      updatedAt: Date.now(),
    });

    editingRefId.value = null;
    emit("updated");
    toast.add({ title: "Amount rule updated", color: "success" });
  } catch (error) {
    console.error("Failed to update reference:", error);
    toast.add({ title: "Failed to update rule", color: "error" });
  }
}

async function removeAmountCondition(refId: string) {
  try {
    await z.mutate.transactionReferences.update({
      id: refId,
      amountCondition: null,
      updatedAt: Date.now(),
    });

    emit("updated");
    toast.add({ title: "Amount rule removed", color: "success" });
  } catch (error) {
    console.error("Failed to remove rule:", error);
    toast.add({ title: "Failed to remove rule", color: "error" });
  }
}

async function deleteReference(refId: string) {
  if (
    !confirm(
      "Delete this transaction reference? Future transactions matching this pattern will no longer be auto-categorized.",
    )
  ) {
    return;
  }

  try {
    await z.mutate.transactionReferences.delete({ id: refId });

    emit("updated");
    toast.add({ title: "Reference deleted", color: "success" });
  } catch (error) {
    console.error("Failed to delete reference:", error);
    toast.add({ title: "Failed to delete reference", color: "error" });
  }
}

const columns: TableColumn<TransactionReference>[] = [
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      return h(
        "div",
        { class: "text-ellipsis overflow-hidden max-w-48" },
        row.getValue("description"),
      );
    },
  },
  {
    accessorKey: "merchant",
    header: "Merchant",
    cell: ({ row }) => {
      const merchant = row.getValue("merchant") as string;
      if (!merchant) {
        return h("span", { class: "text-muted italic" }, "Any");
      }
      return merchant;
    },
  },
  {
    accessorKey: "fromAccount",
    header: "From Account",
    cell: ({ row }) => {
      const fromAccount = row.getValue("fromAccount") as string;
      if (!fromAccount) {
        return h("span", { class: "text-muted italic" }, "Any");
      }
      return fromAccount;
    },
  },
  {
    accessorKey: "amountCondition",
    header: "Amount Rule",
    cell: ({ row }) => {
      const condition = row.getValue(
        "amountCondition",
      ) as AmountCondition | null;
      if (!condition) {
        return h(
          UBadge,
          { color: "neutral", variant: "subtle" },
          () => "No rule",
        );
      }
      const symbol = operatorSymbols[condition.operator] || condition.operator;
      return h(
        UBadge,
        { color: "info", variant: "subtle" },
        () => `${symbol} ${formatCurrency(condition.value)}`,
      );
    },
  },
  {
    accessorKey: "actions",
    header: "",
    size: 100,
    cell: ({ row }) => {
      const ref = row.original;
      return h("div", { class: "flex gap-1 justify-end" }, [
        h(UButton, {
          icon: "i-lucide-pencil",
          variant: "ghost",
          color: "neutral",
          size: "xs",
          onClick: () => startEdit(ref),
        }),
        h(UButton, {
          icon: "i-lucide-trash-2",
          variant: "ghost",
          color: "error",
          size: "xs",
          onClick: () => deleteReference(ref.id),
        }),
      ]);
    },
  },
];
</script>

<template>
  <ResponsiveModal v-model:open="open" title="Transaction References">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Transactions matching these patterns will be automatically assigned to
          this category during sync.
        </p>

        <div v-if="references.length > 0" class="space-y-4">
          <div class="overflow-x-auto">
            <UTable
              :data="references"
              :columns="columns"
              :ui="{
                base: 'table-fixed border-separate border-spacing-0',
                thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
                tbody: '[&>tr]:last:[&>td]:border-b-0',
                th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
                td: 'border-b border-default',
              }"
            />
          </div>

          <!-- Inline edit form -->
          <div
            v-if="editingRefId"
            class="border rounded-lg p-4 space-y-3 bg-elevated/50"
          >
            <h4 class="text-sm font-medium">Edit Amount Rule</h4>

            <div class="flex items-center gap-3">
              <USelect
                v-model="editOperator"
                :items="operatorItems"
                class="w-48"
                placeholder="Operator"
              />

              <UInput
                v-model.number="editValue"
                type="number"
                placeholder="Amount"
                step="0.01"
                min="0"
                class="w-32"
              />
            </div>

            <p class="text-xs text-muted">
              Set value to 0 or leave empty to remove the rule.
            </p>

            <div class="flex gap-2">
              <UButton size="sm" @click="saveAmountCondition(editingRefId!)">
                Save
              </UButton>
              <UButton
                size="sm"
                variant="outline"
                color="neutral"
                @click="cancelEdit"
              >
                Cancel
              </UButton>
              <UButton
                v-if="
                  references.find((r) => r.id === editingRefId)?.amountCondition
                "
                size="sm"
                variant="outline"
                color="error"
                @click="
                  removeAmountCondition(editingRefId!);
                  cancelEdit();
                "
              >
                Remove Rule
              </UButton>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8 border rounded-lg bg-elevated/50">
          <p class="text-muted">No transaction references yet</p>
          <p class="text-sm text-muted mt-2">
            Assign a category to a transaction to create a reference
            automatically.
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton variant="outline" color="neutral" @click="open = false">
        Close
      </UButton>
    </template>
  </ResponsiveModal>
</template>
