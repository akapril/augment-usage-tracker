# 🚀 Rebrowser-Puppeteer 快速开始指南

## 📋 系统要求

- **Node.js**: 16.0.0 或更高版本
- **操作系统**: Windows, macOS, Linux
- **内存**: 至少 4GB RAM
- **网络**: 稳定的互联网连接

## ⚡ 一键运行

### 方法1: 使用自动化脚本（推荐）

```bash
# 进入演示目录
cd rebrowser-demo

# 一键设置并运行基础演示
node install-and-run.js setup
node install-and-run.js basic
```

### 方法2: 手动安装

```bash
# 进入演示目录
cd rebrowser-demo

# 安装依赖
npm install

# 运行基础演示
npm run basic
```

## 🎯 演示选择

### 1. 基础演示 (推荐新手)
```bash
node install-and-run.js basic
# 或
npm run basic
```
**演示内容**：
- Rebrowser-Puppeteer基本使用
- 访问检测网站并查看结果
- 自动截图保存

### 2. 高级演示 (推荐进阶用户)
```bash
node install-and-run.js advanced
# 或
npm run advanced
```
**演示内容**：
- 完整的反检测技术栈
- 真实用户行为模拟
- 高级指纹伪造

### 3. 检测测试 (验证效果)
```bash
node install-and-run.js detection
# 或
npm run test-detection
```
**演示内容**：
- 多个检测网站测试
- 详细的检测报告
- 成功率统计

### 4. Cloudflare测试 (实战应用)
```bash
node install-and-run.js cloudflare
# 或
npm run cloudflare-test
```
**演示内容**：
- Cloudflare反机器人保护绕过
- 自动挑战等待
- 多次重试机制

### 5. 运行所有演示
```bash
node install-and-run.js all
```

## 📊 预期结果

### 成功的输出示例
```
🚀 启动 Rebrowser-Puppeteer 基础示例...
✅ 浏览器启动成功
📄 页面创建成功，开始访问测试网站...

🔍 测试网站: BrowserLeaks - 基础检测
📝 描述: 检测JavaScript环境和自动化标记
🌐 URL: https://browserleaks.com/javascript
✅ 页面加载成功
📋 页面标题: JavaScript Browser Information

🔍 检测结果:
   - navigator.webdriver: undefined
   - window.chrome: true
   - plugins数量: 5
   - 语言设置: ["en-US","en"]

📸 截图已保存: screenshots/BrowserLeaks___基础检测.png
🎉 基础示例测试完成！
```

### 检测测试报告示例
```
📊 检测测试报告
==================================================
总测试数: 3
成功访问: 3
未被检测: 2
检测率: 33.3%
成功率: 66.7%

详细结果:

1. BrowserLeaks JavaScript
   访问: ✅
   检测: 🟢 未检测

2. Sannysoft Bot Detection  
   访问: ✅
   检测: 🟢 未检测

3. IntroHacker Bot Test
   访问: ✅
   检测: 🔴 被检测
```

## 🔧 常见问题

### Q1: 安装依赖失败
**解决方案**：
```bash
# 清理npm缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install
```

### Q2: 浏览器启动失败
**解决方案**：
```bash
# 检查Chrome是否已安装
google-chrome --version

# 或者安装Chromium
sudo apt-get install chromium-browser
```

### Q3: 权限错误 (Linux)
**解决方案**：
```bash
# 添加必要的启动参数
export PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox"
```

### Q4: 网络连接问题
**解决方案**：
- 检查网络连接
- 如果在中国大陆，可能需要配置代理
- 某些测试网站可能被防火墙阻止

## 🎭 自定义配置

### 修改User-Agent
编辑 `src/basic-example.js`:
```javascript
await page.setUserAgent('你的自定义User-Agent');
```

### 添加代理
编辑启动参数:
```javascript
const browser = await puppeteer.launch({
    args: [
        '--proxy-server=http://your-proxy:port'
    ]
});
```

### 修改测试网站
编辑测试网站列表:
```javascript
const testSites = [
    {
        name: '你的测试网站',
        url: 'https://example.com',
        description: '网站描述'
    }
];
```

## 📸 查看结果

演示运行后，检查以下位置：

- **截图**: `screenshots/` 目录
- **日志**: 控制台输出
- **测试报告**: 控制台中的详细报告

## 🔄 下一步

1. **学习源码**: 查看 `src/` 目录中的示例代码
2. **阅读文档**: 查看 `README.md` 了解详细信息
3. **自定义开发**: 基于示例代码开发自己的应用
4. **性能优化**: 根据实际需求调整配置参数

## 🆘 获取帮助

如果遇到问题：

1. **查看日志**: 仔细阅读控制台输出的错误信息
2. **检查网络**: 确保能正常访问测试网站
3. **更新依赖**: 尝试更新到最新版本
4. **查看文档**: 阅读完整的 README.md

## 🎯 成功指标

演示成功运行的标志：

- ✅ 浏览器能正常启动
- ✅ 能访问测试网站
- ✅ `navigator.webdriver` 显示为 `undefined`
- ✅ 生成测试截图
- ✅ 检测成功率 > 50%

恭喜！您已经成功运行了Rebrowser-Puppeteer反检测演示。现在可以开始探索更高级的功能了！
