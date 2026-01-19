<script setup lang="ts">
import { authClient, signIn } from "~/lib/auth-client";

const providers = [
  {
    label: "Google",
    icon: "i-simple-icons-google",
    color: "neutral" as const,
    variant: "subtle" as const,
    onClick: signIn,
  },
];
</script>

<template>
  <UPageCard>
    <UAuthForm
      title="Login"
      description="Sign in with your Google account to continue."
      icon="i-lucide-user"
      :providers="providers"
      :fields="[]"
      class="max-w-md mx-auto"
    />
  </UPageCard>
</template>
