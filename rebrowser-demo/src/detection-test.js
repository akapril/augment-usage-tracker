/**
 * Rebrowser-Puppeteer 检测测试
 * 专门测试各种反机器人检测网站，验证反检测效果
 */

import puppeteer from 'rebrowser-puppeteer';

class DetectionTester {
    constructor() {
        this.testResults = [];
    }

    /**
     * 运行单个检测测试
     */
    async runDetectionTest(browser, testSite) {
        const page = await browser.newPage();
        const result = {
            name: testSite.name,
            url: testSite.url,
            success: false,
            detected: false,
            error: null,
            details: {}
        };

        try {
            console.log(`\n🧪 测试: ${testSite.name}`);
            console.log(`🌐 URL: ${testSite.url}`);

            // 设置页面
            await page.setViewport({ width: 1366, height: 768 });
            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );

            // 访问页面
            const response = await page.goto(testSite.url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            result.success = response.ok();
            
            // 等待页面加载
            await page.waitForTimeout(3000);

            // 执行特定的检测逻辑
            if (testSite.detector) {
                result.details = await testSite.detector(page);
                result.detected = result.details.detected || false;
            } else {
                // 默认检测逻辑
                result.details = await this.defaultDetection(page);
                result.detected = result.details.webdriver || 
                                 result.details.automationDetected || 
                                 false;
            }

            console.log(`✅ 测试完成 - 检测状态: ${result.detected ? '被检测' : '未被检测'}`);

        } catch (error) {
            result.error = error.message;
            console.log(`❌ 测试失败: ${error.message}`);
        } finally {
            await page.close();
        }

        this.testResults.push(result);
        return result;
    }

    /**
     * 默认检测逻辑
     */
    async defaultDetection(page) {
        return await page.evaluate(() => {
            const results = {
                // 基础检测
                webdriver: navigator.webdriver,
                chrome: !!window.chrome,
                pluginsLength: navigator.plugins.length,
                
                // 自动化检测
                automationDetected: !!(
                    window.navigator.webdriver ||
                    window.callPhantom ||
                    window._phantom ||
                    window.__nightmare ||
                    window.Buffer ||
                    window.emit ||
                    window.spawn
                ),
                
                // 环境检测
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                languages: navigator.languages,
                
                // 高级检测
                hasHeadlessUA: navigator.userAgent.includes('HeadlessChrome'),
                hasAutomationExtension: !!window.chrome && !!window.chrome.runtime && !!window.chrome.runtime.onConnect,
                
                // 页面特征
                pageTitle: document.title,
                bodyText: document.body ? document.body.innerText.substring(0, 200) : ''
            };
            
            return results;
        });
    }

    /**
     * 生成测试报告
     */
    generateReport() {
        console.log('\n📊 检测测试报告');
        console.log('='.repeat(50));
        
        const totalTests = this.testResults.length;
        const successfulTests = this.testResults.filter(r => r.success).length;
        const undetectedTests = this.testResults.filter(r => r.success && !r.detected).length;
        
        console.log(`总测试数: ${totalTests}`);
        console.log(`成功访问: ${successfulTests}`);
        console.log(`未被检测: ${undetectedTests}`);
        console.log(`检测率: ${((successfulTests - undetectedTests) / successfulTests * 100).toFixed(1)}%`);
        console.log(`成功率: ${(undetectedTests / successfulTests * 100).toFixed(1)}%`);
        
        console.log('\n详细结果:');
        this.testResults.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.name}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   访问: ${result.success ? '✅' : '❌'}`);
            console.log(`   检测: ${result.detected ? '🔴 被检测' : '🟢 未检测'}`);
            
            if (result.error) {
                console.log(`   错误: ${result.error}`);
            }
            
            if (result.details && result.success) {
                console.log(`   详情:`);
                console.log(`     - webdriver: ${result.details.webdriver}`);
                console.log(`     - 自动化检测: ${result.details.automationDetected}`);
                console.log(`     - plugins数量: ${result.details.pluginsLength}`);
            }
        });
    }
}

async function runDetectionTests() {
    console.log('🚀 启动 Rebrowser-Puppeteer 检测测试...');
    
    const tester = new DetectionTester();
    let browser;
    
    try {
        // 启动浏览器
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
                '--disable-gpu'
            ]
        });

        console.log('✅ 浏览器启动成功');

        // 定义测试网站
        const testSites = [
            {
                name: 'BrowserLeaks JavaScript',
                url: 'https://browserleaks.com/javascript'
            },
            {
                name: 'Sannysoft Bot Detection',
                url: 'https://bot.sannysoft.com/'
            },
            {
                name: 'IntroHacker Bot Test',
                url: 'https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html'
            }
        ];

        // 运行所有测试
        for (const testSite of testSites) {
            await tester.runDetectionTest(browser, testSite);
            
            // 测试间隔
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 生成报告
        tester.generateReport();
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 浏览器已关闭');
        }
    }
}

// 运行检测测试
runDetectionTests().catch(console.error);
