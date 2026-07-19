import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import router from './router'

// PWA service worker — auto-updates when a new version is deployed
registerSW({ immediate: true })

const app = createApp(App)

app.use(router)

app.mount('#app')
