<script setup lang="ts">
import type { Budget } from "#db/schema";

definePageMeta({ layout: "default" });

const router = useRouter();

const handleComplete = (budget: Budget) => {
  navigateTo(`/budgets/${budget.id}`);
};

const handleCancel = () => {
  navigateTo("/budgets");
};
</script>

<template>
  <UDashboardPanel :ui="{ body: 'pb-20 sm:pb-0' }">
    <template #header>
      <UDashboardNavbar title="Create Budget">
        <template #leading>
          <UButton variant="ghost" icon="i-lucide-arrow-left" to="/budgets" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <BudgetWizard @complete="handleComplete" @cancel="handleCancel" />
    </template>
  </UDashboardPanel>
</template>
