# Augment 使用量追踪器

一个在VSCode状态栏显示Augment AI使用统计的扩展插件。

> **语言**: 中文 | [English](README_EN.md)

## ✨ 主要功能

- 📊 **实时监控**: 状态栏显示当前使用量和限额
- 🔄 **自动刷新**: 每60秒自动更新使用数据
- 🍪 **智能认证**: 支持多种cookie格式，自动过期检测
- 🌐 **简化登录**: VSCode内置输入框，无需复杂配置
- 📈 **使用详情**: 详细的使用统计和剩余额度
- 🌍 **多语言**: 支持中英文界面切换
- 🚪 **安全退出**: 一键清空所有认证数据
- 🔧 **状态恢复**: VSCode重启后自动恢复登录状态
- 🛠️ **智能调试**: 详细日志记录，便于问题排查

## 🚀 快速开始

1. 从VSCode插件商店安装插件
2. 运行 `Ctrl+Shift+P` → "Augment: Web Login"
3. 在打开的浏览器中登录Augment账户
4. 点击"🍪 配置Cookie"，在VSCode输入框中粘贴cookie
5. 在状态栏查看实时使用数据

> **💡 提示**: 插件会自动保存认证状态，VSCode重启后无需重新配置

## 🔧 常用命令

通过 `Ctrl+Shift+P` 打开命令面板，然后输入：

### 🔐 认证相关
- **🌐 网页自动登录** (`Augment Tracker: 🌐 Web Login (Auto)`) - 打开浏览器并引导配置认证
- **设置浏览器Cookie** (`Augment Tracker: Setup Browser Cookies`) - 直接在VSCode中输入cookie
- **🍪 检查Cookie状态** (`Augment Tracker: 🍪 Check Cookie Status`) - 查看cookie认证状态
- **检查认证状态** (`Augment Tracker: Check Authentication Status`) - 全面检查认证状态
- **🚪 退出登录** (`Augment Tracker: 🚪 Logout`) - 清空所有认证数据

### 📊 数据管理
- **🔄 手动刷新** (`Augment Tracker: 🔄 Manual Refresh`) - 立即更新使用数据
- **显示使用详情** (`Augment Tracker: Show Usage Details`) - 查看详细使用统计
- **重置使用统计** (`Augment Tracker: Reset Usage Statistics`) - 重置本地统计数据

### ⚙️ 设置配置
- **打开设置** (`Augment Tracker: Open Settings`) - 打开插件配置页面
- **🌐 设置语言** (`Augment Tracker: 🌐 Set Language`) - 切换中英文界面
- **🔄 刷新Cookie** (`Augment Tracker: 🔄 Refresh Cookie`) - 刷新cookie认证

## 📊 状态栏说明

状态栏显示您的当前使用情况：

```
Augment: 7/56 (12%)     # 已认证时
Augment: 未登录         # 未登录时
```

- **7/56**: 当前使用量 / 总限额
- **(12%)**: 使用百分比
- **点击**: 配置认证或查看详情

## ⚙️ 配置选项

在VSCode设置中搜索"augment"可配置：

- **启用追踪器**: 开启/关闭功能
- **刷新间隔**: 数据更新频率（默认60秒）
- **状态栏显示**: 是否在状态栏显示
- **界面语言**: 中文/英文切换

## 🔐 认证配置

1. 使用 `Augment: Setup Cookies` 命令
2. 在VSCode输入框中直接粘贴cookie
3. 系统自动验证并配置


> **🍪 支持的Cookie格式**:
> - 完整cookie字符串：`_session=eyJ...%%3D%%3D.sig; other=value`
> - 单独session值：`eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMjM0NX0.abc123`
> - URL编码格式：`eyJvYXV0aDI6c3RhdGUiOi...%%3D%%3D.signature`

## 🔧 高级功能

### 🍪 智能Cookie管理
- **自动验证**: 智能检测cookie格式和长度
- **过期检测**: 自动检测cookie过期状态
- **状态恢复**: VSCode重启后自动恢复认证状态

### 🔄 数据同步
- **实时更新**: 每60秒自动刷新使用数据
- **手动刷新**: 使用 `Augment: Manual Refresh` 命令
- **启动恢复**: 插件启动时自动检查并恢复状态
- **错误重试**: 网络错误时自动重试机制

