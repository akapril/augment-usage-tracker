/**
 * Rebrowser-Puppeteer 高级示例
 * 演示完整的反检测技术，包括行为模拟、代理使用、指纹伪造等
 */

import puppeteer from 'rebrowser-puppeteer';
import UserAgent from 'user-agents';

class AdvancedStealth {
    constructor() {
        this.userAgent = new UserAgent();
    }

    /**
     * 获取随机User-Agent
     */
    getRandomUserAgent() {
        return this.userAgent.toString();
    }

    /**
     * 模拟人类鼠标移动
     */
    async humanMouseMove(page, targetX, targetY) {
        const currentMouse = await page.evaluate(() => ({
            x: window.mouseX || 0,
            y: window.mouseY || 0
        }));

        const steps = Math.floor(Math.random() * 10) + 10;
        const deltaX = (targetX - currentMouse.x) / steps;
        const deltaY = (targetY - currentMouse.y) / steps;

        for (let i = 0; i < steps; i++) {
            const x = currentMouse.x + deltaX * i + (Math.random() - 0.5) * 2;
            const y = currentMouse.y + deltaY * i + (Math.random() - 0.5) * 2;
            
            await page.mouse.move(x, y);
            await this.randomDelay(10, 50);
        }

        // 最后移动到精确位置
        await page.mouse.move(targetX, targetY);
    }

    /**
     * 随机延迟
     */
    async randomDelay(min = 100, max = 300) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * 模拟人类滚动行为
     */
    async humanScroll(page) {
        const scrollSteps = Math.floor(Math.random() * 5) + 3;
        
        for (let i = 0; i < scrollSteps; i++) {
            const scrollY = Math.floor(Math.random() * 300) + 100;
            await page.evaluate((y) => {
                window.scrollBy(0, y);
            }, scrollY);
            
            await this.randomDelay(500, 1500);
        }
    }

    /**
     * 模拟人类打字
     */
    async humanType(page, selector, text) {
        await page.click(selector);
        await this.randomDelay(100, 300);
        
        for (const char of text) {
            await page.type(selector, char, {
                delay: Math.floor(Math.random() * 100) + 50
            });
        }
    }

    /**
     * 注入反检测脚本
     */
    async injectAntiDetectionScripts(page) {
        await page.evaluateOnNewDocument(() => {
            // 隐藏webdriver属性
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // 修改plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // 修改languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // 修改chrome对象
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };

            // 修改permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // 伪造canvas指纹
            const getImageData = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(type) {
                if (type === 'image/png') {
                    const dataURL = getImageData.apply(this, arguments);
                    return dataURL.replace(/^data:image\/png;base64,/, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
                }
                return getImageData.apply(this, arguments);
            };
        });
    }
}

