import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import router from './router'
import { initAppSettings } from './composables/useAppSettings'

// PWA service worker — auto-updates when a new version is deployed
registerSW({ immediate: true })

// Church name and category vocabularies come from Firestore; start listening
// before the first render so nothing flashes the built-in defaults.
initAppSettings()

const app = createApp(App)

app.use(router)

app.mount('#app')
