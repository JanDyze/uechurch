import { computed, ref } from 'vue'
import { subscribeToRolePermissions } from '../api/rolePermissionsService'
import { subscribeToAdmins } from '../api/adminsService'
import { subscribeToMembers } from '../api/membersService'
import { useAuth } from './useAuth'
import { BASELINE_CAPABILITIES } from '../data/capabilities'

// Module-level, with an explicit init like initAuth: the router guard has to
// consult permissions before a route resolves, and a guard has no component
// lifecycle to hang onMounted off. Starting the listeners once here also means
// the whole app shares one subscription each rather than one per view.
const roleMap = ref({})
const admins = ref([])
const members = ref([])

let started = false
let resolveReady
const ready = new Promise((resolve) => {
  resolveReady = resolve
})

// Resolve only once all three sources have reported, so the first guard check
// never runs against an empty roleMap and bounces someone who does have access.
const loaded = { roles: false, admins: false, members: false }
const markLoaded = (key) => {
  loaded[key] = true
  if (loaded.roles && loaded.admins && loaded.members) resolveReady()
}

export const initPermissions = () => {
  if (started) return ready
  started = true

  subscribeToRolePermissions((map) => {
    roleMap.value = map
    markLoaded('roles')
  })
  subscribeToAdmins((data) => {
    admins.value = data
    markLoaded('admins')
  })
  subscribeToMembers((data) => {
    members.value = data
    markLoaded('members')
  })

  return ready
}

export function usePermissions() {
  const { user } = useAuth()

  const isAdmin = computed(() =>
    Boolean(user.value && admins.value.some((a) => a.uid === user.value.uid))
  )

  // Nobody holds the role yet. The bootstrap button that claims it lives in
  // Settings, so admin-only routes have to stay open while this is true or a
  // fresh deployment can never appoint its first administrator.
  const hasNoAdmins = computed(() => admins.value.length === 0)

  /** The member record this account was approved to act as, if any. */
  const myMember = computed(() => {
    if (!user.value) return null
    return members.value.find((m) => m.uid === user.value.uid) || null
  })

  /**
   * The ministries this account serves in. Access is derived from these and
   * never from `tags`: tags are free text anyone with member-edit rights can
   * type, so honouring them here would let a label spell its way into a role.
   */
  const myMinistries = computed(() => myMember.value?.ministries || [])

  const capabilities = computed(() => {
    const granted = new Set(BASELINE_CAPABILITIES)
    myMinistries.value.forEach((ministry) => {
      ;(roleMap.value[ministry] || []).forEach((cap) => granted.add(cap))
    })
    // Managing an area implies being able to see it, so roles only ever need
    // the manage capability ticked.
    granted.forEach((cap) => {
      if (cap.endsWith('.manage')) granted.add(cap.replace(/\.manage$/, '.view'))
    })
    return granted
  })

  /** Admins bypass every check; everyone else is limited to what they hold. */
  const can = (capability) => {
    if (!capability) return true
    if (isAdmin.value) return true
    return capabilities.value.has(capability)
  }

  const canView = (area) => can(`${area}.view`)
  const canManage = (area) => can(`${area}.manage`)

  return {
    isAdmin,
    hasNoAdmins,
    myMember,
    myMinistries,
    roleMap,
    admins,
    members,
    capabilities,
    can,
    canView,
    canManage,
    ready,
  }
}
