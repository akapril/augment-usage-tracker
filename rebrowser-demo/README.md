# Rebrowser-Puppeteer 反检测技术演示

这是一个完整的Rebrowser-Puppeteer反检测技术演示项目，展示了如何使用2025年最新的反机器人检测技术。

## 🎯 项目特色

- ✅ **最新技术**：基于2025年最新的Rebrowser-Puppeteer技术
- ✅ **完整示例**：从基础到高级的完整演示
- ✅ **实战测试**：针对真实反检测网站的测试
- ✅ **详细文档**：完整的使用指南和最佳实践

## 🛠️ 技术原理

Rebrowser-Puppeteer通过以下技术实现反检测：

1. **底层补丁**：对Puppeteer进行底层修改，移除自动化标记
2. **API兼容**：保持与原生Puppeteer完全兼容的API
3. **指纹伪造**：自动处理常见的浏览器指纹检测
4. **行为模拟**：支持真实用户行为模拟

## 📦 安装依赖

```bash
cd rebrowser-demo
npm install
```

## 🚀 快速开始

### 1. 基础示例
演示Rebrowser-Puppeteer的基本使用方法：

```bash
npm run basic
```

**功能特点**：
- 使用Rebrowser-Puppeteer替代原生Puppeteer
- 访问常见的机器人检测网站
- 自动检测和报告检测结果
- 生成测试截图

### 2. 高级示例
展示完整的反检测技术栈：

```bash
npm run advanced
```

**功能特点**：
- 注入自定义反检测脚本
- 模拟真实用户行为（鼠标移动、滚动、打字）
- 随机User-Agent和请求头
- 高级指纹伪造技术

### 3. 检测测试
专门测试各种反机器人检测网站：

```bash
npm run test-detection
```

**测试网站**：
- BrowserLeaks JavaScript检测
- Sannysoft机器人检测
- IntroHacker无头浏览器检测

### 4. Cloudflare测试
专门针对Cloudflare反机器人保护：

```bash
npm run cloudflare-test
```

**功能特点**：
- 自动等待Cloudflare挑战完成
- 多次重试机制
- 详细的状态分析
- 成功率统计

## 📊 测试结果示例

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
   URL: https://browserleaks.com/javascript
   访问: ✅
   检测: 🟢 未检测
   详情:
     - webdriver: undefined
     - 自动化检测: false
     - plugins数量: 5

2. Sannysoft Bot Detection
   URL: https://bot.sannysoft.com/
   访问: ✅
   检测: 🟢 未检测
   详情:
     - webdriver: undefined
     - 自动化检测: false
     - plugins数量: 5
```

## 🔧 配置说明

### 基础配置
```javascript
import puppeteer from 'rebrowser-puppeteer';

const browser = await puppeteer.launch({
    headless: false,  // 推荐使用非无头模式
    defaultViewport: null,
    args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // 更多反检测参数...
    ]
});
```

### 高级配置
```javascript
// 设置User-Agent
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...');

// 设置视口
await page.setViewport({ width: 1366, height: 768 });

// 设置额外请求头
await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
});
```

## 🎭 行为模拟技术

### 鼠标移动模拟
```javascript
async function humanMouseMove(page, targetX, targetY) {
    const steps = Math.floor(Math.random() * 10) + 10;
    // 分步移动到目标位置，添加随机偏移
    for (let i = 0; i < steps; i++) {
        const x = currentX + deltaX * i + (Math.random() - 0.5) * 2;
        const y = currentY + deltaY * i + (Math.random() - 0.5) * 2;
        await page.mouse.move(x, y);
        await randomDelay(10, 50);
    }
}
```

### 滚动行为模拟
```javascript
async function humanScroll(page) {
    const scrollSteps = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < scrollSteps; i++) {
        const scrollY = Math.floor(Math.random() * 300) + 100;
        await page.evaluate((y) => window.scrollBy(0, y), scrollY);
        await randomDelay(500, 1500);
    }
}
```

## 🛡️ 反检测脚本

项目包含完整的反检测脚本，自动处理：

- `navigator.webdriver` 属性隐藏
- `window.chrome` 对象伪造
- `navigator.plugins` 数量模拟
- `navigator.languages` 设置
- Canvas指纹伪造
- 权限API模拟

## 📈 性能优化

### 资源优化
```javascript
// 禁用图片加载（可选）
await page.setRequestInterception(true);
page.on('request', (req) => {
    if(req.resourceType() == 'image'){
        req.abort();
    } else {
        req.continue();
    }
});
```

### 内存管理
```javascript
// 及时关闭页面
await page.close();

// 清理浏览器实例
await browser.close();
```

## ⚠️ 注意事项

### 技术限制
- Rebrowser-Puppeteer仍然基于CDP，可能被高级检测识别
- 某些网站可能使用机器学习检测，需要更复杂的行为模拟
- 检测技术在不断进步，需要定期更新反检测策略

### 合规使用
- 遵守网站的robots.txt和使用条款
- 控制请求频率，避免对服务器造成压力
- 确保数据使用符合相关法律法规

### 最佳实践
- 使用高质量的住宅代理
- 实现随机延迟和行为模拟
- 定期更新User-Agent和浏览器版本
- 监控检测率并及时调整策略

## 🔗 相关资源

- [Rebrowser-Puppeteer GitHub](https://github.com/rebrowser/rebrowser-puppeteer)
- [Puppeteer官方文档](https://pptr.dev/)
- [反检测技术研究报告](../research-report.md)

## 📝 更新日志

### v1.0.0 (2025-06-19)
- 初始版本发布
- 完整的Rebrowser-Puppeteer演示
- 基础和高级示例
- 检测测试和Cloudflare测试
- 详细的使用文档

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
