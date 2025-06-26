import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer-core';

export interface PuppeteerLoginResult {
    success: boolean;
    cookies?: string;
    error?: string;
    userEmail?: string;
}

export interface PuppeteerLoginOptions {
    loginMethod: 'email' | 'microsoft';
    headless: boolean;
    waitForManualLogin: boolean;
}

export class PuppeteerLoginManager {
    private readonly AUGMENT_APP_URL = 'https://app.augmentcode.com/';
    
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;

    constructor() {}

    async startPuppeteerLogin(): Promise<PuppeteerLoginResult> {
        console.log('🎭 [PuppeteerLogin] Starting Puppeteer login process...');
        try {
            // 获取用户选项
            const options = await this.getUserOptions();
            if (!options) {
                console.log('❌ [PuppeteerLogin] User cancelled login');
                return { success: false, error: 'User cancelled login during option selection' };
            }

            // 验证选项完整性
            if (!options.loginMethod || typeof options.headless !== 'boolean' || typeof options.waitForManualLogin !== 'boolean') {
                console.error('❌ [PuppeteerLogin] Invalid user options:', options);
                return { success: false, error: 'Invalid configuration options received' };
            }
            
            console.log('✅ [PuppeteerLogin] User options:', {
                loginMethod: options.loginMethod,
                headless: options.headless,
                waitForManualLogin: options.waitForManualLogin
            });

            // 显示进度
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🎭 浏览器登录并提取Cookie",
                cancellable: true
            }, async (progress, token) => {
                
                progress.report({ increment: 0, message: "初始化浏览器..." });

                // 初始化浏览器
                try {
                    await this.initializeBrowser(options.headless);
                    console.log('✅ [PuppeteerLogin] Browser initialized successfully');
                } catch (browserError) {
                    console.error('❌ [PuppeteerLogin] Browser initialization failed:', browserError);
                    throw new Error(`Browser initialization failed: ${browserError}`);
                }
                
                if (token.isCancellationRequested) {
                    await this.cleanup();
                    return { success: false, error: 'User cancelled' };
                }

                progress.report({ increment: 10, message: "访问Augment登录页面..." });

                // 访问登录页面
                try {
                    await this.navigateToLogin();
                    console.log('✅ [PuppeteerLogin] Successfully navigated to login page');
                } catch (navError) {
                    console.error('❌ [PuppeteerLogin] Navigation failed:', navError);
                    throw new Error(`Navigation failed: ${navError}`);
                }
                
                if (options.loginMethod === 'microsoft') {
                    progress.report({ increment: 20, message: "查找微软登录按钮..." });

                    // 尝试点击微软登录按钮
                    try {
                        const microsoftButtonFound = await this.clickMicrosoftLoginButton();
                        if (microsoftButtonFound) {
                            progress.report({ increment: 30, message: "已点击微软登录按钮..." });
                            console.log('✅ [PuppeteerLogin] Microsoft login button clicked successfully');
                        } else {
                            progress.report({ increment: 30, message: "未找到微软登录按钮，请手动操作..." });
                            console.warn('⚠️ [PuppeteerLogin] Microsoft login button not found, user will need to click manually');
                        }
                    } catch (msError) {
                        console.error('❌ [PuppeteerLogin] Microsoft login button click failed:', msError);
                        progress.report({ increment: 30, message: "微软登录按钮点击失败，请手动操作..." });
                    }
                }
                
                progress.report({ increment: 40, message: "等待用户完成登录..." });

                // 等待用户手动登录
                let loginSuccess = false;
                try {
                    loginSuccess = await this.waitForUserLogin(options, progress);
                    console.log('✅ [PuppeteerLogin] Login wait completed, success:', loginSuccess);
                } catch (loginError) {
                    console.error('❌ [PuppeteerLogin] Login wait failed:', loginError);
                    throw new Error(`Login wait failed: ${loginError}`);
                }

                if (!loginSuccess) {
                    console.log('❌ [PuppeteerLogin] Login was not successful or was cancelled');
                    await this.cleanup();
                    return { success: false, error: 'Login failed or cancelled by user' };
                }
                
                progress.report({ increment: 80, message: "提取Cookie..." });

                // 检查当前页面状态
                const currentUrl = await this.page!.url();
                const pageTitle = await this.page!.title();
                console.log('📍 [PuppeteerLogin] Current page URL:', currentUrl);
                console.log('📍 [PuppeteerLogin] Current page title:', pageTitle);

                // 提取cookies
                let cookies = '';
                try {
                    cookies = await this.extractCookies();
                    console.log('✅ [PuppeteerLogin] Cookies extracted successfully');

                    if (!cookies) {
                        console.warn('⚠️ [PuppeteerLogin] No cookies found, but continuing...');

                        // 显示无Cookie警告
                        const noCookieChoice = await vscode.window.showWarningMessage(
                            '⚠️ 未找到Cookie\n\n' +
                            '没有找到预期的认证Cookie (_session 或 ajs_user_id)。\n' +
                            '这可能意味着登录未完全成功。\n\n' +
                            '请检查：\n' +
                            '1. 是否已完全登录到Augment主页\n' +
                            '2. 页面URL是否为 app.augmentcode.com\n' +
                            '3. 是否能看到用户dashboard',
                            { modal: true },
                            '继续',
                            '取消'
                        );

                        if (noCookieChoice !== '继续') {
                            await this.cleanup();
                            return { success: false, error: 'No cookies found and user cancelled' };
                        }
                    } else {
                        // 显示Cookie内容供用户查看
                        const cookieChoice = await vscode.window.showInformationMessage(
                            '🍪 Cookie提取成功\n\n' +
                            `提取到的Cookie内容：\n${cookies}\n\n` +
                            `Cookie长度：${cookies.length} 字符\n\n` +
                            '是否继续配置到VSCode？',
                            { modal: true },
                            '✅ 继续配置',
                            '📋 复制Cookie',
                            '❌ 取消'
                        );

                        if (cookieChoice === '📋 复制Cookie') {
                            await vscode.env.clipboard.writeText(cookies);
                            vscode.window.showInformationMessage('Cookie已复制到剪贴板');
                            await this.cleanup();
                            return { success: true, cookies: cookies, userEmail: 'extracted-via-puppeteer' };
                        } else if (cookieChoice !== '✅ 继续配置') {
                            await this.cleanup();
                            return { success: false, error: 'User cancelled after cookie extraction' };
                        }
                    }
                } catch (cookieError) {
                    console.error('❌ [PuppeteerLogin] Cookie extraction failed:', cookieError);
                    throw new Error(`Cookie extraction failed: ${cookieError}`);
                }
                
                progress.report({ increment: 100, message: "登录完成！" });
                
                await this.cleanup();
                
                return {
                    success: true,
                    cookies: cookies,
                    userEmail: 'extracted-via-puppeteer'
                };
            });
            
        } catch (error) {
            console.error('❌ [PuppeteerLogin] Login process failed:', error);
            await this.cleanup();

            // 提供更友好的错误信息
            let friendlyError = 'Unknown error occurred';

            if (error instanceof Error) {
                if (error.message.includes('No Chrome/Edge browser found')) {
                    friendlyError = '未找到Chrome或Edge浏览器，请先安装浏览器';
                } else if (error.message.includes('timeout')) {
                    friendlyError = '操作超时，请检查网络连接或重试';
                } else if (error.message.includes('Page not initialized')) {
                    friendlyError = '浏览器页面初始化失败，请重试';
                } else {
                    friendlyError = error.message || 'Error message is empty';
                }
            } else if (typeof error === 'string') {
                friendlyError = error;
            } else if (error && typeof error === 'object') {
                friendlyError = JSON.stringify(error);
            } else {
                friendlyError = `Unexpected error type: ${typeof error}`;
            }

            return {
                success: false,
                error: friendlyError
            };
        }
    }

    private async getUserOptions(): Promise<PuppeteerLoginOptions | null> {
        // 选择登录方式
        const loginMethodChoice = await vscode.window.showQuickPick([
            {
                label: '📧 邮箱登录',
                description: '使用邮箱和密码登录',
                detail: '在浏览器中手动输入邮箱和密码',
                method: 'email' as const
            },
            {
                label: '🔷 微软账号登录',
                description: '使用微软账号登录',
                detail: '推荐：自动点击微软登录按钮',
                method: 'microsoft' as const
            }
        ], {
            placeHolder: '选择登录方式',
            ignoreFocusOut: true
        });

        if (!loginMethodChoice) {
            return null;
        }

        // 选择浏览器模式
        const headlessChoice = await vscode.window.showQuickPick([
            {
                label: '🖥️ 显示浏览器窗口',
                description: '可以看到登录过程',
                detail: '推荐：便于手动登录操作',
                headless: false
            },
            {
                label: '🔇 后台运行',
                description: '隐藏浏览器窗口',
                detail: '高级：需要确保能自动登录',
                headless: true
            }
        ], {
            placeHolder: '选择浏览器运行模式',
            ignoreFocusOut: true
        });

        if (!headlessChoice) {
            return null;
        }

        // 暂时只使用手动确认模式（智能等待有问题，暂时取消）
        const waitForManualLogin = true;

        return {
            loginMethod: loginMethodChoice.method,
            headless: headlessChoice.headless,
            waitForManualLogin: waitForManualLogin
        };
    }

    private async initializeBrowser(headless: boolean): Promise<void> {
        try {
            // 尝试找到系统中的Chrome/Chromium
            const executablePath = await this.findChromePath();
            
            this.browser = await puppeteer.launch({
                headless: headless,
                executablePath: executablePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            this.page = await this.browser.newPage();
            
            // 设置用户代理
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // 设置视口
            await this.page.setViewport({ width: 1280, height: 720 });
            
        } catch (error) {
            throw new Error(`Failed to initialize browser: ${error}`);
        }
    }

    private async findChromePath(): Promise<string> {
        // Windows Chrome路径
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
        ];

        const fs = require('fs');
        for (const path of possiblePaths) {
            if (fs.existsSync(path)) {
                return path;
            }
        }

        throw new Error('No Chrome/Edge browser found. Please install Chrome or Edge.');
    }

    private async navigateToLogin(): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');
        
        await this.page.goto(this.AUGMENT_APP_URL, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // 等待页面跳转到登录页面
        try {
            await this.page.waitForFunction(
                `() => window.location.href.includes('login.augmentcode.com')`,
                { timeout: 15000 }
            );
        } catch (error) {
            console.warn('⚠️ [PuppeteerLogin] Login page detection timeout, continuing...');
        }
    }

    private async clickMicrosoftLoginButton(): Promise<boolean> {
        if (!this.page) throw new Error('Page not initialized');
        
        try {
            console.log('🔷 [PuppeteerLogin] Looking for Microsoft login button...');
            
            const microsoftButtonSelectors = [
                'button:contains("Microsoft")',
                'button:contains("微软")',
                'a:contains("Microsoft")',
                'a:contains("微软")',
                '[data-provider="microsoft"]',
                '.microsoft-login',
                '#microsoft-login',
                'button[data-testid*="microsoft"]',
                'a[href*="microsoft"]'
            ];

            for (const selector of microsoftButtonSelectors) {
                try {
                    if (selector.includes(':contains')) {
                        const text = selector.includes('Microsoft') ? 'Microsoft' : '微软';
                        const element = await this.page.evaluateHandle(`(text) => {
                            const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                            return elements.find(el => 
                                el.textContent && el.textContent.includes(text)
                            );
                        }`, text);
                        
                        if (element && element.asElement) {
                            const elementHandle = element.asElement();
                            if (elementHandle) {
                                await elementHandle.click();
                                console.log('✅ [PuppeteerLogin] Clicked Microsoft button with text search');
                                return true;
                            }
                        }
                    } else {
                        const element = await this.page.$(selector);
                        if (element) {
                            await element.click();
                            console.log('✅ [PuppeteerLogin] Clicked Microsoft button with selector:', selector);
                            return true;
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
            
            console.warn('⚠️ [PuppeteerLogin] Microsoft login button not found');
            return false;
            
        } catch (error) {
            console.error('❌ [PuppeteerLogin] Error clicking Microsoft button:', error);
            return false;
        }
    }

    private async waitForUserLogin(options: PuppeteerLoginOptions, progress: vscode.Progress<{message?: string; increment?: number}>): Promise<boolean> {
        if (!this.page) throw new Error('Page not initialized');

        // 只使用手动确认模式（智能等待暂时取消）
        console.log('👤 [PuppeteerLogin] Using manual confirmation mode');

        const choice = await vscode.window.showInformationMessage(
            '🎭 浏览器登录\n\n' +
            '请在浏览器中完成登录：\n' +
            '1. 输入您的账号信息\n' +
            '2. 完成任何必要的验证\n' +
            '3. 确保已成功登录到Augment主页\n' +
            '4. 然后点击"登录完成"',
            { modal: false },
            '✅ 登录完成',
            '❌ 取消'
        );

        const success = choice === '✅ 登录完成';
        console.log('👤 [PuppeteerLogin] Manual confirmation result:', success);
        return success;
    }

    private async extractCookies(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const cookies = await this.page.cookies();

        console.log('🍪 [PuppeteerLogin] All cookies found:', cookies.length);
        console.log('🍪 [PuppeteerLogin] Cookie details:');

        // 输出所有cookie的详细信息
        cookies.forEach((cookie, index) => {
            console.log(`  ${index + 1}. ${cookie.name} = ${cookie.value.substring(0, 50)}${cookie.value.length > 50 ? '...' : ''}`);
            console.log(`     Domain: ${cookie.domain}, Path: ${cookie.path}, HttpOnly: ${cookie.httpOnly}, Secure: ${cookie.secure}`);
        });

        // 提取关键cookies
        const sessionCookie = cookies.find(c => c.name === '_session');
        const userIdCookie = cookies.find(c => c.name === 'ajs_user_id');

        console.log('🔍 [PuppeteerLogin] Looking for key cookies:');
        console.log(`  _session: ${sessionCookie ? 'Found' : 'Not found'}`);
        console.log(`  ajs_user_id: ${userIdCookie ? 'Found' : 'Not found'}`);

        let cookieString = '';
        if (sessionCookie) {
            cookieString += `_session=${sessionCookie.value}`;
            console.log(`✅ [PuppeteerLogin] _session cookie: ${sessionCookie.value.substring(0, 100)}...`);
        }
        if (userIdCookie) {
            if (cookieString) cookieString += '; ';
            cookieString += `ajs_user_id=${userIdCookie.value}`;
            console.log(`✅ [PuppeteerLogin] ajs_user_id cookie: ${userIdCookie.value}`);
        }

        console.log('🍪 [PuppeteerLogin] Final cookie string length:', cookieString.length);
        console.log('🍪 [PuppeteerLogin] Final cookie string:', cookieString);

        return cookieString;
    }

    private async cleanup(): Promise<void> {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}
