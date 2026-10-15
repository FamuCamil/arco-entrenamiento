import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'

import App from './App.vue'
import router from './router'
import { requestPersistentStorage } from './composables/usePersistence'
import './styles/tokens.css'

createApp(App).use(createPinia()).use(router).mount('#app')

// Reduce eviction risk of device-local data (fire-and-forget, never throws).
void requestPersistentStorage()

// Updates are silent by user decision: no notice is shown, and the page reloads once when a
// new service worker takes control. No-op where service workers are unsupported.
registerSW({ immediate: true })
