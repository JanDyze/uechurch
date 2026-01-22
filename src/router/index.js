import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'

const routes = [
  {
    path: '/',
    component: AdminLayout,
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
        path: 'events',
        name: 'Events',
        component: () => import('../views/Events.vue')
      },
      {
        path: 'fb-test',
        name: 'FBTest',
        component: () => import('../views/FBTest.vue')
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
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

