import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'
import { initAuth, useAuth } from '../composables/useAuth'
import { initPermissions, usePermissions } from '../composables/usePermissions'
import { getLandingEnabled } from '../composables/useAppSettings'

// Where a signed-in member belongs: "/" is the visitors' page now.
const HOME = '/dashboard'

const routes = [
  // The public front door. Registered before the app shell below so it — not
  // the shell — is what "/" resolves to; the guard sends signed-in members on
  // to their dashboard.
  {
    path: '/',
    name: 'Landing',
    component: () => import('../views/Landing.vue'),
    meta: { public: true }
  },
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
        path: 'dashboard',
        name: 'Home',
        component: () => import('../views/Home.vue')
      },
      {
        path: 'members',
        name: 'Members',
        meta: { capability: 'members.view' },
        component: () => import('../views/Members.vue')
      },
      {
        path: 'members/:id',
        name: 'MemberDetails',
        meta: { capability: 'members.view' },
        component: () => import('../views/MemberDetails.vue')
      },
      {
        path: 'small-groups',
        name: 'SmallGroups',
        meta: { capability: 'smallgroups.view' },
        component: () => import('../views/SmallGroups.vue')
      },
      {
        path: 'small-groups/:id',
        name: 'SmallGroupDetails',
        meta: { capability: 'smallgroups.view' },
        component: () => import('../views/SmallGroupDetails.vue')
      },
      {
        path: 'small-groups/:id/sessions/:sessionId',
        name: 'SgSessionDetails',
        meta: { capability: 'smallgroups.view' },
        component: () => import('../views/SgSessionDetails.vue')
      },
      {
        path: 'events',
        name: 'Events',
        meta: { capability: 'events.view' },
        component: () => import('../views/Events.vue')
      },
      {
        path: 'gallery/:id?/:view?/:photoId?',
        name: 'Gallery',
        meta: { capability: 'gallery.view' },
        component: () => import('../views/Gallery.vue'),
        props: true
      },
      {
        path: 'links',
        name: 'Links',
        meta: { capability: 'links.view' },
        component: () => import('../views/Links.vue')
      },
      {
        path: 'songs',
        name: 'SongList',
        meta: { capability: 'songs.view' },
        component: () => import('../views/SongList.vue')
      },
      {
        // The month is optional: /lineups opens the current one, and the
        // month-keyed form is what gets shared with the worship team.
        path: 'lineups/:month?',
        name: 'Lineups',
        meta: { capability: 'lineups.view' },
        component: () => import('../views/Lineups.vue')
      },
      {
        path: 'minutes',
        name: 'Minutes',
        meta: { capability: 'minutes.view' },
        component: () => import('../views/Minutes.vue')
      },
      {
        path: 'minutes/:id',
        name: 'MinuteDetails',
        meta: { capability: 'minutes.view' },
        component: () => import('../views/MinuteDetails.vue')
      },
      {
        path: 'attendance',
        name: 'Attendance',
        meta: { capability: 'attendance.view' },
        component: () => import('../views/Attendance.vue')
      },
      {
        // Recording is its own screen: a swipe deck and a hundred names need
        // more room than a drawer. ?key= a gathering, ?id= an existing record,
        // neither = a one-off.
        path: 'attendance/record',
        name: 'RecordAttendance',
        // focus: no top or bottom bar. Taking attendance is a task with its
        // own back arrow, and the swipe deck wants every pixel.
        meta: { capability: 'attendance.manage', focus: true },
        component: () => import('../views/RecordAttendance.vue')
      },
      {
        path: 'prayer-concerns',
        name: 'PrayerConcerns',
        meta: { capability: 'prayer.view' },
        component: () => import('../views/PrayerConcerns.vue')
      },
      {
        path: 'finances',
        name: 'Finances',
        meta: { capability: 'finances.view' },
        component: () => import('../views/Finances.vue')
      },
      {
        path: 'finances/audit',
        name: 'FinanceAudit',
        meta: { capability: 'finances.view' },
        component: () => import('../views/FinanceAudit.vue')
      },
      {
        path: 'accounts',
        name: 'Accounts',
        meta: { adminOnly: true },
        component: () => import('../views/Accounts.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        meta: { adminOnly: true },
        component: () => import('../views/Settings.vue')
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
    return {
      name: 'Login',
      query: to.fullPath === HOME ? {} : { redirect: to.fullPath }
    }
  }

  if (to.name === 'Landing') {
    // Turned off, this install is an internal tool with no public face. On a
    // cold load the setting may not have arrived yet, so it reads as "shown"
    // here and Landing.vue finishes the decision once it does.
    if (!getLandingEnabled()) return { name: 'Login' }
    // A member who is already signed in wants the app, not the welcome mat —
    // except when they came from Settings to preview what visitors see.
    if (isAuthenticated.value && to.query.preview === undefined) return { path: HOME }
    return true
  }

  if (to.meta.guestOnly && isAuthenticated.value) {
    return { path: HOME }
  }

  // Roles come from the signed-in member's ministry tags, so they can only be
  // consulted once admins, members and the tag map have all loaded. Awaiting
  // that here stops a hard refresh on a deep link from bouncing someone who
  // does in fact have access.
  if (isAuthenticated.value) {
    // Awaited on every navigation, not just guarded ones: the sidebar and
    // bottom bar filter themselves by capability, so the map has to be loaded
    // even on a page that grants itself freely.
    await initPermissions()

    const capability = to.matched.reduce((cap, record) => record.meta.capability || cap, null)
    const adminOnly = to.matched.some((record) => record.meta.adminOnly)
    const { can, isAdmin, hasNoAdmins } = usePermissions()

    if (adminOnly && !isAdmin.value && !hasNoAdmins.value) {
      return { path: HOME, query: { denied: to.path } }
    }
    if (capability && !can(capability)) return { path: HOME, query: { denied: to.path } }
  }

  return true
})

export default router
