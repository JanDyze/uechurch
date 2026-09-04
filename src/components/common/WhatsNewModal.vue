<script setup>
import { computed } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  open: Boolean,
  versionInfo: Object,
})

const emit = defineEmits(['close'])

const formattedDate = computed(() => {
  if (!props.versionInfo?.date) return ''
  return props.versionInfo.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')">
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="version-title">
          <!-- Close button -->
          <button
            class="close-button"
            @click="emit('close')"
            aria-label="Close what's new modal"
          >
            <XMarkIcon class="w-6 h-6" />
          </button>

          <!-- Header -->
          <div class="modal-header">
            <div class="version-badge">v{{ versionInfo?.version }}</div>
            <h2 id="version-title" class="modal-title">{{ versionInfo?.title }}</h2>
            <p class="modal-subtitle">{{ versionInfo?.description }}</p>
            <p class="release-date">Released {{ formattedDate }}</p>
          </div>

          <!-- Breaking Changes Badge -->
          <div v-if="versionInfo?.breaking" class="breaking-badge">
            ⚠️ Breaking Changes in this release
          </div>

          <!-- Changes List -->
          <div class="changes-section">
            <h3 class="section-title">What's New</h3>
            <ul class="changes-list">
              <li v-for="(change, index) in versionInfo?.changes" :key="index" class="change-item">
                <span class="change-bullet">✨</span>
                <span class="change-text">{{ change }}</span>
              </li>
            </ul>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="dismiss-button" @click="emit('close')">
              Got it!
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal-content {
  background: var(--color-surface, white);
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  display: flex;
  flex-direction: column;
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #6b7280);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  z-index: 10;
}

.close-button:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--color-text-primary, #111827);
}

.modal-header {
  padding: 2.5rem 2rem 1.5rem 2rem;
  text-align: center;
}

.version-badge {
  display: inline-block;
  background: var(--color-primary, #3b82f6);
  color: white;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.modal-title {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0.75rem 0 0.5rem 0;
  color: var(--color-text-primary, #111827);
}

.modal-subtitle {
  font-size: 1rem;
  color: var(--color-text-secondary, #6b7280);
  margin: 0.5rem 0;
}

.release-date {
  font-size: 0.875rem;
  color: var(--color-text-tertiary, #9ca3af);
  margin-top: 0.75rem;
}

.breaking-badge {
  background: #fee2e2;
  border-left: 4px solid #ef4444;
  color: #991b1b;
  padding: 1rem;
  margin: 1rem 1.5rem;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.changes-section {
  padding: 1.5rem 2rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0 0 1rem 0;
}

.changes-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.change-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.change-bullet {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.change-text {
  flex: 1;
}

.modal-footer {
  padding: 1.5rem 2rem 2rem;
  display: flex;
  gap: 1rem;
  margin-top: auto;
}

.dismiss-button {
  flex: 1;
  background: var(--color-primary, #3b82f6);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dismiss-button:hover {
  background: var(--color-primary-hover, #2563eb);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.dismiss-button:active {
  transform: translateY(0);
}

/* Animations */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-content {
  animation: modal-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-fade-leave-active .modal-content {
  animation: modal-slide-down 0.2s ease;
}

@keyframes modal-slide-up {
  from {
    transform: translateY(2rem);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes modal-slide-down {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(2rem);
    opacity: 0;
  }
}

/* Responsive */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
  }

  .modal-content {
    border-radius: 1rem 1rem 0 0;
    max-height: 95vh;
  }

  .modal-header {
    padding: 2rem 1.5rem 1rem 1.5rem;
  }

  .modal-title {
    font-size: 1.5rem;
  }

  .changes-section {
    padding: 1rem 1.5rem;
  }

  .modal-footer {
    padding: 1rem 1.5rem 1.5rem;
  }
}
</style>
