# 隐藏书签持久化修复

## 问题描述

隐藏的书签在刷新页面后就消失了，这是因为隐藏状态没有正确持久化。

## 问题原因

### 1. Chrome书签API限制
- Chrome的 `chrome.bookmarks` API本身不支持 `hidden` 属性
- 隐藏状态只存在于书签管理器的内存数据中
- 刷新页面时，从Chrome API重新加载，隐藏状态丢失

### 2. 加载逻辑问题
- `loadBookmarks()` 方法直接从Chrome API加载
- 没有从storage恢复隐藏状态
- 导致隐藏属性丢失

## 修复方案

### 1. 优先从Storage加载
```javascript
// 尝试从storage恢复隐藏状态
const storedData = await this.loadBookmarksFromStorage();
if (storedData && storedData.length > 0) {
  // 验证存储的数据是否仍然有效
  if (this.validateStoredBookmarks(storedData, chromeBookmarks)) {
    // 存储的数据有效，使用存储的数据（包含隐藏属性）
    this.bookmarks = storedData;
    return;
  }
}
```

### 2. 合并隐藏状态
如果存储的数据结构已过期，但隐藏状态仍然有效：

```javascript
// 合并隐藏状态到Chrome书签数据
this.bookmarks = this.mergeHiddenState(chromeBookmarks, storedData);
```

### 3. 数据验证
确保存储的数据仍然有效：

```javascript
validateStoredBookmarks(storedData, chromeBookmarks) {
  // 检查存储的数据中的ID是否都存在于Chrome书签中
  // 如果书签被删除，存储的数据可能已过期
}
```

## 技术实现

### 1. 新增方法

#### loadBookmarksFromStorage()
从Chrome storage加载保存的书签数据（包含隐藏属性）

#### validateStoredBookmarks()
验证存储的书签数据是否仍然有效（检查ID是否存在）

#### mergeHiddenState()
将存储的隐藏状态合并到Chrome书签数据中

### 2. 加载流程

```
1. 尝试从Gitee加载（包含隐藏属性）
   ↓ 失败
2. 从Chrome API加载书签
   ↓
3. 从Storage加载隐藏状态
   ↓
4. 验证存储数据有效性
   ├─ 有效 → 使用存储数据（包含隐藏属性）
   └─ 无效 → 合并隐藏状态到Chrome数据
   ↓
5. 保存到Storage
```

### 3. 隐藏状态映射

```javascript
// 创建ID到隐藏状态的映射
const hiddenStateMap = new Map();
collectHiddenState(storedData);

// 恢复隐藏状态
if (hiddenStateMap.has(item.id)) {
  merged.hidden = hiddenStateMap.get(item.id);
}
```

## 功能特点

### 1. 数据持久化
- ✅ 隐藏状态保存到Chrome storage
- ✅ 刷新后自动恢复隐藏状态
- ✅ 支持跨会话持久化

### 2. 数据验证
- ✅ 验证存储数据的有效性
- ✅ 处理书签被删除的情况
- ✅ 自动合并过期数据

### 3. 兼容性
- ✅ 兼容Gitee同步
- ✅ 兼容Chrome书签API
- ✅ 向后兼容旧数据

## 测试步骤

### 1. 基本功能测试
1. 隐藏一些书签
2. 刷新页面
3. 验证隐藏的书签仍然保持隐藏状态

### 2. 数据持久化测试
1. 隐藏书签后关闭浏览器
2. 重新打开浏览器
3. 验证隐藏状态仍然保持

### 3. 数据验证测试
1. 隐藏一些书签
2. 在Chrome书签栏中删除一个隐藏的书签
3. 刷新页面
4. 验证其他隐藏书签仍然保持隐藏状态

### 4. 合并测试
1. 隐藏一些书签
2. 在Chrome书签栏中添加新书签
3. 刷新页面
4. 验证隐藏状态正确恢复，新书签正常显示

## 预期结果

- ✅ 隐藏的书签刷新后仍然保持隐藏
- ✅ 隐藏状态跨会话持久化
- ✅ 数据验证正确工作
- ✅ 合并逻辑正确处理
- ✅ 无数据丢失

## 注意事项

### 1. Storage限制
- Chrome storage有大小限制（通常5-10MB）
- 大量书签可能影响性能
- 建议定期清理过期数据

### 2. 数据同步
- 隐藏状态只在本地存储
- 通过Gitee同步时包含隐藏属性
- 不同设备间需要同步才能共享隐藏状态

### 3. 性能考虑
- 数据验证需要遍历所有书签
- 大量书签可能影响加载速度
- 已优化为单次遍历

## 技术要点

### 1. 数据持久化策略
- 使用Chrome storage作为主要存储
- Gitee作为备份和同步
- 内存数据作为运行时缓存

### 2. 状态恢复机制
- 优先使用完整存储数据
- 失败时合并隐藏状态
- 确保数据一致性

### 3. 错误处理
- 验证数据有效性
- 处理数据过期情况
- 优雅降级处理
