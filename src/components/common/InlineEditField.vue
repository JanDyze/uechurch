<script setup>
import { ref, watch, nextTick, computed, onMounted } from 'vue';
import { Check, X, Pencil } from 'lucide-vue-next';
import { useInlineEdit } from '../../composables/useInlineEdit';

const props = defineProps({
  modelValue: [String, Number, Array],
  label: String,
  type: {
    type: String,
    default: 'text' // text, select, date, tags
  },
  options: Array, // For select type
  placeholder: String,
  emptyText: {
    type: String,
    default: 'Not set'
  },
  icon: Object, // Lucide icon component
  displayFormatter: Function, // Custom display formatter
  allTags: Array, // For tags type
  forceEdit: {
    type: Boolean,
    default: false
  },
});

const emit = defineEmits(['update:modelValue', 'save']);

// Inline edit coordination
const { activeEditId, generateId, setActive, clearActive } = useInlineEdit();
const fieldId = ref(null);

onMounted(() => {
  fieldId.value = generateId();
});

const isEditing = computed(() => props.forceEdit || activeEditId.value === fieldId.value);
const editValue = ref(null);
const inputRef = ref(null);

// Watch forceEdit to initialize edit value
watch(() => props.forceEdit, (newVal) => {
  if (newVal) {
    editValue.value = Array.isArray(props.modelValue) 
      ? [...props.modelValue] 
      : props.modelValue;
  }
}, { immediate: true });

// Initialize edit value when starting to edit
const startEdit = async () => {
  editValue.value = Array.isArray(props.modelValue) 
    ? [...props.modelValue] 
    : props.modelValue;
  setActive(fieldId.value); // This closes any other open field
  await nextTick();
  if (inputRef.value) {
    inputRef.value.focus();
    if (inputRef.value.select) {
      inputRef.value.select();
    }
  }
};

const cancelEdit = () => {
  clearActive();
  editValue.value = null;
};

const saveEdit = () => {
  emit('update:modelValue', editValue.value);
  emit('save', editValue.value);
  clearActive();
};

const handleKeydown = (e) => {
  if (e.key === 'Enter' && props.type !== 'textarea') {
    saveEdit();
  } else if (e.key === 'Escape' && !props.forceEdit) {
    cancelEdit();
  }
};

// Auto-save on blur when in forceEdit mode
const handleBlur = () => {
  if (props.forceEdit) {
    // Only save if value changed
    const valueChanged = Array.isArray(props.modelValue)
      ? JSON.stringify(editValue.value) !== JSON.stringify(props.modelValue)
      : editValue.value !== props.modelValue;
    if (valueChanged) {
      emit('update:modelValue', editValue.value);
      emit('save', editValue.value);
    }
  }
};

// Display value formatting
const displayValue = computed(() => {
  if (props.displayFormatter) {
    return props.displayFormatter(props.modelValue);
  }
  
  if (props.type === 'select' && props.options) {
    const option = props.options.find(o => o.value === props.modelValue);
    return option?.label || props.modelValue;
  }
  
  if (props.type === 'date' && props.modelValue) {
    return new Date(props.modelValue).toLocaleDateString();
  }
  
  if (props.type === 'tags' && Array.isArray(props.modelValue)) {
    return props.modelValue.length > 0 ? props.modelValue : null;
  }
  
  return props.modelValue;
});

const hasValue = computed(() => {
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.length > 0;
  }
  return props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '';
});

// Tags handling
const toggleTag = (tag) => {
  if (!Array.isArray(editValue.value)) {
    editValue.value = [];
  }
  const index = editValue.value.indexOf(tag);
  if (index === -1) {
    editValue.value.push(tag);
  } else {
    editValue.value.splice(index, 1);
  }
};

const isTagSelected = (tag) => {
  return Array.isArray(editValue.value) && editValue.value.includes(tag);
};
</script>

