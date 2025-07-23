/*
 * @Author: zheng yong tao
 * @Date: 2025-07-18 17:06:35
 * @LastEditors: zheng yong tao
 * @LastEditTime: 2025-07-21 10:00:26
 * @Description: 
 */
/// <reference types="vite/client" />

interface Window {
  removeBookmarkById?: (id: string) => void
  chrome?: any
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
