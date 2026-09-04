<script setup>
import { computed } from "vue";
import { Search, X, Tag } from '../../icons';
import SearchBar from "../common/SearchBar.vue";

const props = defineProps({
  searchQuery: {
    type: String,
    default: "",
  },
  resultCount: {
    type: Number,
    default: 0,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
  // Tagging the whole result set is an edit, so it is offered only to someone
  // who may make one.
  canTag: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:searchQuery", "tag-results"]);

// Details live in the search bar now, so the placeholder has to teach that:
// people only try typing a tag or a job if something tells them they can. The
// same goes for the comma - nobody discovers "choir, ushers" by accident.
// Slashes, not commas, between the examples: the comma is the operator now,
// and a placeholder that used both would read as syntax.
const searchPlaceholder = "Name / tag / job — comma for several";

// The count strip only earns its vertical space while a search is narrowing the list
const showSummary = computed(() => !!props.searchQuery);
</script>

<template>
  <div
    class="sticky top-0 z-40 mb-3 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3 lg:mb-4"
  >
    <!-- ==================== Mobile ==================== -->
    <!-- Always-visible search: it is the only way the list is narrowed -->
    <div class="relative lg:hidden">
      <Search
        class="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400"
      />
      <input
        :value="searchQuery"
        @input="emit('update:searchQuery', $event.target.value)"
        type="text"
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="Search members"
        :placeholder="searchPlaceholder"
        class="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9.5 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800"
      />
      <button
        v-if="searchQuery"
        @click="emit('update:searchQuery', '')"
        class="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 active:bg-gray-100 dark:active:bg-gray-700"
        aria-label="Clear search"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <!-- Result count (mobile). The search is already the filter, so it is also
         the fastest way to tag a group: narrow to them, then tag the lot. -->
    <div v-if="showSummary" class="mt-2 flex items-center gap-2 lg:hidden">
      <span
        class="shrink-0 text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400"
      >
        {{ resultCount }} of {{ totalCount }}
      </span>
      <button
        v-if="resultCount && canTag"
        @click="emit('tag-results')"
        class="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-[11px] font-semibold text-primary active:bg-primary/20 dark:bg-primary-light/15 dark:text-primary-light"
      >
        <Tag class="h-3.5 w-3.5" />
        Tag these {{ resultCount }}
      </button>
    </div>

    <!-- ==================== Desktop ==================== -->
    <div class="hidden w-full items-center justify-between gap-2 lg:flex">
      <SearchBar
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        :placeholder="searchPlaceholder"
      />

      <span
        v-if="showSummary"
        class="shrink-0 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400"
      >
        {{ resultCount }} of {{ totalCount }}
      </span>

      <button
        v-if="showSummary && resultCount && canTag"
        @click="emit('tag-results')"
        class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 dark:bg-primary-light/15 dark:text-primary-light"
      >
        <Tag class="h-4 w-4" />
        Tag these {{ resultCount }}
      </button>
    </div>
  </div>
</template>
