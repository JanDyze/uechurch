<script setup>
import { X } from "lucide-vue-next";
import { useMediaQuery } from "../../composables/useMediaQuery";

const isMobile = useMediaQuery("(max-width: 1023px)");

const props = defineProps({
  showConfig: {
    type: Boolean,
    default: false,
  },
  viewMode: {
    type: String,
    default: "simple",
  },
  visibleFields: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:showConfig", "update:visibleFields"]);

const toggleField = (field) => {
  emit("update:visibleFields", {
    ...props.visibleFields,
    [field]: !props.visibleFields[field],
  });
};
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
    <div
      v-if="showConfig && viewMode === 'detailed'"
      :class="[
        isMobile
          ? 'fixed inset-0 z-80 flex flex-col justify-end'
          : 'config-drawer border-l-4 border-primary bg-blue-50/30 dark:bg-gray-900/80 w-1/2 h-full flex flex-col shrink-0 shadow-2xl shadow-primary/20'
      ]"
    >
      <div
        v-if="isMobile"
        class="absolute inset-0 bg-black/50"
        @click="$emit('update:showConfig', false)"
      />
      <div
        :class="[
          'flex flex-col min-h-0',
          isMobile
            ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-blue-50/30 dark:bg-gray-900/80 shadow-2xl border-t border-gray-200 dark:border-gray-700'
            : 'h-full w-full'
        ]"
      >
      <!-- Header -->
      <div class="shrink-0 bg-blue-50/30 dark:bg-gray-900/80 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Display Fields
        </h3>
        <button
          @click="$emit('update:showConfig', false)"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="space-y-2">
          <div
            v-for="field in [
              { key: 'dateOfBirth', label: 'Date of Birth' },
              { key: 'age', label: 'Age' },
              { key: 'civilStatus', label: 'Civil Status' },
              { key: 'occupation', label: 'Occupation' },
              { key: 'contactNumber', label: 'Contact Number' },
              { key: 'address', label: 'Address' },
            ]"
            :key="field.key"
            class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700"
          >
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ field.label }}</span>
            <button
              @click="toggleField(field.key)"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                visibleFields[field.key] ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  visibleFields[field.key] ? 'translate-x-6' : 'translate-x-1'
                ]"
              ></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Sticky Footer -->
      <div class="shrink-0 bg-blue-50/30 dark:bg-gray-900/80 rounded-b-2xl border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <button
          @click="$emit('update:showConfig', false)"
          class="w-full px-4 py-2 text-sm font-medium text-white bg-primary dark:bg-primary rounded-lg hover:bg-primary-hover dark:hover:bg-primary-hover transition-colors"
        >
          Apply
        </button>
      </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style>
.config-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.config-drawer,
.drawer-leave-to.config-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}

.modal-sheet-enter-active,
.modal-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.modal-sheet-enter-active > div:last-child,
.modal-sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}

.modal-sheet-enter-from,
.modal-sheet-leave-to {
  opacity: 0;
}

.modal-sheet-enter-from > div:last-child,
.modal-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>

