<script setup lang="ts">
import type { AkahuAccount } from "#db/schema";

const props = defineProps<{
  account: AkahuAccount;
}>();

const emit = defineEmits<{
  deleted: [];
}>();

const deleting = ref(false);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(amount);
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "DEPOSITORY":
      return "success";
    case "CREDIT_CARD":
      return "warning";
    case "LOAN":
      return "error";
    default:
      return "neutral";
  }
};

const handleDelete = async () => {
  if (!confirm("Are you sure you want to delete this account?")) {
    return;
  }

  deleting.value = true;
  try {
    await $fetch(`/api/accounts/synced/${props.account.id}`, {
      method: "DELETE",
    });
    emit("deleted");
  } catch (error) {
    console.error("Failed to delete account:", error);
    alert("Failed to delete account. Please try again.");
  } finally {
    deleting.value = false;
  }
};

const balance = computed(() => {
  if (props.account.balance && typeof props.account.balance === "object") {
    return (props.account.balance as any).current || 0;
  }
  return 0;
});
</script>

<template>
  <div
    class="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-elevated/50 transition-colors"
    @click="navigateTo(`/accounts/${account.id}`)"
  >
    <div class="flex justify-between items-start">
      <div class="flex-1">
        <h3 class="font-semibold">{{ account.name }}</h3>
        <p v-if="account.formattedAccount" class="text-sm text-muted">
          {{ account.formattedAccount }}
        </p>
      </div>
      <UBadge :color="getTypeColor(account.type)" size="sm">
        {{ account.type }}
      </UBadge>
    </div>

    <div class="flex justify-between items-center">
      <div>
        <p class="text-xs text-muted">Current Balance</p>
        <p class="text-xl font-bold">
          {{ formatCurrency(balance) }}
        </p>
      </div>

      <UButton
        color="error"
        variant="ghost"
        size="sm"
        icon="i-lucide-trash-2"
        :loading="deleting"
        @click.stop="handleDelete"
      />
    </div>
  </div>
</template>
