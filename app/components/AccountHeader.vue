<script setup lang="ts">
import type { AkahuAccount } from "#db/schema";

const props = defineProps<{
  account: AkahuAccount;
}>();

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

const balance = computed(() => {
  if (props.account.balance && typeof props.account.balance === "object") {
    return (props.account.balance as any).current || 0;
  }
  return 0;
});

const lastSynced = computed(() => {
  if (props.account.syncedAt) {
    return new Date(props.account.syncedAt).toLocaleString("en-NZ", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  return "Never";
});
</script>

<template>
  <div class="border rounded-lg p-6 space-y-4">
    <div class="flex justify-between items-start">
      <div class="flex-1">
        <h1 class="text-3xl font-bold">{{ account.name }}</h1>
        <p v-if="account.formattedAccount" class="text-muted mt-1">
          {{ account.formattedAccount }}
        </p>
      </div>
      <UBadge :color="getTypeColor(account.type)" size="lg">
        {{ account.type }}
      </UBadge>
    </div>

    <div class="flex justify-between items-end">
      <div>
        <p class="text-sm text-muted">Current Balance</p>
        <p class="text-4xl font-bold mt-1">
          {{ formatCurrency(balance) }}
        </p>
      </div>

      <div class="text-right">
        <p class="text-sm text-muted">Last Synced</p>
        <p class="text-sm font-medium mt-1">
          {{ lastSynced }}
        </p>
      </div>
    </div>
  </div>
</template>
