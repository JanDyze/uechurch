import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import router from './router'
import { initAppSettings } from './composables/useAppSettings'

// PWA service worker — auto-updates when a new version is deployed.
//
// `autoUpdate` already handles the swap: once a new worker takes control the
// plugin reloads the page. What it does not do is go looking. A browser only
// checks for a new worker on a hard navigation or roughly every 24 hours, and
// a phone that resumes the installed app from the home screen does neither —
// so a deploy could sit unnoticed for a day while the congregation kept
// running the old build. These three triggers are what actually close that gap.
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000 // hourly, for sessions left open

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return

    const checkForUpdate = () => {
      // update() throws when offline or when the worker is mid-install; a
      // failed check is never worth surfacing, the next trigger will retry.
      if (navigator.onLine) registration.update().catch(() => {})
    }

    // The one that matters most on a phone: coming back to the app.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
    window.addEventListener('online', checkForUpdate)
    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL)
  },
})

// Church name and category vocabularies come from Firestore; start listening
// before the first render so nothing flashes the built-in defaults.
initAppSettings()

const app = createApp(App)

app.use(router)

app.mount('#app')
