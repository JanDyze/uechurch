<script setup>
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { Bell, Sun, Moon } from "lucide-vue-next";
import { useTheme } from "../composables/useTheme";
import logo from "../assets/uec-logo.png";

const route = useRoute();
const { isDark, toggleTheme } = useTheme();
const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const pageTitle = computed(() => {
  const routeNames = {
    Home: 'Dashboard',
    Members: 'Members',
    Events: 'Events',
    Sermons: 'Sermons',
    Finances: 'Finances',
    Ministries: 'Ministries',
    Settings: 'Settings'
  };
  return routeNames[route.name] || 'Dashboard';
});
</script>

<template>
  <header class="bg-white dark:bg-gray-800 sticky top-0 z-40">
    <div class="px-4 sm:px-6 lg:px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-3">
          <div>
            <div class="text-xl font-bold text-[#01779b] dark:text-[#22b8cf]">
              {{ pageTitle }}
            </div>
          </div>
        </div>
        <!-- Right: User menu and notifications -->
        <div class="flex items-center gap-2">
          <!-- Theme Toggle -->
          <button
            @click="toggleTheme($event)"
            class="p-2 rounded-full text-[#01779b] dark:text-[#22b8cf] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <Sun v-if="isDark" class="w-5 h-5" />
            <Moon v-else class="w-5 h-5" />
          </button>

          <!-- Notifications -->
          <button
            class="p-2 rounded-full text-[#01779b] dark:text-[#22b8cf] hover:bg-gray-100 dark:hover:bg-gray-700 relative"
          >
            <Bell class="w-6 h-6" />
            <span
              class="absolute top-1 right-1 w-2 h-2 bg-[#bc1c09] rounded-full"
            ></span>
          </button>

          <!-- User profile (using online mock avatar API) -->
          <button
            class="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img
              src="https://api.dicebear.com/9.x/pixel-art/svg?seed=UEC"
              alt="User Avatar"
              class="w-8 h-8 rounded-full object-cover"
            />
          </button>
          
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* Additional styles if needed */
</style>
