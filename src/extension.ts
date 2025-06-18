import * as vscode from 'vscode';
import { StatusBarManager } from './statusBar';
import { UsageTracker } from './usageTracker';
import { StorageManager } from './storage';
import { AugmentDetector } from './augmentDetector';
import { ConfigManager } from './config';
// 移除未使用的WebAuthManager导入
import { I18n, t } from './i18n';

let statusBarManager: StatusBarManager;
let usageTracker: UsageTracker;
let storageManager: StorageManager;
let augmentDetector: AugmentDetector;
let configManager: ConfigManager;

export function activate(context: vscode.ExtensionContext) {
    // 初始化国际化
    I18n.init();

    // Initialize managers
    storageManager = new StorageManager(context);
    configManager = new ConfigManager();
    augmentDetector = new AugmentDetector();
    usageTracker = new UsageTracker(storageManager, configManager);
    statusBarManager = new StatusBarManager(usageTracker, configManager);

    // Register commands
    const resetUsageCommand = vscode.commands.registerCommand('augmentTracker.resetUsage', () => {
        usageTracker.resetUsage();
        vscode.window.showInformationMessage('Augment usage statistics have been reset.');
    });

    const openSettingsCommand = vscode.commands.registerCommand('augmentTracker.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'augmentTracker');
    });

    const showDetailsCommand = vscode.commands.registerCommand('augmentTracker.showDetails', () => {
        showUsageDetails();
    });


    const setupCookiesCommand = vscode.commands.registerCommand('augmentTracker.setupCookies', async () => {
        const apiClient = (augmentDetector as any).apiClient;
        const success = await apiClient.promptForCookies();
        if (success) {
            vscode.window.showInformationMessage(t('status.cookiesConfigured'));
            // Re-detect status with new cookies
            const status = await augmentDetector.getAugmentStatus();
            statusBarManager.updateAugmentStatus(status);
            if (status.hasRealData && status.usageData) {
                usageTracker.updateWithRealData(status.usageData);
            }
        }
    });

    const checkAuthStatusCommand = vscode.commands.registerCommand('augmentTracker.checkAuthStatus', async () => {
        const apiClient = (augmentDetector as any).apiClient;

        vscode.window.showInformationMessage(t('status.checkingAuth'));

        const hasCookies = apiClient.hasCookies();

        let statusMessage = t('status.authStatus') + '\n';
        statusMessage += `${t('status.browserCookies')}: ${hasCookies ? t('status.configured') : t('status.notConfigured')}\n`;

        if (hasCookies) {
            statusMessage += `\n${t('status.connectionTest')}...`;
        } else {
            statusMessage += `\n\n${t('status.pleaseConfigureAuth')}`;
        }

        vscode.window.showInformationMessage(statusMessage);
    });

    const webLoginCommand = vscode.commands.registerCommand('augmentTracker.webLogin', async () => {
        try {
            // 简化版本：直接打开浏览器并提示用户
            const loginUri = vscode.Uri.parse('https://app.augmentcode.com');
            await vscode.env.openExternal(loginUri);

            vscode.window.showInformationMessage(
                t('dialog.browserOpened'),
                t('dialog.setupCookies'),
                t('dialog.cancel')
            ).then(selection => {
                if (selection === t('dialog.setupCookies')) {
                    vscode.commands.executeCommand('augmentTracker.setupCookies');
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`${t('dialog.webLoginError')}: ${error}`);
        }
    });

   
    // 添加缺失的命令
    const checkCookieStatusCommand = vscode.commands.registerCommand('augmentTracker.checkCookieStatus', async () => {
        const apiClient = (augmentDetector as any).apiClient;
        const hasCookies = apiClient && apiClient.hasCookies();

        if (!hasCookies) {
            vscode.window.showInformationMessage(
                '🍪 Cookie状态: ❌ 未配置\n\n请先配置Cookie以获取使用数据。',
                '🌐 立即配置'
            ).then(selection => {
                if (selection === '🌐 立即配置') {
                    vscode.commands.executeCommand('augmentTracker.webLogin');
                }
            });
            return;
        }

        // 检查Cookie是否有效
        try {
            const testResult = await apiClient.getCreditsInfo();
            if (testResult.success) {
                vscode.window.showInformationMessage(
                    '🍪 Cookie状态: ✅ 有效\n\nCookie工作正常，可以获取使用数据。'
                );
            } else {
                vscode.window.showWarningMessage(
                    '🍪 Cookie状态: ⚠️ 可能已过期\n\n建议刷新Cookie以确保数据准确。',
                    '🔄 刷新Cookie'
                ).then(selection => {
                    if (selection === '🔄 刷新Cookie') {
                        vscode.commands.executeCommand('augmentTracker.refreshCookie');
                    }
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                '🍪 Cookie状态: ❌ 检查失败\n\n' + error,
                '🔄 刷新Cookie'
            ).then(selection => {
                if (selection === '🔄 刷新Cookie') {
                    vscode.commands.executeCommand('augmentTracker.refreshCookie');
                }
            });
        }
    });

    const refreshCookieCommand = vscode.commands.registerCommand('augmentTracker.refreshCookie', async () => {
        vscode.window.showInformationMessage(
            '🔄 刷新Cookie\n\n将打开浏览器，请重新登录以获取新的Cookie。',
            '🌐 打开浏览器',
            '取消'
        ).then(selection => {
            if (selection === '🌐 打开浏览器') {
                vscode.commands.executeCommand('augmentTracker.webLogin');
            }
        });
    });

    const logoutCommand = vscode.commands.registerCommand('augmentTracker.logout', async () => {
        const confirmation = await vscode.window.showWarningMessage(
            '🚪 确定要退出登录吗？\n\n这将清空所有认证数据和使用统计，状态栏将显示未登录状态。',
            '确定退出',
            '取消'
        );

        if (confirmation === '确定退出') {
            try {
                // 清空VSCode配置中的cookies
                await vscode.workspace.getConfiguration()
                    .update('augment.cookies', '', vscode.ConfigurationTarget.Global);

                // 清空API客户端
                const apiClient = (augmentDetector as any).apiClient;
                if (apiClient) {
                    apiClient.clearAuthToken?.();
                    apiClient.clearCookies?.();
                }

                // 重置存储数据
                if (storageManager) {
                    await storageManager.resetUsageData();
                }

                // 重置使用追踪器
                await usageTracker.resetUsage();

                // 更新状态栏为未登录状态
                statusBarManager.updateLogoutStatus();

                vscode.window.showInformationMessage('🚪 已成功退出登录，所有数据已清空。');
            } catch (error) {
                vscode.window.showErrorMessage('🚪 退出登录失败: ' + error);
            }
        }
    });

    const manualRefreshCommand = vscode.commands.registerCommand('augmentTracker.manualRefresh', async () => {
        vscode.window.showInformationMessage('🔄 正在手动刷新数据...');

        try {
            const apiClient = (augmentDetector as any).apiClient;
            if (apiClient && (apiClient.hasAuthToken() || apiClient.hasCookies())) {
                const creditsResult = await apiClient.getCreditsInfo();

                if (creditsResult.success) {
                    const usageData = await apiClient.parseUsageResponse(creditsResult);
                    if (usageData) {
                        await usageTracker.updateWithRealData(usageData);

                        // 更新状态栏
                        const status = await augmentDetector.getAugmentStatus();
                        status.hasRealData = true;
                        status.usageData = usageData;
                        statusBarManager.updateAugmentStatus(status);

                        vscode.window.showInformationMessage('✅ 数据刷新成功！');
                    } else {
                        vscode.window.showWarningMessage('⚠️ 数据解析失败');
                    }
                } else {
                    vscode.window.showErrorMessage('❌ 数据获取失败: ' + creditsResult.error);
                }
            } else {
                vscode.window.showWarningMessage(
                    '⚠️ 未配置认证信息\n\n请先配置认证以获取数据。',
                    '🌐 立即配置'
                ).then(selection => {
                    if (selection === '🌐 立即配置') {
                        vscode.commands.executeCommand('augmentTracker.webLogin');
                    }
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage('❌ 刷新失败: ' + error);
        }
    });

    const setLanguageCommand = vscode.commands.registerCommand('augmentTracker.setLanguage', async () => {
        const currentLanguage = vscode.workspace.getConfiguration('augmentTracker').get<string>('language', 'auto');

        const languageOptions = [
            { label: '🌐 自动检测', value: 'auto', description: '跟随VSCode语言设置' },
            { label: '🇺🇸 English', value: 'en', description: 'English interface' },
            { label: '🇨🇳 中文', value: 'zh-cn', description: '中文界面' }
        ];

        const selected = await vscode.window.showQuickPick(languageOptions, {
            placeHolder: `当前语言: ${currentLanguage === 'auto' ? '自动检测' : currentLanguage === 'en' ? 'English' : '中文'}`,
            title: '选择界面语言'
        });

        if (selected) {
            await vscode.workspace.getConfiguration('augmentTracker')
                .update('language', selected.value, vscode.ConfigurationTarget.Global);

            // 重新加载i18n
            I18n.setLanguage(selected.value);

            vscode.window.showInformationMessage(
                `✅ 语言已设置为: ${selected.label}\n\n某些更改可能需要重启VSCode才能完全生效。`,
                '重启VSCode'
            ).then(choice => {
                if (choice === '重启VSCode') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
        }
    });

    // Start tracking first
    usageTracker.startTracking();
    statusBarManager.show();

    // 然后设置真实数据获取器
    usageTracker.setRealDataFetcher(async () => {
        try {
            const apiClient = (augmentDetector as any).apiClient;

            if (apiClient && (apiClient.hasAuthToken() || apiClient.hasCookies())) {
                // 获取Credits API数据
                const creditsResult = await apiClient.getCreditsInfo();

                if (creditsResult.success) {
                    const usageData = await apiClient.parseUsageResponse(creditsResult);
                    if (usageData) {

                        await usageTracker.updateWithRealData(usageData);

                        // 更新状态栏
                        const status = await augmentDetector.getAugmentStatus();
                        status.hasRealData = true;
                        status.usageData = usageData;
                        statusBarManager.updateAugmentStatus(status);
                    }
                }
            }
        } catch (error) {
            console.error('Error in real data fetcher:', error);
        }
    });

    // 简化的状态检查
    augmentDetector.getAugmentStatus().then(status => {
        statusBarManager.updateAugmentStatus(status);
    });

    // Add to subscriptions
    context.subscriptions.push(
        resetUsageCommand,
        openSettingsCommand,
        showDetailsCommand,
        setupCookiesCommand,
        checkAuthStatusCommand,
        webLoginCommand,
        checkCookieStatusCommand,
        refreshCookieCommand,
        logoutCommand,
        manualRefreshCommand,
        setLanguageCommand,
        statusBarManager,
        usageTracker
    );

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('augmentTracker')) {
            configManager.reloadConfig();
            statusBarManager.updateDisplay();
        }

        // Check if Augment configuration changed
        if (event.affectsConfiguration('augment')) {
            // Re-detect Augment status
            augmentDetector.getAugmentStatus().then(status => {
                statusBarManager.updateAugmentStatus(status);
                if (status.hasRealData && status.usageData) {
                    usageTracker.updateWithRealData(status.usageData);
                }
            });
        }
    });

    // Monitor Augment extension state changes
    const augmentStateWatcher = augmentDetector.onAugmentStateChange(status => {
        statusBarManager.updateAugmentStatus(status);

        if (status.hasRealData && status.usageData) {
            usageTracker.updateWithRealData(status.usageData);
        }
    });

    context.subscriptions.push(augmentStateWatcher);
}

function showUsageDetails() {
    const usage = usageTracker.getCurrentUsage();
    const limit = usageTracker.getCurrentLimit(); // 使用API返回的limit
    const percentage = limit > 0 ? Math.round((usage / limit) * 100) : 0;
    const hasRealData = usageTracker.hasRealUsageData();

    // 检查认证状态
    const apiClient = (augmentDetector as any).apiClient;
    const hasAuth = apiClient && (apiClient.hasAuthToken() || apiClient.hasCookies());
    let authStatus = hasAuth ? '• 认证状态: ✅ 已配置' : '• 认证状态: ❌ 未配置';

    // 如果没有真实数据，显示未登录状态
    if (!hasRealData || limit === 0) {
        const message = `
Augment 使用统计:
• 状态: 未登录
• 数据源: 无数据
${authStatus}

请先配置认证以获取真实使用数据。
        `.trim();

        vscode.window.showInformationMessage(message, '🌐 立即配置').then(selection => {
            if (selection === '🌐 立即配置') {
                vscode.commands.executeCommand('augmentTracker.webLogin');
            }
        });
        return;
    }

    const message = `
Augment 使用统计:
• 当前使用量: ${usage} 积分
• 月度限额: ${limit} 积分
• 使用百分比: ${percentage}%
• 剩余: ${Math.max(0, limit - usage)} 积分
• 数据源: ${hasRealData ? '来自Augment API的真实数据' : '无数据'}
${authStatus}

上次重置: ${usageTracker.getLastResetDate()}
    `.trim();

    const actions = ['重置使用量', '打开设置'];

    vscode.window.showInformationMessage(message, ...actions).then(selection => {
        if (selection === '重置使用量') {
            vscode.commands.executeCommand('augmentTracker.resetUsage');
        } else if (selection === '打开设置') {
            vscode.commands.executeCommand('augmentTracker.openSettings');
        }
    });
}

export function deactivate() {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    if (usageTracker) {
        usageTracker.dispose();
    }
}
