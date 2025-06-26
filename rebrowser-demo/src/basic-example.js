/**
 * Rebrowser-Puppeteer 基础示例
 * 演示如何使用rebrowser-puppeteer进行基本的反检测浏览
 */

import puppeteer from 'rebrowser-puppeteer';

async function basicExample() {
    console.log('🚀 启动 Rebrowser-Puppeteer 基础示例...');
    
    let browser;
    try {
        // 启动浏览器 - 使用rebrowser-puppeteer替代原生puppeteer
        browser = await puppeteer.launch({
            headless: false, // 显示浏览器窗口，便于观察
            defaultViewport: null, // 使用完整窗口大小
            args: [
                '--start-maximized', // 最大化窗口
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security', // 禁用web安全检查
                '--disable-features=VizDisplayCompositor'
            ]
        });

        console.log('✅ 浏览器启动成功');

        // 创建新页面
        const page = await browser.newPage();
        
        // 设置视口大小
        await page.setViewport({ width: 1366, height: 768 });
        
        // 设置User-Agent
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        console.log('📄 页面创建成功，开始访问测试网站...');

        // 访问检测网站
        const testSites = [
            {
                name: 'BrowserLeaks - 基础检测',
                url: 'https://browserleaks.com/javascript',
                description: '检测JavaScript环境和自动化标记'
            },
            {
                name: 'Bot Detection Test',
                url: 'https://bot.sannysoft.com/',
                description: '综合机器人检测测试'
            }
        ];

        for (const site of testSites) {
            console.log(`\n🔍 测试网站: ${site.name}`);
            console.log(`📝 描述: ${site.description}`);
            console.log(`🌐 URL: ${site.url}`);
            
            try {
                // 访问网站
                await page.goto(site.url, { 
                    waitUntil: 'networkidle2',
                    timeout: 30000 
                });
                
                console.log('✅ 页面加载成功');
                
                // 等待页面完全加载
                await page.waitForTimeout(3000);
                
                // 检查页面标题
                const title = await page.title();
                console.log(`📋 页面标题: ${title}`);
                
                // 检查是否存在常见的检测结果
                const detectionResults = await page.evaluate(() => {
                    const results = {};
                    
                    // 检查webdriver属性
                    results.webdriver = navigator.webdriver;
                    
                    // 检查chrome属性
                    results.chrome = !!window.chrome;
                    
                    // 检查plugins数量
                    results.pluginsLength = navigator.plugins.length;
                    
                    // 检查languages
                    results.languages = navigator.languages;
                    
                    return results;
                });
                
                console.log('🔍 检测结果:');
                console.log(`   - navigator.webdriver: ${detectionResults.webdriver}`);
                console.log(`   - window.chrome: ${detectionResults.chrome}`);
                console.log(`   - plugins数量: ${detectionResults.pluginsLength}`);
                console.log(`   - 语言设置: ${JSON.stringify(detectionResults.languages)}`);
                
                // 截图保存
                const screenshotPath = `screenshots/${site.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                await page.screenshot({ 
                    path: screenshotPath,
                    fullPage: true 
                });
                console.log(`📸 截图已保存: ${screenshotPath}`);
                
            } catch (error) {
                console.error(`❌ 访问 ${site.name} 失败:`, error.message);
            }
            
            // 等待一段时间再访问下一个网站
            await page.waitForTimeout(2000);
        }

        console.log('\n🎉 基础示例测试完成！');
        
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

// 运行示例
basicExample().catch(console.error);