### 🌍 用户体验
- **多语言**: 使用 `Augment: Set Language` 切换中英文
- **详细日志**: 开发者控制台提供详细调试信息
- **安全退出**: 使用 `Augment: Logout` 清空所有数据
- **状态提示**: 清晰的成功/失败/警告消息

## 🔍 故障排除

### 状态栏显示"未登录"
1. 运行 `Augment: Web Login` 命令重新配置
2. 使用 `Augment: Check Cookie Status` 检查认证状态
3. 尝试 `Augment: Manual Refresh` 手动更新数据
4. 如果VSCode重启后显示未登录，等待几秒钟让插件自动恢复状态

### Cookie配置失败
1. 确保cookie格式正确（包含`_session=`或以`eyJ`开头）
2. 检查cookie长度是否足够（>50字符）
3. 重新从浏览器获取完整的cookie
4. 使用 `Augment: Web Login` 重新配置认证

### VSCode重启后状态丢失
1. 等待10-15秒让插件自动恢复状态
2. 检查开发者控制台(F12)是否有恢复日志
3. 如果仍未恢复，使用 `Augment: Manual Refresh` 命令
4. 必要时重新运行 `Augment: Setup Cookies` 命令

### 数据不更新
1. 检查插件是否在设置中启用
2. 验证网络连接是否正常
3. 查看开发者控制台(F12)是否有错误
4. 检查cookie是否过期，必要时重新配置

## 🛡️ 隐私安全

所有认证数据都存储在本地VSCode中，不会向第三方发送任何数据。

## 📄 许可证

MIT许可证 - 详情请查看LICENSE文件。

## 📞 支持与反馈

- 在GitHub上报告问题
- 邮箱：wiq@live.com
- 在VSCode商店评分和评论

---

**在VSCode中高效监控您的Augment AI使用情况！**

## 🌟 主要优势

- **节省成本**: 避免意外的超额费用
- **提高效率**: 优化您的AI使用模式
- **保持知情**: 实时了解AI使用情况
- **简单设置**: 一键认证和配置
- **安全可靠**: 所有数据本地存储，无第三方共享

## 🔄 版本历史

### v1.0.4（当前版本）
- 🗑️ **命令简化**: 删除simpleCookieSetup命令，简化用户选择
- 🧹 **代码清理**: 移除约700行冗余代码，提高代码质量
- 📋 **命令优化**: 从11个命令精简到10个核心命令
- 🎯 **用户体验**: 专注于两种主要的Cookie配置方式
- 📖 **文档更新**: 同步更新中英文文档和故障排除指南
- 🌍 **国际化优化**: 解决所有硬编码文本问题，实现100%国际化覆盖
- 🔧 **用户信息显示修复**: 修复计划显示为[object Object]问题，完善弹出信息

### v1.0.3
- 🔧 **重大修复**: VSCode重启后状态自动恢复
- 🍪 **Cookie验证增强**: 支持URL编码和多种cookie格式
- 🌐 **简化登录流程**: 移除复杂的localhost服务器，使用VSCode内置输入
- 📊 **状态栏优化**: 改进显示逻辑和数据同步
- 🔍 **调试增强**: 添加详细的日志记录便于问题排查
- ⚡ **性能优化**: 改进API客户端初始化和数据加载
- 🛠️ **错误处理**: 增强网络错误和cookie过期的处理逻辑

### v1.0.2
- 🔧 修复数据固定值问题
- 📊 改进真实数据获取和显示
- 🔄 优化数据刷新机制

### v1.0.1
- 🔧 修复cookie配置问题
- 📈 改进使用数据解析
- 🌍 完善多语言支持

### v1.0.0
- ✅ 状态栏实时使用量监控
- ✅ 基于浏览器的自动认证
- ✅ 多语言支持（中英文）
- ✅ 智能Cookie管理和过期检测
- ✅ 安全退出和数据清理
- ✅ 手动刷新和详细使用统计
- ✅ 可配置的刷新间隔和显示选项

## 🤝 支持与反馈

如果您觉得这个插件有用，请：

- ⭐ 在VSCode商店给我们评分
- 🐛 在GitHub上报告问题或请求功能
- 💬 分享您的反馈和建议

**祝您使用Augment编程愉快！** 🎉
