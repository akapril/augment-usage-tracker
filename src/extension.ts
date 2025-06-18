import * as vscode from 'vscode';
import { StatusBarManager } from './statusBar';
import { UsageTracker } from './usageTracker';
import { StorageManager } from './storage';
import { AugmentDetector } from './augmentDetector';
import { ConfigManager } from './config';
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


    // 修改为统一的cookie配置入口
    const simpleCookieSetupCommand = vscode.commands.registerCommand('augmentTracker.simpleCookieSetup', async () => {
        // 直接显示cookie配置页面
        await showCookieConfigurationPage();
    });

    // 显示Cookie配置页面
    async function showCookieConfigurationPage() {
        // 创建并显示webview面板
        const panel = vscode.window.createWebviewPanel(
            'cookieConfig',
            '🍪 Augment Cookie 配置',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // 设置webview内容
        panel.webview.html = getCookieConfigurationHTML();

        // 处理来自webview的消息
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'setCookie':
                        await handleCookieSubmission(message.cookie, panel);
                        break;
                    case 'showGuide':
                        await showCookieGuide();
                        break;
                    case 'openAugment':
                        vscode.env.openExternal(vscode.Uri.parse('https://app.augmentcode.com'));
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    }

    // 处理Cookie提交
    async function handleCookieSubmission(cookieValue: string, panel: vscode.WebviewPanel) {
        try {
            // 验证cookie格式
            const validationResult = validateCookieFormat(cookieValue);
            if (!validationResult.valid) {
                panel.webview.postMessage({
                    command: 'showError',
                    message: validationResult.error
                });
                return;
            }

            // 解析cookie数据
            const parsedData = parseCookieData(cookieValue);

            // 配置API客户端
            const apiClient = (augmentDetector as any).apiClient;
            await apiClient.setCookies(parsedData.cookies);

            // 测试连接并获取数据
            panel.webview.postMessage({
                command: 'showProgress',
                message: '正在验证Cookie并获取数据...'
            });

            const success = await testAndConfigureWithCookie(apiClient, parsedData);

            if (success) {
                panel.webview.postMessage({
                    command: 'showSuccess',
                    message: '✅ Cookie配置成功！',
                    data: parsedData
                });

                // 延迟关闭面板
                setTimeout(() => {
                    panel.dispose();
                }, 2000);
            } else {
                panel.webview.postMessage({
                    command: 'showError',
                    message: '❌ Cookie验证失败，请检查是否已登录或重新获取'
                });
            }

        } catch (error) {
            panel.webview.postMessage({
                command: 'showError',
                message: `❌ 配置失败: ${error}`
            });
        }
    }

    // 提取cookie配置成功处理逻辑
    async function handleCookieConfigSuccess(apiClient: any) {
        vscode.window.showInformationMessage('✅ Cookie配置成功！正在获取数据...');

        // 等待配置保存完成
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            console.log('🔄 [simpleCookieSetup] 开始获取数据...');

            const hasAuth = apiClient.hasAuthToken() || apiClient.hasCookies();
            console.log('🔐 [simpleCookieSetup] 认证状态:', hasAuth);

            if (!hasAuth) {
                vscode.window.showWarningMessage('⚠️ Cookie配置可能失败，请重试。');
                return;
            }

            const [creditsResult, userResult] = await Promise.all([
                apiClient.getCreditsInfo(),
                apiClient.getUserInfo()
            ]);

            console.log('📊 [simpleCookieSetup] Credits结果:', creditsResult.success);
            console.log('👤 [simpleCookieSetup] 用户结果:', userResult.success);

            if (creditsResult.success) {
                const usageData = await apiClient.parseUsageResponse(creditsResult);
                console.log('📈 [simpleCookieSetup] 解析的使用数据:', usageData);

                if (usageData) {
                    await usageTracker.updateWithRealData(usageData);
                    console.log('✅ [simpleCookieSetup] UsageTracker已更新');

                    // 更新用户信息
                    if (userResult.success) {
                        const userInfo = await apiClient.parseUserResponse(userResult);
                        statusBarManager.updateUserInfo(userInfo);
                        console.log('👤 [simpleCookieSetup] 用户信息已更新:', userInfo?.email);
                    }

                    // 直接刷新状态栏
                    statusBarManager.updateDisplay();
                    console.log('🔄 [simpleCookieSetup] 状态栏已刷新');

                    vscode.window.showInformationMessage('🎉 配置完成！状态栏已更新，可以看到真实使用数据了！');
                } else {
                    vscode.window.showWarningMessage('⚠️ Cookie配置成功，但数据解析失败。');
                }
            } else {
                vscode.window.showWarningMessage('⚠️ Cookie配置成功，但数据获取失败: ' + creditsResult.error);
            }
        } catch (error) {
            console.error('❌ [simpleCookieSetup] 数据获取错误:', error);
            vscode.window.showErrorMessage('❌ Cookie配置成功，但数据获取出错: ' + error);
        }
    }

    const setupCookiesCommand = vscode.commands.registerCommand('augmentTracker.setupCookies', async () => {
        const apiClient = (augmentDetector as any).apiClient;
        const success = await apiClient.promptForCookies();
        if (success) {
            vscode.window.showInformationMessage(t('status.cookiesConfigured'));

            // 等待配置保存完成
            await new Promise(resolve => setTimeout(resolve, 500));

            // 立即获取使用数据和用户信息
            try {
                console.log('🔄 [setupCookies] 开始获取数据...');

                // 验证cookies是否正确设置
                const hasAuth = apiClient.hasAuthToken() || apiClient.hasCookies();
                console.log('🔐 [setupCookies] 认证状态:', hasAuth);

                if (!hasAuth) {
                    vscode.window.showWarningMessage('⚠️ Cookies配置可能失败，请重试。');
                    return;
                }

                const [creditsResult, userResult] = await Promise.all([
                    apiClient.getCreditsInfo(),
                    apiClient.getUserInfo()
                ]);

                console.log('📊 [setupCookies] Credits结果:', creditsResult.success);
                console.log('👤 [setupCookies] 用户结果:', userResult.success);

                if (creditsResult.success) {
                    const usageData = await apiClient.parseUsageResponse(creditsResult);
                    console.log('📈 [setupCookies] 解析的使用数据:', usageData);

                    if (usageData) {
                        await usageTracker.updateWithRealData(usageData);
                        console.log('✅ [setupCookies] UsageTracker已更新');
                        console.log('📊 [setupCookies] hasRealData:', usageTracker.hasRealUsageData());
                        console.log('📊 [setupCookies] currentUsage:', usageTracker.getCurrentUsage());
                        console.log('📊 [setupCookies] currentLimit:', usageTracker.getCurrentLimit());

                        // 更新用户信息
                        if (userResult.success) {
                            const userInfo = await apiClient.parseUserResponse(userResult);
                            statusBarManager.updateUserInfo(userInfo);
                            console.log('👤 [setupCookies] 用户信息已更新:', userInfo?.email);
                        }

                        // 更新状态栏 - 直接调用updateDisplay而不是通过updateAugmentStatus
                        statusBarManager.updateDisplay();
                        console.log('🔄 [setupCookies] 直接刷新状态栏');

                        // 额外确保状态栏显示
                        setTimeout(() => {
                            statusBarManager.updateDisplay();
                            console.log('🔄 [setupCookies] 延迟刷新状态栏');
                        }, 100);

                        vscode.window.showInformationMessage('✅ Augment cookies 配置成功！数据已自动刷新。');
                    } else {
                        console.error('❌ [setupCookies] 数据解析失败');
                        vscode.window.showWarningMessage('⚠️ Cookies配置成功，但数据解析失败。');
                    }
                } else {
                    console.error('❌ [setupCookies] Credits API调用失败:', creditsResult.error);
                    // 即使数据获取失败，也要更新状态
                    const status = await augmentDetector.getAugmentStatus();
                    statusBarManager.updateAugmentStatus(status);
                    vscode.window.showWarningMessage('⚠️ Cookies配置成功，但数据获取失败: ' + creditsResult.error);
                }
            } catch (error) {
                console.error('❌ [setupCookies] Error fetching data after cookie setup:', error);
                // 确保状态栏至少显示已配置状态
                const status = await augmentDetector.getAugmentStatus();
                statusBarManager.updateAugmentStatus(status);
                vscode.window.showErrorMessage('❌ Cookies配置成功，但数据获取出错: ' + error);
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
            // 直接使用简单的VSCode内置cookie输入方式
            const loginUri = vscode.Uri.parse('https://app.augmentcode.com');
            await vscode.env.openExternal(loginUri);

            vscode.window.showInformationMessage(
                '🌐 浏览器已打开Augment网站\n\n请先登录，然后点击"配置Cookie"来设置认证信息。',
                '🍪 配置Cookie',
                '取消'
            ).then(selection => {
                if (selection === '🍪 配置Cookie') {
                    vscode.commands.executeCommand('augmentTracker.setupCookies');
                }
            });

        } catch (error) {
            console.error('Web login error:', error);
            vscode.window.showErrorMessage(`打开浏览器失败: ${error}`);
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
                // 1. 停止数据获取器
                usageTracker.setRealDataFetcher(null);

                // 2. 清空VSCode配置中的cookies
                await vscode.workspace.getConfiguration()
                    .update('augment.cookies', '', vscode.ConfigurationTarget.Global);

                // 3. 清空API客户端
                const apiClient = (augmentDetector as any).apiClient;
                if (apiClient) {
                    apiClient.clearAuthToken?.();
                    apiClient.clearCookies?.();
                }

                // 4. 重置存储数据
                if (storageManager) {
                    await storageManager.resetUsageData();
                }

                // 5. 重置使用追踪器（这会清除hasRealData标志）
                await usageTracker.resetUsage();

                // 6. 立即更新状态栏为未登录状态
                statusBarManager.updateLogoutStatus();

                // 7. 清除用户信息
                statusBarManager.updateUserInfo(null);

                // 8. 确保不会再次触发数据获取
                usageTracker.clearRealDataFlag();

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
                // 同时获取使用数据和用户信息
                const [creditsResult, userResult] = await Promise.all([
                    apiClient.getCreditsInfo(),
                    apiClient.getUserInfo()
                ]);

                if (creditsResult.success) {
                    const usageData = await apiClient.parseUsageResponse(creditsResult);
                    if (usageData) {
                        await usageTracker.updateWithRealData(usageData);

                        // 更新状态栏
                        const status = await augmentDetector.getAugmentStatus();
                        status.hasRealData = true;
                        status.usageData = usageData;
                        statusBarManager.updateAugmentStatus(status);

                        // 更新用户信息
                        if (userResult.success) {
                            const userInfo = await apiClient.parseUserResponse(userResult);
                            statusBarManager.updateUserInfo(userInfo);
                        }

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
                `✅ 插件语言已设置为: ${selected.label}\n\n📋 语言设置说明：\n• 状态栏和消息：已立即更新为${selected.label}\n• 命令面板：由VSCode界面语言控制\n\n💡 如需命令面板显示中文：\n1. Ctrl+Shift+P → "Configure Display Language"\n2. 选择"中文(简体)"\n3. 重启VSCode`,
                '设置VSCode为中文',
                '了解'
            ).then(choice => {
                if (choice === '设置VSCode为中文') {
                    vscode.commands.executeCommand('workbench.action.configureLocale');
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
                // 同时获取Credits API数据和用户信息
                const [creditsResult, userResult] = await Promise.all([
                    apiClient.getCreditsInfo(),
                    apiClient.getUserInfo()
                ]);

                if (creditsResult.success) {
                    const usageData = await apiClient.parseUsageResponse(creditsResult);
                    if (usageData) {
                        await usageTracker.updateWithRealData(usageData);

                        // 更新状态栏
                        const status = await augmentDetector.getAugmentStatus();
                        status.hasRealData = true;
                        status.usageData = usageData;
                        statusBarManager.updateAugmentStatus(status);

                        // 更新用户信息
                        if (userResult.success) {
                            const userInfo = await apiClient.parseUserResponse(userResult);
                            statusBarManager.updateUserInfo(userInfo);
                        }
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
        simpleCookieSetupCommand,
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
            // 检查是否有认证数据，避免在退出登录后重新获取数据
            const cookies = vscode.workspace.getConfiguration().get<string>('augment.cookies', '');
            if (cookies && cookies.trim() !== '') {
                // 只有在有认证数据时才重新检测状态
                augmentDetector.getAugmentStatus().then(status => {
                    statusBarManager.updateAugmentStatus(status);
                    if (status.hasRealData && status.usageData) {
                        usageTracker.updateWithRealData(status.usageData);
                    }
                });
            } else {
                // 没有认证数据时，确保显示未登录状态
                statusBarManager.updateLogoutStatus();
            }
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

    // 辅助函数：生成Cookie配置页面HTML
    function getCookieConfigurationHTML(): string {
        return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🍪 Augment Cookie 配置</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.6;
        }
        .container {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            text-align: center;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 30px;
            font-size: 24px;
        }
        .step {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .step h3 {
            margin: 0 0 10px 0;
            color: var(--vscode-textLink-foreground);
        }
        textarea {
            width: 100%;
            height: 120px;
            padding: 15px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
            transition: background-color 0.2s;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .button-group {
            text-align: center;
            margin-top: 20px;
        }
        .status {
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
            text-align: center;
            display: none;
        }
        .status.success {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }
        .status.error {
            background: var(--vscode-testing-iconFailed);
            color: white;
        }
        .status.progress {
            background: var(--vscode-progressBar-background);
            color: var(--vscode-editor-foreground);
        }
        .link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
        }
        .link:hover {
            text-decoration: underline;
        }
        .highlight {
            background: var(--vscode-editor-selectionBackground);
            padding: 2px 4px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🍪 Augment Cookie 配置</h1>

        <div class="step">
            <h3>📋 步骤1: 获取Cookie</h3>
            <p>请先访问 <span class="link" onclick="openAugment()">app.augmentcode.com</span> 并确保已登录</p>
            <p>然后按 <span class="highlight">F12</span> → <span class="highlight">Application</span> → <span class="highlight">Cookies</span> → 复制 <span class="highlight">_session</span> 的值</p>
            <button class="secondary" onclick="showGuide()">📖 查看详细指导</button>
        </div>

        <div class="step">
            <h3>🔧 步骤2: 粘贴Cookie</h3>
            <p>请将获取的Cookie粘贴到下面的文本框中：</p>
            <textarea id="cookieInput" placeholder="粘贴您的Cookie内容...&#10;&#10;支持格式：&#10;• _session=eyJhbGciOiJIUzI1NiJ9...&#10;• 完整的Cookie字符串&#10;• 或者只是session值"></textarea>
        </div>

        <div class="button-group">
            <button onclick="submitCookie()">✅ 配置Cookie</button>
            <button class="secondary" onclick="showGuide()">📋 获取帮助</button>
        </div>

        <div id="status" class="status"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function submitCookie() {
            const cookieValue = document.getElementById('cookieInput').value.trim();
            if (!cookieValue) {
                showStatus('error', '❌ 请先输入Cookie内容');
                return;
            }

            showStatus('progress', '🔄 正在配置Cookie...');

            vscode.postMessage({
                command: 'setCookie',
                cookie: cookieValue
            });
        }

        function showGuide() {
            vscode.postMessage({
                command: 'showGuide'
            });
        }

        function openAugment() {
            vscode.postMessage({
                command: 'openAugment'
            });
        }

        function showStatus(type, message) {
            const statusDiv = document.getElementById('status');
            statusDiv.className = 'status ' + type;
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';
        }

        // 监听来自VSCode的消息
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'showError':
                    showStatus('error', message.message);
                    break;
                case 'showSuccess':
                    showStatus('success', message.message);
                    if (message.data) {
                        console.log('配置成功，数据:', message.data);
                    }
                    break;
                case 'showProgress':
                    showStatus('progress', message.message);
                    break;
            }
        });

        // 自动聚焦到输入框
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('cookieInput').focus();
        });
    </script>
</body>
</html>
        `;
    }

    // 辅助函数：显示Cookie获取指导
    async function showCookieGuide() {
        const guide = `
# 🍪 Cookie获取详细指导

## 📋 方法1: 浏览器开发者工具（推荐）

### 步骤详解：

1️⃣ **打开Augment网站**
   - 访问 https://app.augmentcode.com
   - 确保已经登录到您的账户

2️⃣ **打开开发者工具**
   - 按 F12 键
   - 或右键页面 → "检查元素"
   - 或菜单栏 → "更多工具" → "开发者工具"

3️⃣ **导航到Cookie存储**
   - 点击 **Application** 标签页
   - 在左侧面板找到 **Storage** 部分
   - 展开 **Cookies**
   - 点击 **https://app.augmentcode.com**

4️⃣ **复制Session Cookie**
   - 在右侧找到名为 **_session** 的cookie
   - 双击 **Value** 列中的值
   - 按 Ctrl+C 复制

5️⃣ **返回VSCode配置**
   - 回到VSCode的配置页面
   - 粘贴复制的值
   - 点击"配置Cookie"

## 💡 常见问题

### ❓ 找不到_session cookie？
- 确认已经登录 app.augmentcode.com
- 刷新页面后重新查看
- 检查是否在正确的域名下

### ❓ 复制的值很短？
- 确保复制了完整的Value值
- Session值通常很长（100+字符）
- 以 "eyJ" 开头的是正确格式

### ❓ 仍然有问题？
- 尝试重新登录Augment
- 清除浏览器缓存后重试
- 联系技术支持获取帮助

## 🔒 安全提示

- Cookie包含敏感信息，请妥善保管
- 不要在公共场所或不安全的网络环境下操作
- 配置完成后建议定期更新
        `;

        const doc = await vscode.workspace.openTextDocument({
            content: guide,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    }

    // 辅助函数：验证Cookie格式
    function validateCookieFormat(cookieValue: string): { valid: boolean; error?: string } {
        if (!cookieValue || cookieValue.trim().length === 0) {
            return { valid: false, error: '❌ Cookie不能为空' };
        }

        const trimmed = cookieValue.trim();

        // 检查是否包含_session
        if (!trimmed.includes('_session=')) {
            return { valid: false, error: '❌ 请确保包含_session cookie' };
        }

        // 提取session值
        const match = trimmed.match(/_session=([^;]+)/);
        if (!match) {
            return { valid: false, error: '❌ 无法提取_session值' };
        }

        const sessionValue = match[1];
        if (!sessionValue || sessionValue.length < 50) {
            return { valid: false, error: '❌ Session值太短，请检查是否完整' };
        }

        // 检查是否是Augment的URL编码session格式
        if (sessionValue.includes('%') && sessionValue.includes('.')) {
            // 这是Augment的标准格式：URL编码的payload + 签名
            return { valid: true };
        }

        // 检查是否是标准JWT格式
        if (sessionValue.startsWith('eyJ')) {
            const parts = sessionValue.split('.');
            if (parts.length === 3) {
                return { valid: true };
            }
        }

        // 其他长度合理的session值也认为是有效的
        if (sessionValue.length >= 50) {
            return { valid: true };
        }

        return { valid: false, error: '❌ 无法识别的session格式' };
    }

    // 辅助函数：解析Cookie数据
    function parseCookieData(cookieValue: string): { cookies: string; sessionValue: string; userInfo?: any } {
        const trimmed = cookieValue.trim();
        let sessionValue = '';
        let cookies = '';

        if (trimmed.includes('_session=')) {
            // 完整的cookie字符串
            cookies = trimmed;
            const match = trimmed.match(/_session=([^;]+)/);
            if (match) {
                sessionValue = match[1];
            }
        } else if (trimmed.startsWith('eyJ')) {
            // 只有session值
            sessionValue = trimmed;
            cookies = `_session=${sessionValue}`;
        }

        // 尝试解析JWT获取用户信息
        let userInfo = undefined;
        try {
            if (sessionValue.startsWith('eyJ')) {
                const payload = sessionValue.split('.')[1];
                const decoded = JSON.parse(atob(payload));
                userInfo = {
                    userId: decoded.user_id,
                    email: decoded.email,
                    exp: decoded.exp
                };
            }
        } catch (error) {
            // 解析失败，继续使用原始值
        }

        return {
            cookies,
            sessionValue,
            userInfo
        };
    }

    // 辅助函数：测试并配置Cookie
    async function testAndConfigureWithCookie(apiClient: any, _parsedData: any): Promise<boolean> {
        try {
            // 等待配置保存完成
            await new Promise(resolve => setTimeout(resolve, 500));

            // 验证认证状态
            const hasAuth = apiClient.hasAuthToken() || apiClient.hasCookies();
            if (!hasAuth) {
                console.error('❌ 认证状态检查失败：没有有效的认证信息');
                vscode.window.showErrorMessage('认证配置失败：没有有效的认证信息');
                return false;
            }

            console.log('🔍 开始获取Augment数据...');

            // 并行获取使用数据和用户信息
            const [creditsResult, userResult] = await Promise.all([
                apiClient.getCreditsInfo(),
                apiClient.getUserInfo()
            ]);

            console.log('📊 API调用结果:', {
                creditsSuccess: creditsResult.success,
                creditsError: creditsResult.error,
                userSuccess: userResult.success,
                userError: userResult.error
            });

            // 检查API调用结果
            if (!creditsResult.success && !userResult.success) {
                console.error('❌ 所有API调用都失败了');
                vscode.window.showWarningMessage('认证配置成功，但数据获取失败。请稍后手动刷新。', '手动刷新').then(selection => {
                    if (selection === '手动刷新') {
                        vscode.commands.executeCommand('augmentTracker.refreshUsage');
                    }
                });
                return true; // 认证成功，但数据获取失败
            }

            // 处理使用数据
            if (creditsResult.success) {
                const usageData = await apiClient.parseUsageResponse(creditsResult);
                if (usageData) {
                    console.log('✅ 使用数据解析成功:', usageData);
                    await usageTracker.updateWithRealData(usageData);
                } else {
                    console.warn('⚠️ 使用数据解析失败');
                }
            } else {
                console.warn('⚠️ 获取使用数据失败:', creditsResult.error);
            }

            // 处理用户信息
            if (userResult.success) {
                const userInfo = await apiClient.parseUserResponse(userResult);
                if (userInfo) {
                    console.log('✅ 用户信息解析成功:', userInfo);
                    statusBarManager.updateUserInfo(userInfo);
                } else {
                    console.warn('⚠️ 用户信息解析失败');
                }
            } else {
                console.warn('⚠️ 获取用户信息失败:', userResult.error);
            }

            // 刷新状态栏
            statusBarManager.updateDisplay();

            // 根据结果显示不同的消息
            if (creditsResult.success || userResult.success) {
                vscode.window.showInformationMessage('🎉 Cookie配置成功！状态栏已更新。');
                return true;
            } else {
                vscode.window.showWarningMessage('认证配置成功，但数据获取失败。请稍后手动刷新。', '手动刷新').then(selection => {
                    if (selection === '手动刷新') {
                        vscode.commands.executeCommand('augmentTracker.refreshUsage');
                    }
                });
                return true; // 认证成功，但数据获取失败
            }

        } catch (error) {
            console.error('❌ Cookie配置错误:', error);
            vscode.window.showErrorMessage(`Cookie配置失败: ${error}`);
            return false;
        }
    }
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
