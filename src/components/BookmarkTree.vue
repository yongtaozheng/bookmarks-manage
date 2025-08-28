<script setup lang="ts">
import { defineProps, ref, onMounted } from 'vue'

interface BookmarkNode {
  id: string
  title: string
  url?: string
  children?: BookmarkNode[]
}

const props = defineProps<{ nodes: BookmarkNode[], defaultExpandAll?: boolean }>()
const expanded = ref<Record<string, boolean>>({})

function toggleExpand(id: string) {
  expanded.value[id] = !expanded.value[id]
}
function isExpanded(id: string) {
  return expanded.value[id]
}
function removeBookmark(id: string) {
  (window as any).removeBookmarkById && (window as any).removeBookmarkById(id)
}

// 默认展开第一级
onMounted(() => {
  if (props.defaultExpandAll) {
    (props.nodes || []).forEach(node => {
      if (!node.url) expanded.value[node.id] = true
    })
  }
})
</script>

<template>
  <ul class="nt-tree">
    <template v-for="node in props.nodes" :key="node.id">
      <li v-if="node.url">
        <a :href="node.url" target="_blank">{{ node.title }}</a>
        <button class="delete-btn" @click="removeBookmark(node.id)">删除</button>
      </li>
      <li v-else class="folder">
        <span class="folder-toggle" @click="toggleExpand(node.id)">
          {{ isExpanded(node.id) ? '▼' : '▶' }} {{ node.title }}
        </span>
        <BookmarkTree v-if="node.children && node.children.length && isExpanded(node.id)" :nodes="node.children" />
      </li>
    </template>
  </ul>
</template>

<style scoped>
.nt-tree {
  list-style: none;
  padding-left: 0;
  margin: 0;
  font-family: var(--font-family-primary);
}
.nt-tree > li {
  margin-bottom: 0.3em;
  padding-left: 0.5em;
  position: relative;
  font-size: var(--font-size-lg);
  line-height: 1.7;
  word-break: break-all;
  font-family: var(--font-family-primary);
}
.folder {
  font-weight: 600;
  color: #1976d2;
  margin-top: 0.5em;
  cursor: pointer;
  font-family: var(--font-family-primary);
}
.folder-toggle {
  cursor: pointer;
  user-select: none;
  margin-right: 0.2em;
  font-family: var(--font-family-primary);
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
  font-family: var(--font-family-primary);
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
  font-size: var(--font-size-base);
  font-family: var(--font-family-primary);
  margin-left: 0.3em;
  cursor: pointer;
  transition: background 0.2s;
}
button.delete-btn:hover {
  background: #c62828;
}
@media (prefers-color-scheme: dark) {
  .folder {
    color: #7ecfff;
  }
  .nt-tree li ul {
    border-left: 2px solid #444;
  }
}
</style> 