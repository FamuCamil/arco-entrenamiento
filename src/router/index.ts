import { createRouter, createWebHashHistory } from 'vue-router'
import SessionsView from '@/views/SessionsView.vue'

// Hash history: works on static hosting (GitHub Pages) without redirect rules.
// Remaining routes (/new, /session/:id, ...) are added by their use cases.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'sessions',
      component: SessionsView,
    },
  ],
})

export default router
