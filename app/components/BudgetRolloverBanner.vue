<script setup lang="ts">
const props = defineProps<{
  daysRemaining: number;
  percentComplete: number;
}>();

const emit = defineEmits<{
  rollover: [];
}>();

const message = computed(() => {
  if (props.daysRemaining > 0) {
    return `This budget ends in ${props.daysRemaining} days. Roll it over to create a new budget for the next period?`;
  }
  return "This budget period has ended. Create a new budget for the next period?";
});

const color = computed(() => {
  return props.daysRemaining <= 0 ? "info" : "warning";
});
</script>

<template>
  <UAlert
    :title="message"
    :color="color"
    variant="subtle"
    icon="i-lucide-calendar-clock"
    :actions="[
      {
        label: 'Roll Over',
        color: 'primary',
        onClick: () => emit('rollover'),
      },
    ]"
    :close="true"
  />
</template>
