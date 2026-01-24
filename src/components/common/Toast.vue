<script setup>
import { computed } from 'vue';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-vue-next';

const props = defineProps({
  id: [String, Number],
  message: String,
  type: {
    type: String,
    default: 'info', // success, error, warning, info
  },
  duration: {
    type: Number,
    default: 3000,
  },
});

const emit = defineEmits(['close']);

const icon = computed(() => {
  switch (props.type) {
    case 'success': return CheckCircle;
    case 'error': return AlertCircle;
    case 'warning': return AlertTriangle;
    default: return Info;
  }
});

const styles = computed(() => {
  switch (props.type) {
    case 'success':
      return {
        bg: 'bg-green-50 dark:bg-green-900/30',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-500 dark:text-green-400',
        text: 'text-green-800 dark:text-green-200',
      };
    case 'error':
      return {
        bg: 'bg-red-50 dark:bg-red-900/30',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-500 dark:text-red-400',
        text: 'text-red-800 dark:text-red-200',
      };
    case 'warning':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/30',
        border: 'border-amber-200 dark:border-amber-800',
        icon: 'text-amber-500 dark:text-amber-400',
        text: 'text-amber-800 dark:text-amber-200',
      };
    default:
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        border: 'border-blue-200 dark:border-blue-800',
        icon: 'text-blue-500 dark:text-blue-400',
        text: 'text-blue-800 dark:text-blue-200',
      };
  }
});
</script>

<template>
  <div
    :class="[
      'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm min-w-[280px] max-w-md',
      styles.bg,
      styles.border,
    ]"
  >
    <component :is="icon" :class="['h-5 w-5 flex-shrink-0', styles.icon]" />
    <p :class="['flex-1 text-sm font-medium', styles.text]">{{ message }}</p>
    <button
      @click="emit('close', id)"
      :class="['p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors', styles.text]"
    >
      <X class="h-4 w-4" />
    </button>
  </div>
</template>
