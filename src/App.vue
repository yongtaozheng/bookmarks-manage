<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import BookmarkTree from './components/BookmarkTree.vue'

interface BookmarkNode {
  id: string
  title: string
  url?: string
  children?: BookmarkNode[]
}

const bookmarks = ref<BookmarkNode[]>([])
const isNewtab = computed(() => window.location.pathname.endsWith('newtab.html'))

function fetchBookmarks() {
  if (typeof window !== 'undefined' && window.chrome && window.chrome.bookmarks) {
    (window.chrome.bookmarks.getTree as any)((nodes: BookmarkNode[]) => {
      // 只显示根目录下的第一级书签
      bookmarks.value = nodes[0]?.children || []
    })
  } else {
    // mock 数据，便于开发
    bookmarks.value = [
      {
        id: '1',
        title: '示例文件夹',
        children: [
          { id: '2', title: '百度', url: 'https://baidu.com' },
          { id: '3', title: '谷歌', url: 'https://google.com' }
        ]
      },
      {
        id: '4',
        title: '单独书签',
        url: 'https://example.com',
        children: []
      }
    ]
  }
}

function removeBookmark(id: string) {
  if (typeof window !== 'undefined' && window.chrome && window.chrome.bookmarks) {
    (window.chrome.bookmarks.remove as any)(id, () => {
      fetchBookmarks()
    })
  } else {
    bookmarks.value = bookmarks.value.filter(b => b.id !== id)
  }
}

onMounted(() => {
  if (isNewtab.value) fetchBookmarks()
  window.removeBookmarkById = (id: string) => removeBookmark(id)
})
</script>

<template>
  <div v-if="isNewtab" class="nt-container">
    <div class="nt-card">
      <h1>书签管理器</h1>
      <div class="nt-tree-container">
        <BookmarkTree :nodes="bookmarks" :defaultExpandAll="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.nt-container {
  height: 100vh;
  width: 100vw;
  background: var(--main-bg, #f6fafc);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.nt-card {
  background: var(--main-card, #fff);
  border-radius: 16px;
  box-shadow: 0 2px 16px 0 rgba(60, 60, 60, 0.08);
  padding: 2em 2em 1.5em 2em;
  min-width: 340px;
  max-width: 600px;
  width: 100vw;
  height: 90vh;
  border: 1.5px solid var(--main-border, #e0e0e0);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.nt-tree-container {
  width: 100%;
  flex: 1 1 0;
  overflow-y: auto;
  background: var(--main-bluegray, #e3eefa);
  border-radius: 8px;
  padding: 1em 1em 0.5em 1em;
  box-sizing: border-box;
  border: 1px solid var(--main-border, #e0e0e0);
  height: 100%;
  min-height: 0;
}
.nt-tree {
  list-style: none;
  padding-left: 0;
  margin: 0;
}
.nt-tree > li {
  margin-bottom: 0.3em;
  padding-left: 0.5em;
  position: relative;
  font-size: 1em;
  line-height: 1.7;
  word-break: break-all;
}
.folder {
  font-weight: 600;
  color: #1976d2;
  margin-top: 0.5em;
  cursor: pointer;
}
.folder-toggle {
  cursor: pointer;
  user-select: none;
  margin-right: 0.2em;
}
.nt-tree li ul {
  margin-left: 1.2em;
  border-left: 2px solid var(--main-border, #e0e0e0);
  padding-left: 0.8em;
}
a {
  color: #1976d2;
  text-decoration: none;
  margin-right: 0.5em;
  transition: color 0.2s;
}
a:hover {
  color: #42b983;
  text-decoration: underline;
}
button.delete-btn {
  background: #f44336;
  color: #fff;
  border: none;
  border-radius: 3px;
  padding: 0.1em 0.6em;
  font-size: 0.95em;
  margin-left: 0.3em;
  cursor: pointer;
  transition: background 0.2s;
}
button.delete-btn:hover {
  background: #c62828;
}
@media (max-width: 700px) {
  .nt-card {
    min-width: 0;
    max-width: 98vw;
    padding: 1em 0.5em 1em 0.5em;
  }
  .nt-tree-container {
    padding: 0.7em 0.2em 0.3em 0.7em;
  }
}
@media (max-width: 500px) {
  .nt-card {
    min-width: 0;
    max-width: 100vw;
    padding: 0.5em 0.1em 0.5em 0.1em;
  }
}
@media (prefers-color-scheme: dark) {
  .nt-container {
    background: #23272f;
  }
  .nt-card {
    background: #2c313a;
    border: 1.5px solid #444;
    box-shadow: 0 2px 16px 0 rgba(0,0,0,0.18);
  }
  h1 {
    color: #b6f2d6;
  }
  input {
    background: #23272f;
    color: #e0e0e0;
    border: 1.5px solid #444;
  }
  input:focus {
    border: 1.5px solid #42b983;
    box-shadow: 0 0 0 2px #42b98344;
  }
  .nt-tree-container {
    background: #23272f;
    border: 1px solid #444;
  }
  .nt-tree li ul {
    border-left: 2px solid #444;
  }
  .folder {
    color: #7ecfff;
  }
}
</style>
