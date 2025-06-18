import * as vscode from 'vscode';
import { WebAuthManager } from './webAuth';
import { t } from './i18n';

export interface CookieInfo {
    cookies: string;
    timestamp: number;
    expiresAt: number;
    isValid: boolean;
}

export class CookieManager {
    private readonly COOKIE_EXPIRY_HOURS = 20; // Cookie 20小时后过期
    private readonly CHECK_INTERVAL_MINUTES = 30; // 每30分钟检查一次
    private readonly WARNING_HOURS = 2; // 过期前2小时提醒
    
    private checkTimer: NodeJS.Timeout | null = null;
    private webAuthManager: WebAuthManager;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.webAuthManager = new WebAuthManager();
    }

    async initialize(): Promise<void> {
        console.log('🍪 Initializing Cookie Manager...');
        
        // 检查是否是首次安装
        const isFirstInstall = !this.context.globalState.get('cookieManager.initialized', false);
        
        if (isFirstInstall) {
            console.log('🎉 First installation detected, triggering cookie setup...');
            await this.handleFirstInstall();
        } else {
            console.log('🔄 Checking existing cookie status...');
            await this.checkCookieStatus();
        }

        // 启动定期检查
        this.startPeriodicCheck();
        
        // 标记为已初始化
        await this.context.globalState.update('cookieManager.initialized', true);
    }

    private async handleFirstInstall(): Promise<void> {
        // 延迟3秒，让插件完全加载
        setTimeout(async () => {
            const choice = await vscode.window.showInformationMessage(
                '🎉 欢迎使用 Augment 使用量追踪器！\n\n' +
                '为了获取真实的使用数据，需要配置Augment认证。\n' +
                '我们提供了简单的自动配置方法。',
                '🚀 立即配置',
                '⏰ 稍后配置',
                '❓ 了解更多'
            );

            switch (choice) {
                case '🚀 立即配置':
                    await this.triggerCookieSetup();
                    break;
                case '⏰ 稍后配置':
                    vscode.window.showInformationMessage(
                        '您可以随时通过命令面板运行 "🌐 网页自动登录" 来配置认证。'
                    );
                    break;
                case '❓ 了解更多':
                    await this.showSetupGuide();
                    break;
            }
        }, 3000);
    }

    private async triggerCookieSetup(): Promise<void> {
        try {
            vscode.commands.executeCommand('augmentTracker.webLogin');
        } catch (error) {
            console.error('Failed to trigger cookie setup:', error);
            vscode.window.showErrorMessage('启动认证配置失败，请手动运行 "🌐 网页自动登录" 命令。');
        }
    }

    private async showSetupGuide(): Promise<void> {
        const guide = `
# Augment 认证配置指南

## 为什么需要认证？
- 获取真实的使用数据而非模拟数据
- 实时监控您的Augment使用情况
- 自动刷新和过期提醒

## 配置方法
1. **自动配置（推荐）**：运行 "🌐 网页自动登录" 命令
2. **手动配置**：运行 "设置浏览器Cookie" 命令

## 安全性
- 所有数据存储在本地
- 不向第三方发送任何信息
- 支持自动过期检查和刷新

点击 "立即配置" 开始设置，或稍后通过命令面板配置。
        `;

        const doc = await vscode.workspace.openTextDocument({
            content: guide,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);

        const choice = await vscode.window.showInformationMessage(
            '查看完指南后，是否现在配置认证？',
            '🚀 立即配置',
            '⏰ 稍后配置'
        );

        if (choice === '🚀 立即配置') {
            await this.triggerCookieSetup();
        }
    }

    async checkCookieStatus(): Promise<CookieInfo | null> {
        const cookieData = this.context.globalState.get<CookieInfo>('augment.cookieInfo');
        
        if (!cookieData) {
            console.log('🍪 No cookie data found');
            return null;
        }

        const now = Date.now();
        const isExpired = now > cookieData.expiresAt;
        const isNearExpiry = (cookieData.expiresAt - now) < (this.WARNING_HOURS * 60 * 60 * 1000);

        console.log(`🍪 Cookie status: expired=${isExpired}, nearExpiry=${isNearExpiry}`);

        if (isExpired) {
            await this.handleExpiredCookie();
            return null;
        } else if (isNearExpiry) {
            await this.handleNearExpiryCookie(cookieData);
        }

        return cookieData;
    }

    private async handleExpiredCookie(): Promise<void> {
        console.log('🍪 Cookie has expired, prompting for refresh...');
        
        const choice = await vscode.window.showWarningMessage(
            '⚠️ Augment认证已过期\n\n' +
            '您的session cookie已过期，无法获取真实使用数据。\n' +
            '是否现在刷新认证？',
            '🔄 自动刷新',
            '⏰ 稍后刷新',
            '❌ 忽略'
        );

        switch (choice) {
            case '🔄 自动刷新':
                await this.refreshCookie();
                break;
            case '⏰ 稍后刷新':
                // 设置1小时后再次提醒
                setTimeout(() => {
                    this.handleExpiredCookie();
                }, 60 * 60 * 1000);
                break;
            case '❌ 忽略':
                // 清除过期的cookie数据
                await this.clearCookieData();
                break;
        }
    }

    private async handleNearExpiryCookie(cookieInfo: CookieInfo): Promise<void> {
        const hoursLeft = Math.round((cookieInfo.expiresAt - Date.now()) / (60 * 60 * 1000));
        
        console.log(`🍪 Cookie will expire in ${hoursLeft} hours`);
        
        const choice = await vscode.window.showInformationMessage(
            `⏰ Augment认证即将过期\n\n` +
            `您的session cookie将在${hoursLeft}小时后过期。\n` +
            `建议现在刷新以避免中断。`,
            '🔄 现在刷新',
            '⏰ 稍后提醒',
            '❌ 忽略'
        );

        switch (choice) {
            case '🔄 现在刷新':
                await this.refreshCookie();
                break;
            case '⏰ 稍后提醒':
                // 1小时后再次提醒
                setTimeout(() => {
                    this.handleNearExpiryCookie(cookieInfo);
                }, 60 * 60 * 1000);
                break;
        }
    }

    async refreshCookie(): Promise<boolean> {
        try {
            vscode.window.showInformationMessage('🔄 正在刷新Augment认证...');
            
            const result = await this.webAuthManager.startAutoSessionExtraction();
            
            if (result.success && result.cookies) {
                await this.saveCookieInfo(result.cookies);
                
                vscode.window.showInformationMessage(
                    '✅ 认证刷新成功！\n\n' +
                    'Session cookie已更新，可以继续获取真实使用数据。'
                );
                
                return true;
            } else {
                vscode.window.showErrorMessage(
                    `❌ 认证刷新失败: ${result.error}\n\n` +
                    '请稍后重试或使用手动方法。'
                );
                return false;
            }
        } catch (error) {
            console.error('Cookie refresh failed:', error);
            vscode.window.showErrorMessage(
                `❌ 认证刷新过程出错: ${error}\n\n` +
                '请稍后重试或联系技术支持。'
            );
            return false;
        }
    }

    async saveCookieInfo(cookies: string): Promise<void> {
        const now = Date.now();
        const expiresAt = now + (this.COOKIE_EXPIRY_HOURS * 60 * 60 * 1000);
        
        const cookieInfo: CookieInfo = {
            cookies,
            timestamp: now,
            expiresAt,
            isValid: true
        };

        await this.context.globalState.update('augment.cookieInfo', cookieInfo);
        console.log(`🍪 Cookie saved, expires at: ${new Date(expiresAt).toLocaleString()}`);
    }

    async clearCookieData(): Promise<void> {
        await this.context.globalState.update('augment.cookieInfo', undefined);
        console.log('🍪 Cookie data cleared');
    }

    private startPeriodicCheck(): void {
        // 清除现有的定时器
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }

        // 启动新的定时器
        this.checkTimer = setInterval(async () => {
            console.log('🔄 Periodic cookie check...');
            await this.checkCookieStatus();
        }, this.CHECK_INTERVAL_MINUTES * 60 * 1000);

        console.log(`🕐 Started periodic cookie check (every ${this.CHECK_INTERVAL_MINUTES} minutes)`);
    }

    getCookieInfo(): CookieInfo | undefined {
        return this.context.globalState.get<CookieInfo>('augment.cookieInfo');
    }

    isValidCookie(): boolean {
        const cookieInfo = this.getCookieInfo();
        if (!cookieInfo) return false;
        
        const now = Date.now();
        return now < cookieInfo.expiresAt && cookieInfo.isValid;
    }

    getTimeUntilExpiry(): number {
        const cookieInfo = this.getCookieInfo();
        if (!cookieInfo) return 0;

        return Math.max(0, cookieInfo.expiresAt - Date.now());
    }

    clearAllData(): void {
        try {
            // 清空globalState中的cookie信息
            this.context.globalState.update('augment.cookieInfo', undefined);
            this.context.globalState.update('cookieManager.initialized', undefined);

            // 停止定期检查
            if (this.checkTimer) {
                clearInterval(this.checkTimer);
                this.checkTimer = null;
            }

            console.log('🚪 Cookie manager data cleared');
        } catch (error) {
            console.error('Error clearing cookie manager data:', error);
        }
    }

    dispose(): void {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        
        if (this.webAuthManager) {
            this.webAuthManager.dispose();
        }
        
        console.log('🍪 Cookie Manager disposed');
    }
}
