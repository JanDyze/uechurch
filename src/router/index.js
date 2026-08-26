import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'
import { initAuth, useAuth } from '../composables/useAuth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/',
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('../views/Home.vue')
      },
      {
        path: 'members',
        name: 'Members',
        component: () => import('../views/Members.vue')
      },
      {
        path: 'members/:id',
        name: 'MemberDetails',
        component: () => import('../views/MemberDetails.vue')
      },
      {
        path: 'events',
        name: 'Events',
        component: () => import('../views/Events.vue')
      },
      {
        path: 'gallery/:id?/:view?/:photoId?',
        name: 'Gallery',
        component: () => import('../views/Gallery.vue'),
        props: true
      },
      {
        path: 'links',
        name: 'Links',
        component: () => import('../views/Links.vue')
      },
      {
        path: 'songs',
        name: 'SongList',
        component: () => import('../views/SongList.vue')
      },
      {
        path: 'minutes',
        name: 'Minutes',
        component: () => import('../views/Minutes.vue')
      },
      {
        path: 'minutes/:id',
        name: 'MinuteDetails',
        component: () => import('../views/MinuteDetails.vue')
      },
      {
        path: 'attendance',
        name: 'Attendance',
        component: () => import('../views/Attendance.vue')
      },
      {
        path: 'prayer-concerns',
        name: 'PrayerConcerns',
        component: () => import('../views/PrayerConcerns.vue')
      },
      {
        path: 'finances',
        name: 'Finances',
        component: () => import('../views/Finances.vue')
      },
      {
        path: 'finances/audit',
        name: 'FinanceAudit',
        component: () => import('../views/FinanceAudit.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Wait for Firebase to restore the persisted session before resolving any
// route, otherwise a page refresh would bounce a signed-in user to /login.
router.beforeEach(async (to) => {
  await initAuth()

  const { isAuthenticated } = useAuth()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: 'Login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && isAuthenticated.value) {
    return { path: '/' }
  }

  return true
})

export default router
