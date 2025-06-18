import * as vscode from 'vscode';

// 国际化文本映射
const messages = {
    'en': {
        // Status messages
        'status.noAuth': 'No authentication available for real data fetch',
        'status.fetchingData': 'Fetching real usage data...',
        'status.apiSuccess': 'API connection successful!',
        'status.apiFailed': 'API connection failed',
        'status.cookiesConfigured': 'Augment cookies configured successfully!',
        'status.checkingAuth': 'Checking authentication status...',
        'status.authStatus': 'Authentication Status:',
        'status.apiToken': 'API Token',
        'status.browserCookies': 'Browser Cookies',
        'status.configured': 'Configured',
        'status.notConfigured': 'Not configured',
        'status.connectionTest': 'Connection test',
        'status.success': 'Success',
        'status.failed': 'Failed',
        'status.error': 'Error',
        'status.suggestion': 'Suggestion: Cookies may have expired, please get new ones',
        'status.pleaseConfigureAuth': 'Please configure authentication first',
        
        // Dialog messages
        'dialog.browserOpened': 'Browser opened! Please login to Augment, then use "Setup Browser Cookies" command.',
        'dialog.setupCookies': 'Setup Cookies',
        'dialog.cancel': 'Cancel',
        'dialog.webLoginError': 'Web login error',
        
        // Usage details
        'usage.title': 'Augment Usage Statistics:',
        'usage.currentUsage': 'Current Usage',
        'usage.monthlyLimit': 'Monthly Limit',
        'usage.usagePercentage': 'Usage Percentage',
        'usage.remaining': 'Remaining',
        'usage.lastReset': 'Last Reset',
        'usage.resetUsage': 'Reset Usage',
        'usage.openSettings': 'Open Settings',
        
        // Tooltip
        'tooltip.augmentUsageTracker': 'Augment Usage Tracker',
        'tooltip.current': 'Current',
        'tooltip.limit': 'Limit',
        'tooltip.usage': 'Usage',
        'tooltip.remaining': 'Remaining',
        'tooltip.plan': 'Plan',
        'tooltip.dataSource': 'Data Source',
        'tooltip.realDataFromApi': 'Real data from Augment API',
        'tooltip.simulatedData': 'Simulated data',
        
        // Credits
        'credits': 'credits',

        // Auto login
        'autoLogin.starting': 'Starting automatic login process...',
        'autoLogin.success': 'Automatic login successful!',
        'autoLogin.failed': 'Automatic login failed',
        'autoLogin.serverStarted': 'Local extraction server started',
        'autoLogin.timeout': 'Authentication timeout',
        'autoLogin.extracting': 'Extracting session cookies...'
    },
    'zh-cn': {
        // Status messages
        'status.noAuth': '没有可用的认证信息获取真实数据',
        'status.fetchingData': '正在获取真实使用数据...',
        'status.apiSuccess': '✅ API连接成功！',
        'status.apiFailed': '❌ API连接失败',
        'status.cookiesConfigured': '🍪 Augment cookies 配置成功！',
        'status.checkingAuth': '🔍 检查认证状态...',
        'status.authStatus': '🔐 认证状态:',
        'status.apiToken': 'API Token',
        'status.browserCookies': 'Browser Cookies',
        'status.configured': '✅ 已配置',
        'status.notConfigured': '❌ 未配置',
        'status.connectionTest': '连接测试',
        'status.success': '✅ 成功',
        'status.failed': '❌ 失败',
        'status.error': '错误',
        'status.suggestion': '💡 建议: Cookie可能已过期，请重新获取',
        'status.pleaseConfigureAuth': '💡 请先配置认证信息',
        
        // Dialog messages
        'dialog.browserOpened': '🌐 浏览器已打开！请登录Augment，然后使用"设置浏览器Cookie"命令。只需要获取_session cookie即可。格式_session=eyxsfgfgs......',
        'dialog.setupCookies': '设置Cookie',
        'dialog.cancel': '取消',
        'dialog.webLoginError': '❌ 网页登录错误',
        
        // Usage details
        'usage.title': 'Augment 使用统计:',
        'usage.currentUsage': '当前使用量',
        'usage.monthlyLimit': '月度限额',
        'usage.usagePercentage': '使用百分比',
        'usage.remaining': '剩余',
        'usage.lastReset': '上次重置',
        'usage.resetUsage': '重置使用量',
        'usage.openSettings': '打开设置',
        
        // Tooltip
        'tooltip.augmentUsageTracker': 'Augment 使用量追踪器',
        'tooltip.current': '当前',
        'tooltip.limit': '限额',
        'tooltip.usage': '使用量',
        'tooltip.remaining': '剩余',
        'tooltip.plan': '计划',
        'tooltip.dataSource': '数据源',
        'tooltip.realDataFromApi': '来自Augment API的真实数据',
        'tooltip.simulatedData': '模拟数据',
        
        // Credits
        'credits': '积分',

        // Auto login
        'autoLogin.starting': '🚀 启动自动登录流程...',
        'autoLogin.success': '✅ 自动登录成功！',
        'autoLogin.failed': '❌ 自动登录失败',
        'autoLogin.serverStarted': '🌐 本地提取服务器已启动',
        'autoLogin.timeout': '⏰ 认证超时',
        'autoLogin.extracting': '🔄 正在提取session cookies...'
    }
};

export class I18n {
    private static locale: string = 'en';
    
    static init() {
        // 获取VSCode语言设置
        const vscodeLocale = vscode.env.language;
        
        // 支持的语言映射
        const supportedLocales: { [key: string]: string } = {
            'zh-cn': 'zh-cn',
            'zh-tw': 'zh-cn', // 繁体中文也使用简体中文
            'zh': 'zh-cn',
            'en': 'en',
            'en-us': 'en',
            'en-gb': 'en'
        };
        
        this.locale = supportedLocales[vscodeLocale.toLowerCase()] || 'en';
    }
    
    static t(key: string, ...args: any[]): string {
        const localeMessages = messages[this.locale as keyof typeof messages] || messages['en'];
        let message = localeMessages[key as keyof typeof localeMessages] || key;
        
        // 简单的参数替换
        if (args.length > 0) {
            args.forEach((arg, index) => {
                message = message.replace(`{${index}}`, String(arg));
            });
        }
        
        return message;
    }
    
    static getLocale(): string {
        return this.locale;
    }
    
    static isZhCn(): boolean {
        return this.locale === 'zh-cn';
    }

    static setLanguage(language: string): void {
        // 支持的语言映射
        const supportedLocales: { [key: string]: string } = {
            'auto': this.getAutoDetectedLanguage(),
            'zh-cn': 'zh-cn',
            'en': 'en'
        };

        this.locale = supportedLocales[language] || 'en';
    }

    private static getAutoDetectedLanguage(): string {
        const vscodeLocale = vscode.env.language;
        const supportedLocales: { [key: string]: string } = {
            'zh-cn': 'zh-cn',
            'zh-tw': 'zh-cn',
            'zh': 'zh-cn',
            'en': 'en',
            'en-us': 'en',
            'en-gb': 'en'
        };

        return supportedLocales[vscodeLocale.toLowerCase()] || 'en';
    }
}

// 便捷函数
export function t(key: string, ...args: any[]): string {
    return I18n.t(key, ...args);
}
