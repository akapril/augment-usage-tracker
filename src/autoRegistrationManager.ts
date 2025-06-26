import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer-core';
import { t } from './i18n';

export interface RegistrationResult {
    success: boolean;
    cookies?: string;
    error?: string;
    userEmail?: string;
}

export interface RegistrationOptions {
    email: string;
    captchaMode: 'manual' | 'smart-wait' | 'interactive';
    headless: boolean;
    loginMethod: 'email' | 'microsoft';
}

export class AutoRegistrationManager {
    private readonly AUGMENT_APP_URL = 'https://app.augmentcode.com/';
    private readonly LOGIN_URL_PATTERN = /login\.augmentcode\.com/;
    private readonly VERIFICATION_URL_PATTERN = /passwordless-email-challenge/;
    
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;

    constructor() {}

    async startAutoRegistration(): Promise<RegistrationResult> {
        console.log('🤖 [AutoRegistration] Starting auto registration process...');
        try {
            // 获取用户选项
            const options = await this.getUserOptions();
            if (!options) {
                console.log('❌ [AutoRegistration] User cancelled registration');
                return { success: false, error: 'User cancelled registration' };
            }

            console.log('✅ [AutoRegistration] User options:', {
                email: options.email,
                captchaMode: options.captchaMode,
                headless: options.headless
            });

            // 显示进度
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🤖 自动注册 Augment 账户",
                cancellable: true
            }, async (progress, token) => {
                
                progress.report({ increment: 0, message: "初始化浏览器..." });
                
                // 初始化浏览器
                await this.initializeBrowser(options.headless);
                
                if (token.isCancellationRequested) {
                    await this.cleanup();
                    return { success: false, error: 'User cancelled' };
                }

                progress.report({ increment: 10, message: "访问注册页面..." });
                
                // 访问注册页面
                await this.navigateToRegistration();
                
                if (options.loginMethod === 'email') {
                    progress.report({ increment: 20, message: "填写邮箱地址..." });

                    // 填写邮箱
                    await this.fillEmail(options.email);

                    progress.report({ increment: 30, message: "处理人机验证..." });

                    // 处理人机验证
                    const captchaResult = await this.handleCaptcha(options.captchaMode, progress);
                    if (!captchaResult) {
                        await this.cleanup();
                        return { success: false, error: 'Captcha verification failed' };
                    }

                    progress.report({ increment: 60, message: "等待验证码页面..." });

                    // 等待跳转到验证码页面
                    await this.waitForVerificationPage();

                    progress.report({ increment: 70, message: "输入验证码..." });

                    // 处理验证码
                    const verificationResult = await this.handleVerificationCode();
                    if (!verificationResult) {
                        await this.cleanup();
                        return { success: false, error: 'Verification code failed' };
                    }
                } else if (options.loginMethod === 'microsoft') {
                    progress.report({ increment: 20, message: "处理微软账号登录..." });

                    // 处理微软账号登录
                    const microsoftLoginResult = await this.handleMicrosoftLogin(options.captchaMode, progress);
                    if (!microsoftLoginResult) {
                        await this.cleanup();
                        return { success: false, error: 'Microsoft login failed' };
                    }
                }
                
                progress.report({ increment: 90, message: "提取认证信息..." });
                
                // 提取cookies
                const cookies = await this.extractCookies();
                
                progress.report({ increment: 100, message: "注册完成！" });
                
                await this.cleanup();
                
                return {
                    success: true,
                    cookies: cookies,
                    userEmail: options.email
                };
            });
            
        } catch (error) {
            console.error('❌ [AutoRegistration] Registration process failed:', error);
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
                    friendlyError = error.message;
                }
            }

            return {
                success: false,
                error: `Registration failed: ${friendlyError}`
            };
        }
    }

    private async getUserOptions(): Promise<RegistrationOptions | null> {
        // 选择登录方式
        const loginMethodChoice = await vscode.window.showQuickPick([
            {
                label: '📧 邮箱注册',
                description: '使用邮箱地址注册新账户',
                detail: '传统方式：输入邮箱 → 验证码 → 完成注册',
                method: 'email' as const
            },
            {
                label: '🔷 微软账号登录',
                description: '使用微软账号快速登录',
                detail: '推荐：更快速、更安全的登录方式',
                method: 'microsoft' as const
            }
        ], {
            placeHolder: '选择登录/注册方式',
            ignoreFocusOut: true
        });

        if (!loginMethodChoice) {
            return null;
        }

        let email = '';

        // 如果选择邮箱注册，需要输入邮箱
        if (loginMethodChoice.method === 'email') {
            const emailInput = await vscode.window.showInputBox({
                prompt: '请输入注册邮箱地址',
                placeHolder: 'example@email.com',
                validateInput: (value) => {
                    if (!value || !value.includes('@')) {
                        return '请输入有效的邮箱地址';
                    }
                    return null;
                }
            });

            if (!emailInput) {
                return null;
            }
            email = emailInput;
        }

        // 选择人机验证处理模式
        const captchaChoice = await vscode.window.showQuickPick([
            {
                label: '🤖 智能等待模式',
                description: '自动检测验证完成状态',
                detail: '推荐：自动监控页面变化，检测到验证完成后继续',
                mode: 'smart-wait' as const
            },
            {
                label: '👤 手动交互模式', 
                description: '在关键步骤提示用户确认',
                detail: '安全：每个步骤都会提示用户确认后继续',
                mode: 'interactive' as const
            },
            {
                label: '⏸️ 手动验证模式',
                description: '暂停等待用户手动完成',
                detail: '简单：检测到验证时暂停，等待用户完成后继续',
                mode: 'manual' as const
            }
        ], {
            placeHolder: '选择人机验证处理方式',
            ignoreFocusOut: true
        });

        if (!captchaChoice) {
            return null;
        }

        // 选择浏览器模式
        const headlessChoice = await vscode.window.showQuickPick([
            {
                label: '🖥️ 显示浏览器窗口',
                description: '可以看到操作过程',
                detail: '推荐：便于调试和用户交互',
                headless: false
            },
            {
                label: '🔇 后台运行',
                description: '隐藏浏览器窗口',
                detail: '高级：更快但无法看到过程',
                headless: true
            }
        ], {
            placeHolder: '选择浏览器运行模式',
            ignoreFocusOut: true
        });

        if (!headlessChoice) {
            return null;
        }

        return {
            email: email,
            captchaMode: captchaChoice.mode,
            headless: headlessChoice.headless,
            loginMethod: loginMethodChoice.method
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

    private async navigateToRegistration(): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');
        
        await this.page.goto(this.AUGMENT_APP_URL, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // 等待页面跳转到登录页面
        await this.page.waitForFunction(
            `() => window.location.href.includes('login.augmentcode.com')`,
            { timeout: 15000 }
        );
    }

    private async fillEmail(email: string): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        // 等待邮箱输入框 - 添加username id选择器
        await this.page.waitForSelector('#username, input[type="email"], input[name="email"], input[name="username"], input[placeholder*="email" i]', { timeout: 10000 });

        // 填写邮箱 - 优先使用username id
        const emailSelector = '#username, input[type="email"], input[name="email"], input[name="username"], input[placeholder*="email" i]';
        await this.page.type(emailSelector, email);
    }

    private async handleMicrosoftLogin(captchaMode: string, progress: vscode.Progress<{message?: string; increment?: number}>): Promise<boolean> {
        if (!this.page) throw new Error('Page not initialized');

        try {
            console.log('🔷 [MicrosoftLogin] Starting Microsoft login process...');

            // 查找微软登录按钮
            progress.report({ increment: 25, message: "查找微软登录按钮..." });

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

            let microsoftButton = null;
            for (const selector of microsoftButtonSelectors) {
                try {
                    if (selector.includes(':contains')) {
                        const text = selector.includes('Microsoft') ? 'Microsoft' : '微软';
                        microsoftButton = await this.page.evaluateHandle(`(text) => {
                            const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                            return elements.find(el =>
                                el.textContent && el.textContent.includes(text)
                            );
                        }`, text);

                        if (microsoftButton && microsoftButton.asElement) {
                            const elementHandle = microsoftButton.asElement();
                            if (elementHandle) {
                                console.log('✅ [MicrosoftLogin] Found Microsoft button with text search');
                                break;
                            }
                        }
                    } else {
                        const element = await this.page.$(selector);
                        if (element) {
                            microsoftButton = element;
                            console.log('✅ [MicrosoftLogin] Found Microsoft button with selector:', selector);
                            break;
                        }
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!microsoftButton) {
                console.warn('⚠️ [MicrosoftLogin] Microsoft login button not found, showing manual instruction');

                const choice = await vscode.window.showInformationMessage(
                    '🔷 微软账号登录\n\n' +
                    '未找到微软登录按钮，请手动操作：\n' +
                    '1. 在浏览器中查找"Microsoft"或"微软"登录按钮\n' +
                    '2. 点击按钮进行微软账号登录\n' +
                    '3. 完成登录后点击"继续"',
                    { modal: false },
                    '✅ 我已完成登录',
                    '❌ 取消'
                );

                if (choice !== '✅ 我已完成登录') {
                    return false;
                }
            } else {
                // 点击微软登录按钮
                progress.report({ increment: 40, message: "点击微软登录按钮..." });

                if (microsoftButton.asElement) {
                    const elementHandle = microsoftButton.asElement();
                    if (elementHandle) {
                        await elementHandle.click();
                    }
                } else {
                    await (microsoftButton as any).click();
                }

                console.log('✅ [MicrosoftLogin] Clicked Microsoft login button');

                // 等待微软登录页面加载
                progress.report({ increment: 50, message: "等待微软登录页面..." });

                try {
                    await this.page.waitForFunction(
                        `() => window.location.href.includes('login.microsoftonline.com') ||
                               window.location.href.includes('login.live.com') ||
                               document.querySelector('input[type="email"][placeholder*="email" i], input[name="loginfmt"]') !== null`,
                        { timeout: 15000 }
                    );
                    console.log('✅ [MicrosoftLogin] Microsoft login page loaded');
                } catch (error) {
                    console.warn('⚠️ [MicrosoftLogin] Microsoft login page detection timeout, continuing...');
                }

                // 提示用户完成微软登录
                progress.report({ increment: 60, message: "等待用户完成微软登录..." });

                const loginChoice = await vscode.window.showInformationMessage(
                    '🔷 微软账号登录\n\n' +
                    '请在浏览器中完成微软账号登录：\n' +
                    '1. 输入您的微软账号邮箱\n' +
                    '2. 输入密码或使用其他验证方式\n' +
                    '3. 完成登录后点击"继续"',
                    { modal: false },
                    '✅ 我已完成登录',
                    '❌ 取消登录'
                );

                if (loginChoice !== '✅ 我已完成登录') {
                    return false;
                }
            }

            // 等待登录完成并跳转回Augment
            progress.report({ increment: 80, message: "等待登录完成..." });

            try {
                await this.page.waitForFunction(
                    `() => window.location.href.includes('app.augmentcode.com') &&
                           !window.location.href.includes('login')`,
                    { timeout: 30000 }
                );
                console.log('✅ [MicrosoftLogin] Successfully logged in and redirected to Augment');
                return true;
            } catch (error) {
                console.warn('⚠️ [MicrosoftLogin] Redirect detection timeout, asking user for confirmation');

                const confirmChoice = await vscode.window.showInformationMessage(
                    '🔷 登录状态确认\n\n' +
                    '请确认您是否已成功登录并看到Augment的主页面？',
                    { modal: true },
                    '✅ 是的，已成功登录',
                    '❌ 登录失败'
                );

                return confirmChoice === '✅ 是的，已成功登录';
            }

        } catch (error) {
            console.error('❌ [MicrosoftLogin] Microsoft login failed:', error);
            return false;
        }
    }

    private async handleCaptcha(mode: string, progress: vscode.Progress<{message?: string; increment?: number}>): Promise<boolean> {
        if (!this.page) throw new Error('Page not initialized');
        
        try {
            // 检测是否有reCAPTCHA
            const captchaExists = await this.page.$('.g-recaptcha, .recaptcha, [data-sitekey]') !== null;
            
            if (!captchaExists) {
                // 没有验证码，直接点击Continue
                await this.clickContinueButton();
                return true;
            }

            switch (mode) {
                case 'manual':
                    return await this.handleManualCaptcha(progress);
                case 'smart-wait':
                    return await this.handleSmartWaitCaptcha(progress);
                case 'interactive':
                    return await this.handleInteractiveCaptcha(progress);
                default:
                    return false;
            }
        } catch (error) {
            console.error('Captcha handling error:', error);
            return false;
        }
    }

    private async handleManualCaptcha(progress: vscode.Progress<{message?: string; increment?: number}>): Promise<boolean> {
        progress.report({ message: "检测到人机验证，请手动完成..." });
        
        const choice = await vscode.window.showInformationMessage(
            '🤖 检测到人机验证\n\n' +
            '请在浏览器中手动完成reCAPTCHA验证，\n' +
            '完成后点击"继续"按钮。',
            { modal: true },
            '✅ 我已完成验证',
            '❌ 取消注册'
        );

        if (choice === '✅ 我已完成验证') {
            await this.clickContinueButton();
            return true;
        }
        
        return false;
    }

    private async handleSmartWaitCaptcha(progress: vscode.Progress<{message?: string; increment?: number}>): Promise<boolean> {
        progress.report({ message: "智能等待人机验证完成..." });
        
        try {
            // 等待reCAPTCHA完成的多种可能状态
            await this.page!.waitForFunction(`() => {
                // 检查reCAPTCHA响应
                if (window.grecaptcha && window.grecaptcha.getResponse && window.grecaptcha.getResponse().length > 0) {
                    return true;
                }

                // 检查Continue按钮是否可用
                const continueBtn = document.querySelector('button[type="submit"], input[type="submit"]');
                if (continueBtn && !continueBtn.hasAttribute('disabled')) {
                    return true;
                }

                // 检查页面是否已经跳转
                if (window.location.href.includes('passwordless-email-challenge')) {
                    return true;
                }

                return false;
            }`, { timeout: 120000 }); // 2分钟超时
            
            await this.clickContinueButton();
            return true;
            
        } catch (error) {
            console.error('Smart wait timeout:', error);
            return false;
        }
    }

    private async handleInteractiveCaptcha(progress: vscode.Progress<{message?: string; increment?: number}>): Promise<boolean> {
        progress.report({ message: "等待用户确认验证完成..." });
        
        // 显示浏览器窗口（如果是headless模式）
        const choice = await vscode.window.showInformationMessage(
            '🤖 人机验证处理\n\n' +
            '1. 请在浏览器中完成reCAPTCHA验证\n' +
            '2. 验证完成后，点击页面上的"Continue"按钮\n' +
            '3. 然后在这里点击"下一步"继续自动化流程',
            { modal: false },
            '➡️ 下一步',
            '🔄 重新检查',
            '❌ 取消'
        );

        switch (choice) {
            case '➡️ 下一步':
                return true; // 假设用户已经完成了验证和点击
            case '🔄 重新检查':
                return await this.handleInteractiveCaptcha(progress); // 递归重新检查
            default:
                return false;
        }
    }

    private async clickContinueButton(): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        // 尝试多种可能的Continue按钮选择器
        const selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button[value="continue"]',
            'button[data-action="continue"]',
            '.continue-button',
            '#continue-btn',
            'button:contains("Continue")',
            'button:contains("继续")',
            '[role="button"]:contains("Continue")'
        ];

        for (const selector of selectors) {
            try {
                // 对于包含文本的选择器，使用evaluate方法
                if (selector.includes(':contains')) {
                    const text = selector.includes('Continue') ? 'Continue' : '继续';
                    const element = await this.page.evaluateHandle(`(text) => {
                        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
                        return buttons.find(btn =>
                            btn.textContent && btn.textContent.includes(text) ||
                            btn.getAttribute && btn.getAttribute('value') && btn.getAttribute('value').includes(text)
                        );
                    }`, text);

                    if (element && element.asElement) {
                        const elementHandle = element.asElement();
                        if (elementHandle) {
                            await elementHandle.click();
                            return;
                        }
                    }
                } else {
                    const element = await this.page.$(selector);
                    if (element) {
                        await element.click();
                        return;
                    }
                }
            } catch (error) {
                continue;
            }
        }

        // 如果找不到按钮，尝试按Enter键
        await this.page.keyboard.press('Enter');
    }

    private async waitForVerificationPage(): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');
        
        // 等待跳转到验证码页面
        await this.page.waitForFunction(
            `() => window.location.href.includes('passwordless-email-challenge')`,
            { timeout: 30000 }
        );
        
        // 等待验证码输入框出现
        await this.page.waitForSelector('input[type="text"], input[name="code"], input[placeholder*="code" i]', { timeout: 10000 });
    }

    private async handleVerificationCode(): Promise<boolean> {
        if (!this.page) throw new Error('Page not initialized');
        
        const code = await vscode.window.showInputBox({
            prompt: '请输入邮箱收到的验证码',
            placeHolder: '6位数字验证码',
            validateInput: (value) => {
                if (!value || value.length !== 6 || !/^\d{6}$/.test(value)) {
                    return '请输入6位数字验证码';
                }
                return null;
            }
        });

        if (!code) {
            return false;
        }

        // 输入验证码
        await this.page.type('input[type="text"], input[name="code"], input[placeholder*="code" i]', code);
        
        // 点击Continue按钮
        await this.clickContinueButton();
        
        // 等待页面跳转或成功提示
        try {
            await this.page.waitForFunction(
                `() => {
                    return window.location.href.includes('app.augmentcode.com') ||
                           document.querySelector('.success, .dashboard, .welcome') !== null;
                }`,
                { timeout: 15000 }
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    private async extractCookies(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');
        
        const cookies = await this.page.cookies();
        
        // 提取关键cookies
        const sessionCookie = cookies.find(c => c.name === '_session');
        const userIdCookie = cookies.find(c => c.name === 'ajs_user_id');
        
        let cookieString = '';
        if (sessionCookie) {
            cookieString += `_session=${sessionCookie.value}`;
        }
        if (userIdCookie) {
            if (cookieString) cookieString += '; ';
            cookieString += `ajs_user_id=${userIdCookie.value}`;
        }
        
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
