import { createRouter, createWebHashHistory } from 'vue-router'
import SessionsView from '@/views/SessionsView.vue'

// Hash history: works on static hosting (GitHub Pages) without redirect rules.
// Remaining routes (/session/:id, ...) are added by their use cases.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'sessions',
      component: SessionsView,
    },
    {
      path: '/new',
      name: 'new-session',
      component: () => import('@/views/NewSessionView.vue'),
    },
    {
      path: '/session/:id/score/:archerId',
      name: 'scoring',
      component: () => import('@/views/ScoringView.vue'),
      props: true,
    },
    {
      // CU-08: read-only summary of one archer; `?archer=` picks it, else the first archer.
      path: '/session/:id/summary',
      name: 'summary',
      component: () => import('@/views/SummaryView.vue'),
      props: (route) => ({
        id: String(route.params.id),
        archerId: typeof route.query.archer === 'string' ? route.query.archer : undefined,
      }),
    },
    {
      // CU-11: edits date, place, distance and notes always; face and structure only without arrows.
      path: '/session/:id/edit',
      name: 'edit-session',
      component: () => import('@/views/EditSessionView.vue'),
      props: true,
    },
  ],
})

export default router
