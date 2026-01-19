<script setup lang="ts">
import { authClient, signIn } from "~/lib/auth-client";
</script>

<template>
  <div>
    <button @click="signIn">Continue with Google</button>
  </div>
</template>
