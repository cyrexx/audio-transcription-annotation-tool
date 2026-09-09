<script setup lang="ts">
import { useAnnotatorName } from './lib/annotatorName.ts'

const annotator = useAnnotatorName()
</script>

<template>
  <header class="topbar">
    <nav class="row">
      <strong>Annotation Tool</strong>
      <RouterLink to="/">Queue</RouterLink>
      <RouterLink to="/ingest">Ingest</RouterLink>
    </nav>
    <label class="row small">
      Annotator
      <input v-model="annotator" type="text" placeholder="your name" size="14" maxlength="100" />
    </label>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 1.5rem;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

nav {
  gap: 1.25rem;
}

nav a.router-link-active {
  font-weight: 600;
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 3rem;
}
</style>