<template>
  <div class="inline-edit-field group">
    <!-- View Mode -->
    <div
      v-if="!isEditing"
      @dblclick="startEdit"
      class="flex items-start gap-3 p-2 -m-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      title="Double-click to edit"
    >
      <component
        v-if="icon"
        :is="icon"
        class="h-5 w-5 text-[#01779b] dark:text-[#22b8cf] mt-0.5 flex-shrink-0"
      />
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">{{ label }}</p>
        
        <!-- Tags display -->
        <div v-if="type === 'tags' && hasValue" class="flex flex-wrap gap-1">
          <span
            v-for="tag in displayValue"
            :key="tag"
            class="px-2 py-0.5 text-xs rounded-full bg-[#01779b]/10 text-[#01779b] dark:bg-[#22b8cf]/20 dark:text-[#22b8cf]"
          >
            {{ tag }}
          </span>
        </div>
        
        <!-- Regular value display -->
        <p
          v-else
          :class="[
            'text-sm',
            hasValue
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500 italic'
          ]"
        >
          {{ hasValue ? displayValue : emptyText }}
        </p>
      </div>
      
      <!-- Edit indicator -->
      <Pencil class="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
    </div>

    <!-- Edit Mode -->
    <div v-else class="flex items-start gap-3">
      <component
        v-if="icon"
        :is="icon"
        class="h-5 w-5 text-[#01779b] dark:text-[#22b8cf] mt-3 flex-shrink-0"
      />
      
      <!-- Input row with inline buttons -->
      <div class="flex items-start gap-1 flex-1">
        <div class="flex-1 relative">
          <!-- Floating Label -->
          <label 
            class="floating-label absolute -top-2 left-2 px-1 text-xs font-medium bg-white dark:bg-gray-800 text-[#01779b] dark:text-[#22b8cf] z-10"
          >
            {{ label }}
          </label>
          
          <!-- Text Input -->
          <input
            v-if="type === 'text' || type === 'tel' || type === 'email'"
            ref="inputRef"
            v-model="editValue"
            :type="type"
            :placeholder="placeholder"
            @keydown="handleKeydown"
            @blur="handleBlur"
            class="w-full px-3 pt-3 pb-2 text-sm border border-[#01779b] dark:border-[#22b8cf] rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#01779b]/20 dark:focus:ring-[#22b8cf]/20"
          />
          
          <!-- Date Input -->
          <input
            v-else-if="type === 'date'"
            ref="inputRef"
            v-model="editValue"
            type="date"
            @keydown="handleKeydown"
            @blur="handleBlur"
            class="w-full px-3 pt-3 pb-2 text-sm border border-[#01779b] dark:border-[#22b8cf] rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#01779b]/20 dark:focus:ring-[#22b8cf]/20"
          />
          
          <!-- Select -->
          <select
            v-else-if="type === 'select'"
            ref="inputRef"
            v-model="editValue"
            @keydown="handleKeydown"
            @change="handleBlur"
            class="w-full px-3 pt-3 pb-2 text-sm border border-[#01779b] dark:border-[#22b8cf] rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#01779b]/20 dark:focus:ring-[#22b8cf]/20 appearance-none"
          >
            <option value="">Select...</option>
            <option v-for="opt in options" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          
          <!-- Textarea -->
          <textarea
            v-else-if="type === 'textarea'"
            ref="inputRef"
            v-model="editValue"
            rows="2"
            :placeholder="placeholder"
            @keydown="handleKeydown"
            @blur="handleBlur"
            class="w-full px-3 pt-3 pb-2 text-sm border border-[#01779b] dark:border-[#22b8cf] rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#01779b]/20 dark:focus:ring-[#22b8cf]/20 resize-none"
          />
          
          <!-- Tags -->
          <div v-else-if="type === 'tags'" class="pt-3 pb-2 px-3 border border-[#01779b] dark:border-[#22b8cf] rounded-lg bg-white dark:bg-gray-800">
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="tag in allTags"
                :key="tag"
                type="button"
                @click="toggleTag(tag)"
                :class="[
                  'px-2.5 py-1 text-xs rounded-full transition-colors',
                  isTagSelected(tag)
                    ? 'bg-[#01779b] dark:bg-[#22b8cf] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                ]"
              >
                {{ tag }}
              </button>
            </div>
          </div>
          
          <!-- Select dropdown arrow -->
          <div v-if="type === 'select'" class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        <!-- Inline action buttons (hidden in forceEdit mode) -->
        <div v-if="!forceEdit" class="flex items-center gap-0.5 flex-shrink-0 mt-1.5">
          <button
            @click="cancelEdit"
            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Cancel (Esc)"
          >
            <X class="h-4 w-4" />
          </button>
          <button
            @click="saveEdit"
            class="p-1 text-white bg-[#01779b] dark:bg-[#22b8cf] hover:bg-[#015a77] dark:hover:bg-[#1a9aab] rounded transition-colors"
            title="Save (Enter)"
          >
            <Check class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure date picker icon is visible */
input[type="date"]::-webkit-calendar-picker-indicator {
  opacity: 1;
  cursor: pointer;
}

.dark input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
}
</style>
