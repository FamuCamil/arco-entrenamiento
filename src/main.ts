import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { requestPersistentStorage } from './composables/usePersistence'
import './styles/tokens.css'

createApp(App).use(createPinia()).use(router).mount('#app')

// Reduce eviction risk of device-local data (fire-and-forget, never throws).
void requestPersistentStorage()
