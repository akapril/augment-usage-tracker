/**
 * Rebrowser-Puppeteer Cloudflare测试
 * 专门测试Cloudflare反机器人保护的绕过效果
 */

import puppeteer from 'rebrowser-puppeteer';

class CloudflareBypass {
    constructor() {
        this.maxRetries = 3;
        this.challengeTimeout = 30000; // 30秒等待挑战完成
    }

    /**
     * 等待Cloudflare挑战完成
     */
    async waitForCloudflareChallenge(page) {
        console.log('⏳ 等待Cloudflare挑战完成...');
        
        try {
            // 等待挑战页面消失或成功页面出现
            await page.waitForFunction(() => {
                const bodyText = document.body.innerText.toLowerCase();
                
                // 检查是否还在挑战页面
                const isChallenge = bodyText.includes('checking your browser') ||
                                  bodyText.includes('please wait') ||
                                  bodyText.includes('verifying you are human') ||
                                  bodyText.includes('challenge');
                
                // 检查是否成功通过
                const isSuccess = !isChallenge && 
                                document.readyState === 'complete' &&
                                !bodyText.includes('error');
                
                return isSuccess;
            }, { 
                timeout: this.challengeTimeout,
                polling: 1000 
            });
            
            console.log('✅ Cloudflare挑战已完成');
            return true;
            
        } catch (error) {
            console.log('⚠️ Cloudflare挑战等待超时');
            return false;
        }
    }

    /**
     * 检查页面状态
     */
    async checkPageStatus(page) {
        const status = await page.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            const title = document.title.toLowerCase();
            
            return {
                title: document.title,
                url: window.location.href,
                
                // Cloudflare检测
                hasCloudflare: bodyText.includes('cloudflare') || title.includes('cloudflare'),
                isChallenge: bodyText.includes('checking your browser') ||
                           bodyText.includes('please wait') ||
                           bodyText.includes('verifying you are human'),
                isBlocked: bodyText.includes('access denied') ||
                          bodyText.includes('blocked') ||
                          bodyText.includes('forbidden'),
                isError: bodyText.includes('error') || title.includes('error'),
                
                // 成功指标
                hasContent: document.body.children.length > 5,
                isInteractive: document.readyState === 'complete',
                
                // 页面内容摘要
                contentPreview: bodyText.substring(0, 300)
            };
        });
        
        return status;
    }

    /**
     * 测试单个Cloudflare保护的网站
     */
    async testCloudflareBypass(browser, testSite) {
        console.log(`\n🛡️ 测试Cloudflare绕过: ${testSite.name}`);
        console.log(`🌐 URL: ${testSite.url}`);
        
        const page = await browser.newPage();
        let success = false;
        let attempts = 0;
        
        try {
            // 设置页面配置
            await page.setViewport({ width: 1366, height: 768 });
            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );
            
            // 设置额外请求头
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            });

            while (attempts < this.maxRetries && !success) {
                attempts++;
                console.log(`🔄 尝试 ${attempts}/${this.maxRetries}`);
                
                try {
                    // 访问页面
                    const response = await page.goto(testSite.url, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 30000 
                    });
                    
                    console.log(`📡 HTTP状态: ${response.status()}`);
                    
                    // 等待初始加载
                    await page.waitForTimeout(2000);
                    
                    // 检查初始状态
                    let status = await this.checkPageStatus(page);
                    console.log(`📋 初始状态: ${status.isChallenge ? 'Cloudflare挑战' : '正常页面'}`);
                    
                    if (status.isChallenge) {
                        // 如果遇到挑战，等待完成
                        const challengePassed = await this.waitForCloudflareChallenge(page);
                        
                        if (challengePassed) {
                            // 重新检查状态
                            status = await this.checkPageStatus(page);
                        }
                    }
                    
                    // 判断是否成功
                    success = !status.isChallenge && 
                             !status.isBlocked && 
                             !status.isError && 
                             status.hasContent;
                    
                    console.log(`📊 页面状态分析:`);
                    console.log(`   - 标题: ${status.title}`);
                    console.log(`   - 挑战中: ${status.isChallenge ? '是' : '否'}`);
                    console.log(`   - 被阻止: ${status.isBlocked ? '是' : '否'}`);
                    console.log(`   - 有错误: ${status.isError ? '是' : '否'}`);
                    console.log(`   - 有内容: ${status.hasContent ? '是' : '否'}`);
                    console.log(`   - 成功访问: ${success ? '✅' : '❌'}`);
                    
                    if (success) {
                        console.log('🎉 成功绕过Cloudflare保护！');
                        
                        // 截图保存成功页面
                        const screenshotPath = `screenshots/cloudflare_success_${testSite.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                        await page.screenshot({ 
                            path: screenshotPath,
                            fullPage: true 
                        });
                        console.log(`📸 成功截图已保存: ${screenshotPath}`);
                        
                    } else if (attempts < this.maxRetries) {
                        console.log('🔄 尝试失败，准备重试...');
                        await page.waitForTimeout(3000);
                    }
                    
                } catch (error) {
                    console.log(`❌ 尝试 ${attempts} 失败: ${error.message}`);
                    
                    if (attempts < this.maxRetries) {
                        await page.waitForTimeout(5000);
                    }
                }
            }
            
            return {
                name: testSite.name,
                url: testSite.url,
                success,
                attempts,
                finalStatus: success ? await this.checkPageStatus(page) : null
            };
            
        } catch (error) {
            console.error(`❌ 测试过程中发生错误: ${error.message}`);
            return {
                name: testSite.name,
                url: testSite.url,
                success: false,
                attempts,
                error: error.message
            };
        } finally {
            await page.close();
        }
    }
}

async function runCloudflareTests() {
    console.log('🚀 启动 Rebrowser-Puppeteer Cloudflare测试...');
    
    const bypass = new CloudflareBypass();
    let browser;
    
    try {
        // 启动浏览器，使用最佳反检测配置
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
                '--disable-renderer-backgrounding'
            ]
        });

        console.log('✅ 浏览器启动成功');

        // 定义Cloudflare测试网站
        const testSites = [
            {
                name: 'Cloudflare Demo',
                url: 'https://nopecha.com/demo/cloudflare'
            },
            {
                name: 'Cloudflare Challenge Test',
                url: 'https://nowsecure.nl'
            },
            {
                name: 'Protected Site Example',
                url: 'https://httpbin.org/user-agent'
            }
        ];

        const results = [];
        
        // 运行所有测试
        for (const testSite of testSites) {
            const result = await bypass.testCloudflareBypass(browser, testSite);
            results.push(result);
            
            // 测试间隔
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // 生成测试报告
        console.log('\n📊 Cloudflare绕过测试报告');
        console.log('='.repeat(50));
        
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        console.log(`总测试数: ${totalCount}`);
        console.log(`成功绕过: ${successCount}`);
        console.log(`成功率: ${(successCount / totalCount * 100).toFixed(1)}%`);
        
        console.log('\n详细结果:');
        results.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.name}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
            console.log(`   尝试次数: ${result.attempts}`);
            
            if (result.error) {
                console.log(`   错误: ${result.error}`);
            }
            
            if (result.finalStatus) {
                console.log(`   最终状态: ${result.finalStatus.title}`);
            }
        });
        
        console.log('\n🎯 测试总结:');
        console.log('   - 使用Rebrowser-Puppeteer进行Cloudflare绕过测试');
        console.log('   - 模拟真实浏览器行为');
        console.log('   - 自动等待挑战完成');
        console.log('   - 多次重试机制');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
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

// 运行Cloudflare测试
runCloudflareTests().catch(console.error);
