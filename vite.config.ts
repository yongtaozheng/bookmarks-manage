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

/**
 * 自定义插件：将 Chrome 扩展的 content script 和 background script
 * 单独以 IIFE 格式打包（Chrome 不支持 content_scripts 使用 ES modules）
 */
function chromeExtensionScripts(entries: string[]) {
  return {
    name: 'chrome-extension-scripts',
    async closeBundle() {
      const esbuild = await import('esbuild')
      for (const entry of entries) {
        const name = entry.replace(/\.[^.]+$/, '').replace(/^.*\//, '')
        await esbuild.build({
          entryPoints: [resolve(process.cwd(), entry)],
          bundle: true,
          format: 'iife' as const,
          outfile: resolve(process.cwd(), `dist/${name}.js`),
          target: 'chrome100',
        })
      }
    },
  }
}

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
          src: 'public/icon.png',
          dest: '.'
        },
        {
          src: '_locales',
          dest: '.'
        }
      ]
    }),
    // content-search 和 background 需要以 IIFE 格式打包
    // 因为 Chrome content_scripts 和 service_worker 不支持 ES modules 的 import 语句
    chromeExtensionScripts([
      'src/content-search.ts',
      'src/background.ts',
    ]),
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(process.cwd(), 'popup.html'),
        'bookmark-manager': resolve(process.cwd(), 'bookmark-manager.html'),
        'bookmark-manager-js': resolve(process.cwd(), 'src/bookmark-manager.js'),
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
