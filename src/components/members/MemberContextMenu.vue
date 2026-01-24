<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { ExternalLink, Edit2, Trash2, Phone, Mail, Copy } from "lucide-vue-next";

const props = defineProps({
  show: Boolean,
  x: Number,
  y: Number,
  member: Object,
});

const emit = defineEmits(["close", "view", "edit", "delete", "call", "email", "copy"]);

const menuRef = ref(null);
const adjustedX = ref(0);
const adjustedY = ref(0);

// Adjust menu position to stay within viewport
watch(() => [props.show, props.x, props.y], () => {
  if (props.show && menuRef.value) {
    setTimeout(() => {
      const menu = menuRef.value;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      adjustedX.value = props.x;
      adjustedY.value = props.y;
      
      // Adjust if menu goes off right edge
      if (props.x + rect.width > viewportWidth) {
        adjustedX.value = viewportWidth - rect.width - 10;
      }
      
      // Adjust if menu goes off bottom edge
      if (props.y + rect.height > viewportHeight) {
        adjustedY.value = viewportHeight - rect.height - 10;
      }
    }, 0);
  }
}, { immediate: true });

// Close on click outside
const handleClickOutside = (event) => {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    emit("close");
  }
};

// Close on escape
const handleKeydown = (event) => {
  if (event.key === "Escape") {
    emit("close");
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeydown);
});

const menuItems = [
  { id: "view", label: "View Details", icon: ExternalLink, event: "view" },
  { id: "edit", label: "Edit", icon: Edit2, event: "edit" },
  { id: "divider1", divider: true },
  { id: "call", label: "Call", icon: Phone, event: "call", condition: (m) => m?.contactNumber },
  { id: "email", label: "Email", icon: Mail, event: "email", condition: (m) => m?.email },
  { id: "divider2", divider: true },
  { id: "copy", label: "Copy Name", icon: Copy, event: "copy" },
  { id: "divider3", divider: true },
  { id: "delete", label: "Delete", icon: Trash2, event: "delete", danger: true },
];

const handleAction = (item) => {
  emit(item.event, props.member);
  emit("close");
};

const isItemVisible = (item) => {
  if (item.condition) {
    return item.condition(props.member);
  }
  return true;
};

// Check if divider should show (has visible items after it)
const shouldShowDivider = (index) => {
  const nextItems = menuItems.slice(index + 1);
  const nextNonDivider = nextItems.find(item => !item.divider);
  if (!nextNonDivider) return false;
  return isItemVisible(nextNonDivider);
};
</script>

<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="show && member"
        ref="menuRef"
        class="fixed z-[9999] min-w-[180px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 overflow-hidden"
        :style="{ left: `${adjustedX || x}px`, top: `${adjustedY || y}px` }"
      >
        <template v-for="(item, index) in menuItems" :key="item.id">
          <!-- Divider -->
          <div
            v-if="item.divider && shouldShowDivider(index)"
            class="h-px bg-gray-200 dark:bg-gray-700 my-1"
          />
          
          <!-- Menu Item -->
          <button
            v-else-if="!item.divider && isItemVisible(item)"
            @click="handleAction(item)"
            :class="[
              'w-full px-3 py-2 text-left text-sm flex items-center gap-3 transition-colors',
              item.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            ]"
          >
            <component :is="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu-enter-active,
.context-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
