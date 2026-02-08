<script setup lang="ts">
import type { Budget } from "#db/schema";

definePageMeta({ layout: "default" });

const router = useRouter();

const handleComplete = (budget: Budget) => {
  navigateTo(`/budgets/${budget.id}`);
};

const handleCancel = () => {};
</script>

<template>
  <UDashboardPanel :ui="{ body: 'pb-20 sm:pb-0' }">
    <UDashboardNavbar title="Create Budget">
      <template #leading>
        <UButton variant="ghost" icon="i-lucide-arrow-left" to="/budgets" />
      </template>
    </UDashboardNavbar>

    <UPageCard>
      <BudgetWizard @complete="handleComplete" @cancel="handleCancel" />
    </UPageCard>
  </UDashboardPanel>
</template>
