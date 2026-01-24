<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: [String, Number],
  label: String,
  type: {
    type: String,
    default: 'text'
  },
  required: Boolean,
  disabled: Boolean,
  error: String,
  placeholder: String,
  options: Array, // For select type
});

const emit = defineEmits(['update:modelValue']);

const isFocused = ref(false);
const inputRef = ref(null);

const hasValue = computed(() => {
  return props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '';
});

// Date and select types should always show floating label
const isFloating = computed(() => {
  return isFocused.value || hasValue.value || props.type === 'date' || props.type === 'select';
});

const handleInput = (e) => {
  emit('update:modelValue', e.target.value);
};

const handleFocus = () => {
  isFocused.value = true;
};

const handleBlur = () => {
  isFocused.value = false;
};
</script>

<template>
  <div class="floating-input-wrapper relative">
    <!-- Select -->
    <template v-if="type === 'select'">
      <select
        ref="inputRef"
        :value="modelValue"
        @change="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        :disabled="disabled"
        :class="[
          'floating-input peer w-full px-3 pt-4 pb-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200 appearance-none',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-300 dark:border-gray-600 focus:border-[#01779b] dark:focus:border-[#22b8cf] focus:ring-[#01779b]/20 dark:focus:ring-[#22b8cf]/20',
          'focus:outline-none focus:ring-2',
          disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''
        ]"
      >
        <option value="">{{ placeholder || 'Select...' }}</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </template>

    <!-- Textarea -->
    <template v-else-if="type === 'textarea'">
      <textarea
        ref="inputRef"
        :value="modelValue"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        :disabled="disabled"
        rows="2"
        :placeholder="isFloating ? placeholder : ''"
        :class="[
          'floating-input peer w-full px-3 pt-4 pb-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200 resize-none',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-300 dark:border-gray-600 focus:border-[#01779b] dark:focus:border-[#22b8cf] focus:ring-[#01779b]/20 dark:focus:ring-[#22b8cf]/20',
          'focus:outline-none focus:ring-2',
          disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''
        ]"
      />
    </template>

    <!-- Regular Input -->
    <template v-else>
      <input
        ref="inputRef"
        :type="type"
        :value="modelValue"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        :disabled="disabled"
        :placeholder="isFloating && type !== 'date' ? placeholder : ''"
        :class="[
          'floating-input peer w-full px-3 pt-4 pb-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-300 dark:border-gray-600 focus:border-[#01779b] dark:focus:border-[#22b8cf] focus:ring-[#01779b]/20 dark:focus:ring-[#22b8cf]/20',
          'focus:outline-none focus:ring-2',
          disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''
        ]"
      />
    </template>

    <!-- Floating Label -->
    <label
      :class="[
        'floating-label absolute left-2 transition-all duration-200 pointer-events-none',
        isFloating
          ? '-top-2 text-xs font-medium px-1 bg-white dark:bg-gray-800'
          : 'top-1/2 -translate-y-1/2 left-3 text-sm',
        error
          ? 'text-red-500'
          : isFloating
            ? 'text-[#01779b] dark:text-[#22b8cf]'
            : 'text-gray-500 dark:text-gray-400',
        type === 'textarea' && !isFloating ? 'top-3 translate-y-0' : ''
      ]"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-0.5">*</span>
    </label>

    <!-- Error Message -->
    <p v-if="error" class="mt-1 text-xs text-red-500">{{ error }}</p>
  </div>
</template>

<style scoped>
.floating-input-wrapper {
  margin-bottom: 0;
}

/* Hide default date placeholder text */
input[type="date"]::-webkit-datetime-edit-text,
input[type="date"]::-webkit-datetime-edit-month-field,
input[type="date"]::-webkit-datetime-edit-day-field,
input[type="date"]::-webkit-datetime-edit-year-field {
  color: inherit;
}

input[type="date"]:not(:focus):invalid::-webkit-datetime-edit {
  color: transparent;
}

input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.7;
  width: 18px;
  height: 18px;
  padding: 2px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}

input[type="date"]::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
}
</style>
