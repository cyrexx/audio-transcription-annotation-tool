<script setup lang="ts">
import { ITEM_STATUSES, type ItemStatus, type ItemSummary } from 'shared'
import { computed, onMounted, ref } from 'vue'
import { api } from '../lib/api.ts'
import { formatDuration, STATUS_LABELS } from '../lib/format.ts'

type SortKey = 'filename' | 'durationSec' | 'status' | 'updatedAt'

const items = ref<ItemSummary[]>([])
const error = ref('')
const statusFilter = ref<ItemStatus | 'ALL'>('ALL')
/** Duration bounds in seconds; empty means unbounded. */
const minSec = ref<number | ''>('')
const maxSec = ref<number | ''>('')
const sortKey = ref<SortKey>('updatedAt')
const sortAsc = ref(false)
const includeUnfinished = ref(false)

onMounted(async () => {
  try {
    items.value = await api.listItems()
  } catch (e) {
    error.value = (e as Error).message
  }
})

const visible = computed(() => {
  const filtered = items.value.filter(
    (i) =>
      (statusFilter.value === 'ALL' || i.status === statusFilter.value) &&
      (minSec.value === '' || i.durationSec >= minSec.value) &&
      (maxSec.value === '' || i.durationSec <= maxSec.value),
  )
  const dir = sortAsc.value ? 1 : -1
  return filtered.sort((a, b) => {
    const [x, y] = [sortValue(a), sortValue(b)]
    return (x < y ? -1 : x > y ? 1 : 0) * dir
  })
})

/** Status sorts in workflow order rather than alphabetically. */
const STATUS_ORDER: ItemStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'AUTO_REJECTED']

function sortValue(item: ItemSummary): string | number {
  if (sortKey.value === 'status') return STATUS_ORDER.indexOf(item.status)
  return item[sortKey.value]
}

function sortBy(key: SortKey) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else [sortKey.value, sortAsc.value] = [key, true]
}

const arrow = (key: SortKey) => (sortKey.value === key ? (sortAsc.value ? ' ↑' : ' ↓') : '')
</script>

<template>
  <div class="stack">
    <div class="row">
      <h1>Work queue</h1>
      <span class="muted small">{{ visible.length }} of {{ items.length }} items</span>
      <span style="flex: 1"></span>
      <label class="row small">
        Status
        <select v-model="statusFilter">
          <option value="ALL">All</option>
          <option v-for="s in ITEM_STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
        </select>
      </label>
      <label class="row small">
        Duration
        <input
          v-model.number="minSec"
          type="number"
          min="0"
          step="1"
          placeholder="from s"
          class="seconds"
        />
        to
        <input
          v-model.number="maxSec"
          type="number"
          min="0"
          step="1"
          placeholder="to s"
          class="seconds"
        />
      </label>
      <label class="row small">
        <input v-model="includeUnfinished" type="checkbox" />
        include unfinished
      </label>
      <a class="button" :href="api.exportUrl(includeUnfinished)" download>Export JSONL</a>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="items.length === 0" class="muted">
      No items yet. Run <code>yarn db:seed</code> or upload audio on the
      <RouterLink to="/ingest">Ingest</RouterLink> page.
    </p>

    <table v-else class="panel">
      <thead>
        <tr>
          <th>
            <button @click="sortBy('filename')">Filename{{ arrow('filename') }}</button>
          </th>
          <th>
            <button @click="sortBy('durationSec')">Duration{{ arrow('durationSec') }}</button>
          </th>
          <th>
            <button @click="sortBy('status')">Status{{ arrow('status') }}</button>
          </th>
          <th>Transcript</th>
          <th>Annotator</th>
          <th>
            <button @click="sortBy('updatedAt')">Updated{{ arrow('updatedAt') }}</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in visible" :key="item.id">
          <td>
            <RouterLink :to="`/items/${item.id}`">{{ item.filename }}</RouterLink>
          </td>
          <td>{{ formatDuration(item.durationSec) }}</td>
          <td>
            <span class="badge" :class="item.status">{{ STATUS_LABELS[item.status] }}</span>
          </td>
          <td :class="{ muted: !item.hasTranscript }">
            {{ item.hasTranscript ? 'yes' : 'missing' }}
          </td>
          <td>{{ item.annotator ?? '' }}</td>
          <td class="small muted">{{ new Date(item.updatedAt).toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.seconds {
  width: 5.5rem;
}
</style>
