<script setup>
import { computed } from 'vue'
import { useAuth } from '../../composables/useAuth'

const props = defineProps({
  member: { type: Object, required: true },
})

// Deliberately reads only the auth user, never useMyMember/useMembers: this
// badge renders once per row, and useMembers() opens a Firestore listener on
// every call. The member record already carries the uid, so comparing it here
// costs nothing.
const { user } = useAuth()

const isMe = computed(
  () => Boolean(user.value && props.member?.uid && props.member.uid === user.value.uid)
)
</script>

<template>
  <span
    v-if="isMe"
    class="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary dark:text-primary-light"
    title="This is your linked member record"
  >
    You
  </span>
</template>
