# 🛠️ 日记本插件安装和故障排除指南

## 📦 安装步骤

### 1. 文件放置
将整个 `SillyTavern-Diary` 文件夹放置到以下目录：
```
[SillyTavern目录]/public/scripts/extensions/third-party/SillyTavern-Diary/
```

### 2. 重启SillyTavern
完全关闭并重新启动SillyTavern

### 3. 启用插件
1. 在SillyTavern中打开"扩展"页面
2. 找到"📖 日记本 Diary"并启用
3. 等待初始化完成（约3秒）

## ✅ 验证安装

在浏览器控制台中应该看到以下日志：
```
[日记本] 开始初始化插件...
[日记本] 界面已加载
[日记本] 设置已加载
[日记本] 事件处理器已绑定
[日记本] 开始延迟初始化...
[日记本] 插件初始化完全成功
```

## 🐛 常见问题和解决方案

### 问题1: 插件页面空白
**症状**: 扩展设置页面变成空白
**原因**: 插件初始化错误导致整个扩展系统崩溃
**解决方案**:
1. 打开浏览器开发者工具（F12）
2. 查看控制台错误信息
3. 清除浏览器缓存并重启SillyTavern
4. 确保文件路径正确

### 问题2: API调用错误
**症状**: 控制台显示 `executeSlashCommandsWithOptions is not a function`
**原因**: SillyTavern版本不兼容或API未完全加载
**解决方案**: ✅ **已修复** - 插件现在使用兼容的API调用方式

### 问题3: 扩展设置无法保存
**症状**: 设置更改后不生效
**原因**: extension_settings访问权限问题
**解决方案**: ✅ **已修复** - 使用多重备用存储机制

### 问题4: 世界书操作失败
**症状**: 无法创建或读取日记数据
**原因**: 世界书API不可用或权限不足
**解决方案**: ✅ **已修复** - 增加了容错机制，即使世界书API不可用插件也能正常运行

## 🔧 高级故障排除

### 手动检查插件状态
在浏览器控制台中运行：
```javascript
// 检查插件是否加载
console.log(window.diaryPlugin);

// 检查核心模块状态
console.log('存储模块:', window.diaryPlugin.getStorage());
console.log('预设管理器:', window.diaryPlugin.getPresetManager());
console.log('当前设置:', window.diaryPlugin.getSettings());
```

### 重新初始化插件
如果插件出现问题，可以尝试重新初始化：
```javascript
// 重新初始化所有模块
await window.diaryPlugin.reinitialize();
```

### 清除插件数据
如果需要完全重置插件：
```javascript
// 清除扩展设置
delete extension_settings.diary;
// 或清除localStorage
localStorage.removeItem('SillyTavern_extensionSettings');
```

## 📋 功能限制说明

由于SillyTavern API的限制，某些功能可能受影响：

### 完全可用的功能 ✅
- 插件界面显示
- 基础设置保存
- 日记本UI界面
- 手动记录功能（如果消息格式正确）

### 可能受限的功能 ⚠️
- 自动预设切换（取决于API可用性）
- 世界书自动创建（取决于权限）
- 自动删除聊天记录（取决于slash命令支持）

### 备用方案
- 如果自动功能不可用，插件会优雅降级到手动模式
- 所有核心功能都有备用实现
- 错误不会导致插件或SillyTavern崩溃

## 🆘 获取帮助

如果遇到问题：
1. 检查浏览器控制台的错误信息
2. 确认SillyTavern版本兼容性
3. 尝试重新安装插件
4. 查看详细的日志信息

## 📱 移动端说明

插件支持移动端使用，但某些功能可能有延迟：
- 初始化时间可能更长（最多10秒）
- 预设切换需要更多等待时间
- 界面经过移动端优化

---

**注意**: 这是修复版本，解决了与SillyTavern API兼容性的所有已知问题。如果仍有问题，请检查SillyTavern版本是否为最新稳定版。
