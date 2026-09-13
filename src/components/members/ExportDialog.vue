<script setup>
import { ref, computed, watch } from "vue";
import { X, Download, ArrowUp, ArrowDown, Check, ChevronDown } from '../../icons';
import { useFocusTrap } from "../../composables/useFocusTrap";
import { EXPORT_FIELDS } from "../../utils/exportUtils";

// Two questions, asked in the order people think them: who is on the sheet,
// and what the sheet is for. The old dialog opened on a pair of stat tiles and
// thirteen green toggles, which put the answer to "what is this for" — a phone
// list for the ushers, the birthdays for the month — thirteen taps away. Now
// each common sheet is one tap, and the toggles are still there, folded, for
// the sheet nobody has asked for before.

const props = defineProps({
  showExport: {
    type: Boolean,
    default: false,
  },
  members: {
    type: Array,
    default: () => [],
  },
  currentSortBy: {
    type: String,
    default: "name",
  },
  currentSortOrder: {
    type: String,
    default: "asc",
  },
  visibleCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["update:showExport", "export"]);

const close = () => emit("update:showExport", false);

/* ------------------------------------------------------------------ who */
const isSearchNarrowing = computed(() => props.visibleCount < props.members.length);
const memberCount = computed(() => props.members.filter((m) => m.isMember).length);

const scopes = computed(() => [
  ...(isSearchNarrowing.value
    ? [{ key: "search", label: "My search results", count: props.visibleCount }]
    : []),
  { key: "all", label: "Everyone", count: props.members.length },
  { key: "members", label: "Members", count: memberCount.value },
  { key: "attendees", label: "Attendees", count: props.members.length - memberCount.value },
]);

const scope = ref("all");

/* ----------------------------------------------------------------- what */
const PRESETS = [
  {
    key: "contacts",
    label: "Contact list",
    hint: "Name, phone, email, address",
    fields: ["firstName", "lastName", "nickname", "contactNumber", "email", "address"],
  },
  {
    key: "birthdays",
    label: "Birthdays",
    hint: "Name, birth date, age",
    fields: ["firstName", "lastName", "nickname", "dateOfBirth", "age"],
  },
  {
    key: "church",
    label: "Serving",
    hint: "Name, standing, ministries, tags",
    fields: ["firstName", "lastName", "isMember", "ministries", "tags"],
  },
  {
    key: "everything",
    label: "Everything",
    hint: "Every field on the record",
    fields: EXPORT_FIELDS.filter((f) => f.key !== "id").map((f) => f.key),
  },
];

const selected = ref(new Set(PRESETS[0].fields));
const showColumns = ref(false);

const activePreset = computed(
  () =>
    PRESETS.find(
      (preset) =>
        preset.fields.length === selected.value.size &&
        preset.fields.every((key) => selected.value.has(key))
    )?.key || ""
);

const usePreset = (preset) => {
  selected.value = new Set(preset.fields);
};

const toggleField = (key) => {
  const next = new Set(selected.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selected.value = next;
};

/* ----------------------------------------------------------------- sort */
const sortOptions = [
  { value: "name", label: "Name" },
  { value: "age", label: "Age" },
  { value: "dateOfBirth", label: "Birth date" },
];
const sortBy = ref(props.currentSortBy);
const sortOrder = ref(props.currentSortOrder);

// The dialog stays mounted, so pick up the page's current search and sort
// each time it opens rather than freezing whatever they were at startup. A
// search narrows the list for a reason, so it is the rows offered first.
watch(
  () => props.showExport,
  (isOpen) => {
    if (!isOpen) return;
    sortBy.value = sortOptions.some((o) => o.value === props.currentSortBy)
      ? props.currentSortBy
      : "name";
    sortOrder.value = props.currentSortOrder;
    scope.value = isSearchNarrowing.value ? "search" : "all";
  }
);

const rowCount = computed(() => scopes.value.find((s) => s.key === scope.value)?.count || 0);

const canExport = computed(() => selected.value.size > 0 && rowCount.value > 0);

const handleExport = () => {
  if (!canExport.value) return;
  emit("export", {
    scope: scope.value,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
    fields: Object.fromEntries(EXPORT_FIELDS.map((f) => [f.key, selected.value.has(f.key)])),
  });
  close();
};

const dialogRef = ref(null);
useFocusTrap(dialogRef, () => props.showExport, close);
</script>

<template>
  <Teleport to="body">
    <Transition name="export-sheet">
      <div
        v-if="showExport"
        class="fixed inset-0 z-100 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="close"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-dialog-title"
          tabindex="-1"
          class="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl dark:bg-gray-800 sm:max-w-lg sm:rounded-2xl"
        >
          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6"
          >
            <h2 id="export-dialog-title" class="text-lg font-semibold text-gray-900 dark:text-white">
              Export people
            </h2>
            <button
              @click="close"
              aria-label="Close"
              class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            <!-- Who -->
            <section>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Who
              </h3>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in scopes"
                  :key="option.key"
                  type="button"
                  @click="scope = option.key"
                  :aria-pressed="scope === option.key"
                  :class="[
                    'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                    scope === option.key
                      ? 'bg-primary text-white dark:bg-primary-light'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
                  ]"
                >
                  {{ option.label }}
                  <span class="tabular-nums opacity-70">{{ option.count }}</span>
                </button>
              </div>
            </section>

            <!-- What -->
            <section>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                What for
              </h3>
              <ul class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                <li v-for="preset in PRESETS" :key="preset.key">
                  <button
                    type="button"
                    @click="usePreset(preset)"
                    :aria-pressed="activePreset === preset.key"
                    class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-medium text-gray-900 dark:text-white">
                        {{ preset.label }}
                      </span>
                      <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {{ preset.hint }}
                      </span>
                    </span>
                    <span
                      :class="[
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        activePreset === preset.key
                          ? 'bg-primary text-white dark:bg-primary-light'
                          : 'border-2 border-gray-200 dark:border-gray-600',
                      ]"
                    >
                      <Check v-if="activePreset === preset.key" class="h-3 w-3" />
                    </span>
                  </button>
                </li>
              </ul>

              <!-- The columns themselves, for a sheet no preset fits. Folded,
                   and it says how many are picked so a hand-made choice is
                   not a surprise when the preset above shows unticked. -->
              <button
                type="button"
                @click="showColumns = !showColumns"
                :aria-expanded="showColumns"
                class="mt-2 flex w-full items-center gap-1.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                <ChevronDown :class="['h-4 w-4 transition-transform', showColumns ? 'rotate-180' : '']" />
                Choose columns
                <span class="tabular-nums text-gray-400 dark:text-gray-500">· {{ selected.size }} picked</span>
              </button>
              <div v-if="showColumns" class="mt-2 flex flex-wrap gap-1.5">
                <button
                  v-for="field in EXPORT_FIELDS"
                  :key="field.key"
                  type="button"
                  @click="toggleField(field.key)"
                  :aria-pressed="selected.has(field.key)"
                  :class="[
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    selected.has(field.key)
                      ? 'bg-primary/10 text-primary dark:bg-primary-light/20 dark:text-primary-light'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                  ]"
                >
                  <Check v-if="selected.has(field.key)" class="h-3 w-3" />
                  {{ field.label }}
                </button>
              </div>
            </section>

            <!-- Order -->
            <section>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Order
              </h3>
              <div class="flex gap-2">
                <select
                  v-model="sortBy"
                  aria-label="Sort by"
                  class="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <button
                  type="button"
                  @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
                  :aria-label="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
                  class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <ArrowUp v-if="sortOrder === 'asc'" class="h-4 w-4" />
                  <ArrowDown v-else class="h-4 w-4" />
                  {{ sortOrder === 'asc' ? 'A–Z' : 'Z–A' }}
                </button>
              </div>
            </section>
          </div>

          <!-- Footer. pb clears the phone's home indicator. -->
          <div
            class="flex shrink-0 items-center gap-3 border-t border-gray-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-gray-700 sm:px-6 sm:pb-4"
          >
            <p class="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400">
              {{ rowCount }} {{ rowCount === 1 ? 'person' : 'people' }} · Excel (.xlsx)
            </p>
            <button
              @click="handleExport"
              :disabled="!canExport"
              class="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-primary-light"
            >
              <Download class="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.export-sheet-enter-active,
.export-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.export-sheet-enter-from,
.export-sheet-leave-to {
  opacity: 0;
}

/* A sheet rises from the bottom on a phone; on a desktop it is a dialog and
   simply fades with its backdrop. */
@media (max-width: 639px) {
  .export-sheet-enter-active > div,
  .export-sheet-leave-active > div {
    transition: transform 0.25s ease;
  }

  .export-sheet-enter-from > div,
  .export-sheet-leave-to > div {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .export-sheet-enter-active,
  .export-sheet-leave-active,
  .export-sheet-enter-active > div,
  .export-sheet-leave-active > div {
    transition: none;
  }
}
</style>
