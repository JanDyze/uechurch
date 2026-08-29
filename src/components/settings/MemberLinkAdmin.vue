<script setup>
import { computed, ref } from 'vue'
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Link2Off,
  Check,
  X,
  Loader2,
} from 'lucide-vue-next'
import { useAdmins } from '../../composables/useAdmins'
import { useMemberClaims } from '../../composables/useMemberClaims'
import { useMembers } from '../../composables/useMembers'
import { useAuth } from '../../composables/useAuth'
import { useToast } from '../../composables/useToast'
import { getFullName, getAvatarUrl } from '../../utils/memberUtils'
import { memberKey } from '../../utils/sgUtils'

const toast = useToast()
const { user } = useAuth()
const { admins, isAdmin, hasNoAdmins, promote, demote, claimFirst } = useAdmins()
const { pendingClaims, approve, reject, unlink } = useMemberClaims()
const { members } = useMembers()

const busyId = ref(null)
const claiming = ref(false)

const linkedMembers = computed(() =>
  members.value
    .filter((member) => member.uid)
    .sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
)

const memberForClaim = (claim) =>
  members.value.find((member) => memberKey(member) === String(claim.memberId)) || null

const handleClaimFirst = async () => {
  claiming.value = true
  try {
    await claimFirst()
    toast.success('You are now an administrator')
  } catch (e) {
    console.error('Error claiming first admin:', e)
    toast.error(e?.message || 'Could not claim the administrator role.')
  } finally {
    claiming.value = false
  }
}

const handleApprove = async (claim) => {
  const member = memberForClaim(claim)
  if (!member) {
    toast.error('That member record no longer exists.')
    return
  }
  busyId.value = claim.firestoreId
  try {
    await approve(claim, member)
    toast.success(`${claim.displayName || claim.email} is now linked to ${getFullName(member)}`)
  } catch (e) {
    console.error('Error approving member claim:', e)
    toast.error('Could not approve the request.')
  } finally {
    busyId.value = null
  }
}

const handleReject = async (claim) => {
  busyId.value = claim.firestoreId
  try {
    await reject(claim, 'Declined by an administrator.')
    toast.success('Request declined')
  } catch (e) {
    console.error('Error rejecting member claim:', e)
    toast.error('Could not decline the request.')
  } finally {
    busyId.value = null
  }
}

const handleUnlink = async (member) => {
  busyId.value = memberKey(member)
  try {
    await unlink(member)
    toast.success(`${getFullName(member)} is no longer linked to an account`)
  } catch (e) {
    console.error('Error unlinking member:', e)
    toast.error('Could not unlink that member.')
  } finally {
    busyId.value = null
  }
}

const adminUids = computed(() => new Set(admins.value.map((a) => a.uid)))

// A linked member already carries the uid of their account, which is all the
// admin list needs — so promotion happens right here rather than in a
// separate people-picker.
const handlePromote = async (member) => {
  busyId.value = memberKey(member)
  try {
    await promote({
      uid: member.uid,
      email: '',
      displayName: getFullName(member),
    })
    toast.success(`${getFullName(member)} is now an administrator`)
  } catch (e) {
    console.error('Error promoting member:', e)
    toast.error('Could not make that member an administrator.')
  } finally {
    busyId.value = null
  }
}

