<script setup lang="ts">
const name = defineModel<string>("name", { required: true });
const period = defineModel<"MONTHLY" | "QUARTERLY" | "YEARLY">("period", {
  required: true,
});
const periodStart = defineModel<Date>("periodStart", { required: true });
const periodEnd = defineModel<Date>("periodEnd", { required: true });

const periodOptions = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly (3 months)" },
  { value: "YEARLY", label: "Yearly" },
];

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
</script>

<template>
  <div class="space-y-6 max-w-lg">
    <div>
      <h2 class="text-xl font-semibold">Budget Basics</h2>
      <p class="text-muted mt-1">
        Give your budget a name and select the period it covers.
      </p>
    </div>

    <div class="space-y-4">
      <UInput
        v-model="name"
        label="Budget Name"
        placeholder="e.g., February 2025 Budget"
        required
      />

      <div>
        <label class="text-sm font-medium block mb-2">Budget Period</label>
        <div class="flex gap-2">
          <UButton
            v-for="option in periodOptions"
            :key="option.value"
            :variant="period === option.value ? 'solid' : 'outline'"
            :color="period === option.value ? 'primary' : 'neutral'"
            @click="period = option.value as typeof period"
          >
            {{ option.label }}
          </UButton>
        </div>
      </div>

      <div class="p-4 rounded-lg bg-muted/50 space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-muted">Period Start:</span>
          <span class="font-medium">{{ formatDate(periodStart) }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-muted">Period End:</span>
          <span class="font-medium">{{ formatDate(periodEnd) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
