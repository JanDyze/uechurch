<script setup>
import { X } from "lucide-vue-next";

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
  <Transition name="drawer">
    <div
      v-if="showConfig && viewMode === 'detailed'"
      class="config-drawer border-l-4 border-[#01779b] bg-blue-50/30 dark:bg-gray-900/80 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-blue-50/30 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
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
      <div class="flex-1 overflow-y-auto p-6">
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
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#01779b] focus:ring-offset-2',
                visibleFields[field.key] ? 'bg-[#01779b]' : 'bg-gray-300 dark:bg-gray-600'
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
      <div class="flex-shrink-0 bg-blue-50/30 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <button
          @click="$emit('update:showConfig', false)"
          class="w-full px-4 py-2 text-sm font-medium text-white bg-[#01779b] dark:bg-[#01779b] rounded-lg hover:bg-[#015a77] dark:hover:bg-[#015a77] transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  </Transition>
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
</style>