const handleDemote = async (admin) => {
  if (admin.uid === user.value?.uid && admins.value.length === 1) {
    toast.error('Add another administrator before removing yourself.')
    return
  }
  busyId.value = admin.uid
  try {
    await demote(admin.uid)
    toast.success('Administrator removed')
  } catch (e) {
    console.error('Error removing admin:', e)
    toast.error('Could not remove that administrator.')
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
  >
    <div
      class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700"
    >
      <div class="p-2 rounded-lg bg-primary/10 shrink-0">
        <ShieldCheck class="h-5 w-5 text-primary dark:text-primary-light" />
      </div>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
          Member accounts
        </h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Approve who each signed-in account belongs to in the member list
        </p>
      </div>
    </div>

    <!-- Bootstrap: nobody holds the role yet -->
    <div v-if="hasNoAdmins" class="p-4">
      <div
        class="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-3"
      >
        <ShieldAlert class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            No administrators yet
          </p>
          <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
            Someone has to hold the role before link requests can be reviewed. The
            first person to claim it becomes an administrator and can add others.
          </p>
          <button
            @click="handleClaimFirst"
            :disabled="claiming"
            class="mt-2.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            <Loader2 v-if="claiming" class="h-3.5 w-3.5 animate-spin" />
            <ShieldCheck v-else class="h-3.5 w-3.5" />
            Make me an administrator
          </button>
        </div>
      </div>
    </div>

    <!-- Not an admin -->
    <p v-else-if="!isAdmin" class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
      Only administrators can review member link requests.
    </p>

    <template v-else>
      <!-- Pending requests -->
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 class="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Pending requests ({{ pendingClaims.length }})
        </h3>
      </div>

      <p
        v-if="pendingClaims.length === 0"
        class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400"
      >
        No requests waiting.
      </p>

      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <li
          v-for="claim in pendingClaims"
          :key="claim.firestoreId"
          class="p-4 flex items-start gap-3"
        >
          <img
            v-if="memberForClaim(claim)"
            :src="getAvatarUrl(memberForClaim(claim))"
            alt=""
            class="h-10 w-10 rounded-full object-cover bg-gray-100 dark:bg-gray-700 shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {{ claim.displayName || claim.email }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ claim.email }}
            </p>
            <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
              claims to be
              <span class="font-semibold text-gray-900 dark:text-white">
                {{ claim.memberName }}
              </span>
              <span v-if="!memberForClaim(claim)" class="text-red-500">
                (record no longer exists)
              </span>
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              @click="handleReject(claim)"
              :disabled="busyId === claim.firestoreId"
              class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              aria-label="Decline"
            >
              <X class="h-4 w-4" />
            </button>
            <button
              @click="handleApprove(claim)"
              :disabled="busyId === claim.firestoreId || !memberForClaim(claim)"
              class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
              aria-label="Approve"
            >
              <Loader2 v-if="busyId === claim.firestoreId" class="h-4 w-4 animate-spin" />
              <Check v-else class="h-4 w-4" />
            </button>
          </div>
        </li>
      </ul>

      <!-- Existing links -->
      <div class="px-4 py-3 border-y border-gray-100 dark:border-gray-700">
        <h3 class="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Linked accounts ({{ linkedMembers.length }})
        </h3>
      </div>

      <p
        v-if="linkedMembers.length === 0"
        class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400"
      >
        No accounts are linked yet.
      </p>

      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <li
          v-for="member in linkedMembers"
          :key="memberKey(member)"
          class="p-4 flex items-center gap-3"
        >
          <img
            :src="getAvatarUrl(member)"
            alt=""
            class="h-9 w-9 rounded-full object-cover bg-gray-100 dark:bg-gray-700 shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ getFullName(member) }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
              <UserCheck class="h-3 w-3" /> linked
            </p>
          </div>
          <button
            v-if="!adminUids.has(member.uid)"
            @click="handlePromote(member)"
            :disabled="busyId === memberKey(member)"
            class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
            :aria-label="`Make ${getFullName(member)} an administrator`"
            title="Make administrator"
          >
            <ShieldCheck class="h-4 w-4" />
          </button>
          <button
            @click="handleUnlink(member)"
            :disabled="busyId === memberKey(member)"
            class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            :aria-label="`Unlink ${getFullName(member)}`"
          >
            <Link2Off class="h-4 w-4" />
          </button>
        </li>
      </ul>

      <!-- Administrators -->
      <div class="px-4 py-3 border-y border-gray-100 dark:border-gray-700">
        <h3 class="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Administrators ({{ admins.length }})
        </h3>
      </div>

      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="admin in admins" :key="admin.uid" class="p-4 flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary/10 shrink-0">
            <ShieldCheck class="h-4 w-4 text-primary dark:text-primary-light" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ admin.displayName || admin.email }}
              <span v-if="admin.uid === user?.uid" class="text-xs text-gray-400">(you)</span>
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ admin.email }}</p>
          </div>
          <button
            @click="handleDemote(admin)"
            :disabled="busyId === admin.uid"
            class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            :aria-label="`Remove ${admin.email} as administrator`"
          >
            <UserX class="h-4 w-4" />
          </button>
        </li>
      </ul>

      <p class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        Administrators are promoted from the linked accounts above.
      </p>
    </template>
  </section>
</template>