async function advancedExample() {
    console.log('🚀 启动 Rebrowser-Puppeteer 高级示例...');
    
    const stealth = new AdvancedStealth();
    let browser;
    
    try {
        // 启动浏览器，使用更多反检测配置
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-field-trial-config',
                '--disable-back-forward-cache',
                '--disable-ipc-flooding-protection',
                '--enable-features=NetworkService,NetworkServiceLogging',
                '--force-color-profile=srgb',
                '--metrics-recording-only',
                '--use-mock-keychain'
            ]
        });

        console.log('✅ 浏览器启动成功');

        // 创建新页面
        const page = await browser.newPage();
        
        // 注入反检测脚本
        await stealth.injectAntiDetectionScripts(page);
        
        // 设置随机User-Agent
        const randomUA = stealth.getRandomUserAgent();
        await page.setUserAgent(randomUA);
        console.log(`🎭 使用User-Agent: ${randomUA}`);
        
        // 设置视口大小（模拟真实设备）
        await page.setViewport({ 
            width: 1366, 
            height: 768,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false
        });

        // 设置额外的请求头
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        });

        console.log('📄 页面配置完成，开始高级测试...');

        // 测试网站列表
        const testSites = [
            {
                name: 'Cloudflare Challenge',
                url: 'https://nopecha.com/demo/cloudflare',
                description: 'Cloudflare反机器人挑战'
            },
            {
                name: 'Advanced Bot Detection',
                url: 'https://bot.sannysoft.com/',
                description: '高级机器人检测'
            },
            {
                name: 'Canvas Fingerprinting Test',
                url: 'https://browserleaks.com/canvas',
                description: 'Canvas指纹检测'
            }
        ];

        for (const site of testSites) {
            console.log(`\n🔍 测试网站: ${site.name}`);
            console.log(`📝 描述: ${site.description}`);
            console.log(`🌐 URL: ${site.url}`);
            
            try {
                // 访问网站
                console.log('🌐 正在访问网站...');
                await page.goto(site.url, { 
                    waitUntil: 'networkidle2',
                    timeout: 60000 
                });
                
                console.log('✅ 页面加载成功');
                
                // 模拟人类行为
                await stealth.randomDelay(1000, 3000);
                
                // 模拟鼠标移动
                await stealth.humanMouseMove(page, 
                    Math.floor(Math.random() * 800) + 100,
                    Math.floor(Math.random() * 600) + 100
                );
                
                // 模拟滚动
                await stealth.humanScroll(page);
                
                // 等待可能的挑战加载
                await stealth.randomDelay(3000, 5000);
                
                // 检查页面内容
                const pageInfo = await page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        hasCloudflare: document.body.innerHTML.includes('cloudflare'),
                        hasCaptcha: document.body.innerHTML.includes('captcha') || 
                                   document.body.innerHTML.includes('challenge'),
                        bodyText: document.body.innerText.substring(0, 500)
                    };
                });
                
                console.log('📋 页面信息:');
                console.log(`   - 标题: ${pageInfo.title}`);
                console.log(`   - URL: ${pageInfo.url}`);
                console.log(`   - 包含Cloudflare: ${pageInfo.hasCloudflare}`);
                console.log(`   - 包含验证码: ${pageInfo.hasCaptcha}`);
                
                // 检查检测结果
                const detectionResults = await page.evaluate(() => {
                    const results = {};
                    
                    // 基础检测
                    results.webdriver = navigator.webdriver;
                    results.chrome = !!window.chrome;
                    results.pluginsLength = navigator.plugins.length;
                    results.languages = navigator.languages;
                    
                    // 高级检测
                    results.userAgent = navigator.userAgent;
                    results.platform = navigator.platform;
                    results.cookieEnabled = navigator.cookieEnabled;
                    results.doNotTrack = navigator.doNotTrack;
                    
                    // 检查是否有自动化检测标记
                    results.automationDetected = !!(
                        window.navigator.webdriver ||
                        window.callPhantom ||
                        window._phantom ||
                        window.__nightmare ||
                        window.Buffer
                    );
                    
                    return results;
                });
                
                console.log('🔍 详细检测结果:');
                Object.entries(detectionResults).forEach(([key, value]) => {
                    console.log(`   - ${key}: ${JSON.stringify(value)}`);
                });
                
                // 截图
                const screenshotPath = `screenshots/advanced_${site.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                await page.screenshot({ 
                    path: screenshotPath,
                    fullPage: true 
                });
                console.log(`📸 截图已保存: ${screenshotPath}`);
                
            } catch (error) {
                console.error(`❌ 测试 ${site.name} 失败:`, error.message);
            }
            
            // 等待一段时间再测试下一个网站
            await stealth.randomDelay(2000, 4000);
        }

        console.log('\n🎉 高级示例测试完成！');
        console.log('📊 测试总结:');
        console.log('   - 使用了Rebrowser-Puppeteer进行基础反检测');
        console.log('   - 注入了自定义反检测脚本');
        console.log('   - 模拟了真实的人类行为');
        console.log('   - 使用了随机User-Agent和请求头');
        
    } catch (error) {
        console.error('❌ 发生错误:', error);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 浏览器已关闭');
        }
    }
}

// 创建截图目录
import { mkdirSync } from 'fs';
try {
    mkdirSync('screenshots', { recursive: true });
} catch (error) {
    // 目录已存在，忽略错误
}

// 运行高级示例
advancedExample().catch(console.error);
