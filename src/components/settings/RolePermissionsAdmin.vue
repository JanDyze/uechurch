<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { KeyRound, Check, Loader2, Info } from 'lucide-vue-next'
import { usePermissions } from '../../composables/usePermissions'
import { useAuth } from '../../composables/useAuth'
import { useToast } from '../../composables/useToast'
import { setRolePermissions } from '../../api/rolePermissionsService'
import { subscribeToCustomTags } from '../../api/tagsService'
import { mergeTagSources } from '../../utils/memberUtils'
import { AREAS, viewCap, manageCap, BASELINE_CAPABILITIES } from '../../data/capabilities'

const toast = useToast()
const { user } = useAuth()
const { isAdmin, roleMap, members } = usePermissions()

const customTags = ref([])
let unsubscribe = null

onMounted(() => {
  unsubscribe = subscribeToCustomTags((tags) => {
    customTags.value = tags.map((t) => t.name).filter(Boolean)
  })
})
onUnmounted(() => unsubscribe?.())

// Every tag that could be granted something: the presets, any tag someone
// created from the toolbar, and any tag already sitting on a member.
const tags = computed(() => {
  const onMembers = members.value.flatMap((m) => m.tags || [])
  return mergeTagSources(onMembers, customTags.value)
})

const savingTag = ref(null)

const holds = (tag, capability) => (roleMap.value[tag] || []).includes(capability)

const memberCount = (tag) =>
  members.value.filter((m) => (m.tags || []).includes(tag)).length

const toggle = async (tag, capability) => {
  const current = new Set(roleMap.value[tag] || [])
  if (current.has(capability)) {
    current.delete(capability)
  } else {
    current.add(capability)
    // Managing implies viewing; tick both so the stored grant is self-contained.
    if (capability.endsWith('.manage')) current.add(capability.replace(/\.manage$/, '.view'))
  }
  // Un-ticking view should not leave a dangling manage grant behind it.
  if (capability.endsWith('.view') && !current.has(capability)) {
    current.delete(capability.replace(/\.view$/, '.manage'))
  }

  savingTag.value = `${tag}:${capability}`
  try {
    await setRolePermissions(tag, [...current], user.value)
  } catch (e) {
    console.error('Error saving role permissions:', e)
    toast.error('Could not save that change.')
  } finally {
    savingTag.value = null
  }
}

const isBaseline = (capability) => BASELINE_CAPABILITIES.includes(capability)
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
  >
    <div class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
      <div class="p-2 rounded-lg bg-primary/10 shrink-0">
        <KeyRound class="h-5 w-5 text-primary dark:text-primary-light" />
      </div>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Roles</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          What each ministry tag lets a linked member do
        </p>
      </div>
    </div>

    <p v-if="!isAdmin" class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
      Only administrators can change roles.
    </p>

    <template v-else>
      <div
        class="flex items-start gap-2 mx-4 mt-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-xs text-gray-600 dark:text-gray-300"
      >
        <Info class="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
        <p>
          Tags come from member records, so a role only applies once that person's
          account has been linked and approved. Administrators bypass all of this.
          Rows marked <span class="font-semibold">baseline</span> are granted to every
          signed-in account already.
        </p>
      </div>

      <!-- The grid scrolls sideways on a phone rather than squashing the tags. -->
      <div class="overflow-x-auto p-4">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th
                class="sticky left-0 z-10 bg-white dark:bg-gray-800 text-left py-2 pr-3 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400"
              >
                Area
              </th>
              <th
                v-for="tag in tags"
                :key="tag"
                class="px-2 py-2 text-center align-bottom min-w-[76px]"
              >
                <span class="block text-[11px] font-bold text-gray-900 dark:text-white">
                  {{ tag }}
                </span>
                <span class="block text-[9px] text-gray-400">
                  {{ memberCount(tag) }} tagged
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="area in AREAS" :key="area.key">
              <tr class="border-t border-gray-100 dark:border-gray-700">
                <th
                  class="sticky left-0 z-10 bg-white dark:bg-gray-800 text-left py-2 pr-3 font-medium text-gray-900 dark:text-white whitespace-nowrap"
                >
                  {{ area.label }}
                  <span class="block text-[9px] font-normal text-gray-400">
                    view
                    <span v-if="isBaseline(viewCap(area.key))" class="text-primary">
                      · baseline
                    </span>
                  </span>
                </th>
                <td v-for="tag in tags" :key="`${tag}-v-${area.key}`" class="px-2 py-2 text-center">
                  <button
                    type="button"
                    :disabled="isBaseline(viewCap(area.key))"
                    @click="toggle(tag, viewCap(area.key))"
                    :class="[
                      'h-6 w-6 rounded-md border inline-flex items-center justify-center transition-colors',
                      isBaseline(viewCap(area.key))
                        ? 'border-primary/30 bg-primary/10 text-primary cursor-default'
                        : holds(tag, viewCap(area.key))
                          ? 'bg-primary border-primary text-white'
                          : 'border-gray-300 dark:border-gray-600 hover:border-primary',
                    ]"
                    :aria-label="`${tag} can view ${area.label}`"
                    :aria-pressed="holds(tag, viewCap(area.key)) || isBaseline(viewCap(area.key))"
                  >
                    <Loader2
                      v-if="savingTag === `${tag}:${viewCap(area.key)}`"
                      class="h-3.5 w-3.5 animate-spin"
                    />
                    <Check
                      v-else-if="holds(tag, viewCap(area.key)) || isBaseline(viewCap(area.key))"
                      class="h-4 w-4"
                    />
                  </button>
                </td>
              </tr>

              <tr v-if="area.manageable !== false" class="border-t border-gray-50 dark:border-gray-700/50">
                <th
                  class="sticky left-0 z-10 bg-white dark:bg-gray-800 text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
                >
                  <span class="block text-[9px] font-normal text-gray-400 pl-1">
                    add, edit, delete
                  </span>
                </th>
                <td v-for="tag in tags" :key="`${tag}-m-${area.key}`" class="px-2 py-2 text-center">
                  <button
                    type="button"
                    @click="toggle(tag, manageCap(area.key))"
                    :class="[
                      'h-6 w-6 rounded-md border inline-flex items-center justify-center transition-colors',
                      holds(tag, manageCap(area.key))
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-amber-400',
                    ]"
                    :aria-label="`${tag} can manage ${area.label}`"
                    :aria-pressed="holds(tag, manageCap(area.key))"
                  >
                    <Loader2
                      v-if="savingTag === `${tag}:${manageCap(area.key)}`"
                      class="h-3.5 w-3.5 animate-spin"
                    />
                    <Check v-else-if="holds(tag, manageCap(area.key))" class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
