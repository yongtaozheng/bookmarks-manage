/*
 * @Author: zheng yong tao
 * @Date: 2025-07-18 17:06:35
 * @LastEditors: zheng yong tao
 * @LastEditTime: 2025-07-18 17:45:45
 * @Description: 
 */
import { createApp } from 'vue'
import App from './App.vue'

// 仅在 newtab.html 挂载 Vue 应用
if (window.location.pathname.endsWith('newtab.html')) {
  createApp(App).mount('#app')
}
