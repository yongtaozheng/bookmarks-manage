/*
 * @Author: zheng yong tao
 * @Date: 2025-07-18 17:06:35
 * @LastEditors: zheng yong tao
 * @LastEditTime: 2025-07-21 09:55:42
 * @Description: 
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.'
        },
        {
          src: 'public/icon.jpg',
          dest: '.'
        }
      ]
    })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(process.cwd(), 'popup.html'),
        'content-search': resolve(process.cwd(), 'src/content-search.ts'),
        background: resolve(process.cwd(), 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
  }
})
