<script setup lang="ts">
useHead({ title: 'Polynux' })
const { me } = useMe()
</script>

<template>
    <HomeDashboard v-if="me" />
    <HomeLanding v-else />
</template>
