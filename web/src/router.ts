import { createRouter, createWebHistory } from 'vue-router'
import IngestPage from './pages/IngestPage.vue'
import ItemPage from './pages/ItemPage.vue'
import QueuePage from './pages/QueuePage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: QueuePage },
    { path: '/ingest', component: IngestPage },
    { path: '/items/:id', component: ItemPage, props: true },
  ],
})
