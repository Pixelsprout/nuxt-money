<script setup lang="ts">
import type { AkahuAccount } from "#db/schema";

const props = defineProps<{
  account: AkahuAccount;
  accountId: string;
}>();

const emit = defineEmits<{
  synced: [];
}>();

const syncing = ref(false);

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

const handleSync = async () => {
  syncing.value = true;
  try {
    await $fetch(`/api/accounts/synced/${props.accountId}/sync`, {
      method: "POST",
    });
    emit("synced");
  } catch (error) {
    console.error("Failed to sync account:", error);
    alert("Failed to sync account. Please try again.");
  } finally {
    syncing.value = false;
  }
};
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
      <div class="flex items-center gap-2">
        <UButton
          color="gray"
          variant="ghost"
          size="xs"
          icon="i-lucide-refresh-cw"
          :loading="syncing"
          @click="handleSync"
        />
        <UBadge :color="getTypeColor(account.type)" size="lg">
          {{ account.type }}
        </UBadge>
      </div>
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
