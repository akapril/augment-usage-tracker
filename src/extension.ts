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
        vscode.window.showInformationMessage(t('message.usageReset'));
    });

    const openSettingsCommand = vscode.commands.registerCommand('augmentTracker.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'augmentTracker');
    });

    const showDetailsCommand = vscode.commands.registerCommand('augmentTracker.showDetails', () => {
        showUsageDetails();
    });








    // 提取cookie配置成功处理逻辑
    async function handleCookieConfigSuccess(apiClient: any) {
        vscode.window.showInformationMessage('✅ Cookie配置成功！正在获取数据...');

        // 等待配置保存完成
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            console.log('🔄 [handleCookieConfigSuccess] 开始获取数据...');

            const hasAuth = apiClient.hasAuthToken() || apiClient.hasCookies();
            console.log('🔐 [handleCookieConfigSuccess] 认证状态:', hasAuth);

            if (!hasAuth) {
                vscode.window.showWarningMessage('⚠️ Cookie配置可能失败，请重试。');
                return;
            }

            const [creditsResult, userResult] = await Promise.all([
                apiClient.getCreditsInfo(),
                apiClient.getUserInfo()
            ]);

            console.log('📊 [handleCookieConfigSuccess] Credits结果:', creditsResult.success);
            console.log('👤 [handleCookieConfigSuccess] 用户结果:', userResult.success);

            if (creditsResult.success) {
                const usageData = await apiClient.parseUsageResponse(creditsResult);
                console.log('📈 [handleCookieConfigSuccess] 解析的使用数据:', usageData);

                if (usageData) {
                    await usageTracker.updateWithRealData(usageData);
                    console.log('✅ [handleCookieConfigSuccess] UsageTracker已更新');

                    // 更新用户信息
                    if (userResult.success) {
                        const userInfo = await apiClient.parseUserResponse(userResult);
                        statusBarManager.updateUserInfo(userInfo);
                        console.log('👤 [handleCookieConfigSuccess] 用户信息已更新:', userInfo?.email);
                    }

                    // 直接刷新状态栏
                    statusBarManager.updateDisplay();
                    console.log('🔄 [handleCookieConfigSuccess] 状态栏已刷新');

                    vscode.window.showInformationMessage(t('message.configSuccess'));
                } else {
                    vscode.window.showWarningMessage(t('message.configSuccessButDataFailed'));
                }
            } else {
                vscode.window.showWarningMessage(t('message.configSuccessButApiFailed', creditsResult.error));
            }
        } catch (error) {
            console.error('❌ [handleCookieConfigSuccess] 数据获取错误:', error);
            vscode.window.showErrorMessage(t('message.configError', error));
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
            { label: t('language.autoDetect'), value: 'auto', description: t('language.autoDetectDesc') },
            { label: t('language.english'), value: 'en', description: t('language.englishDesc') },
            { label: t('language.chinese'), value: 'zh-cn', description: t('language.chineseDesc') }
        ];

        const currentLangLabel = currentLanguage === 'auto' ? t('language.autoDetect') :
                                currentLanguage === 'en' ? t('language.english') : t('language.chinese');

        const selected = await vscode.window.showQuickPick(languageOptions, {
            placeHolder: t('language.currentLanguage', currentLangLabel),
            title: t('language.selectLanguage')
        });

        if (selected) {
            await vscode.workspace.getConfiguration('augmentTracker')
                .update('language', selected.value, vscode.ConfigurationTarget.Global);

            // 重新加载i18n
            I18n.setLanguage(selected.value);

            vscode.window.showInformationMessage(
                t('language.languageSet', selected.label) + '\n\n' + t('language.languageExplanation', selected.label),
                t('language.setVSCodeToChinese'),
                t('language.understand')
            ).then(choice => {
                if (choice === t('language.setVSCodeToChinese')) {
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

    // 启动时检查已保存的认证状态并恢复
    const initializeAuthStatus = async () => {
        try {
            console.log('🔄 检查启动时的认证状态...');

            // 检查是否有已保存的cookie
            const savedCookies = vscode.workspace.getConfiguration().get<string>('augment.cookies', '');
            const apiClient = (augmentDetector as any).apiClient;

            if (savedCookies && savedCookies.trim() !== '') {
                console.log('✅ 发现已保存的Cookie，正在恢复状态...');

                // 确保API客户端已加载cookie
                if (!apiClient.hasCookies()) {
                    console.log('🔧 API客户端未加载Cookie，手动设置...');
                    await apiClient.setCookies(savedCookies.trim());
                }

                // 尝试获取数据以验证cookie有效性
                try {
                    const [creditsResult, userResult] = await Promise.all([
                        apiClient.getCreditsInfo(),
                        apiClient.getUserInfo()
                    ]);

                    if (creditsResult.success) {
                        console.log('✅ Cookie有效，正在恢复使用数据...');
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

                            console.log('🎉 认证状态恢复成功！');
                        }
                    } else {
                        console.warn('⚠️ 已保存的Cookie可能已过期');
                        // 显示未登录状态但不清除cookie，让用户决定是否重新配置
                        const status = await augmentDetector.getAugmentStatus();
                        statusBarManager.updateAugmentStatus(status);
                    }
                } catch (error) {
                    console.error('❌ 验证已保存Cookie时出错:', error);
                    // 显示未登录状态
                    const status = await augmentDetector.getAugmentStatus();
                    statusBarManager.updateAugmentStatus(status);
                }
            } else {
                console.log('🔍 未找到已保存的认证信息');
                // 显示未登录状态
                const status = await augmentDetector.getAugmentStatus();
                statusBarManager.updateAugmentStatus(status);
            }
        } catch (error) {
            console.error('❌ 初始化认证状态时出错:', error);
            // 回退到基本状态检查
            const status = await augmentDetector.getAugmentStatus();
            statusBarManager.updateAugmentStatus(status);
        }
    };

    // 异步初始化认证状态
    initializeAuthStatus();

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








}

function showUsageDetails() {
    const usage = usageTracker.getCurrentUsage();
    const limit = usageTracker.getCurrentLimit(); // 使用API返回的limit
    const percentage = limit > 0 ? Math.round((usage / limit) * 100) : 0;
    const hasRealData = usageTracker.hasRealUsageData();

    // 检查认证状态
    const apiClient = (augmentDetector as any).apiClient;
    const hasAuth = apiClient && (apiClient.hasAuthToken() || apiClient.hasCookies());
    let authStatus = hasAuth ? `• ${t('usageDetails.authStatus')}: ${t('usageDetails.configured')}` : `• ${t('usageDetails.authStatus')}: ${t('usageDetails.notConfigured')}`;

    // 获取用户信息
    const userInfo = statusBarManager ? statusBarManager.getUserInfo() : null;

    // 如果没有真实数据，显示未登录状态
    if (!hasRealData || limit === 0) {
        let message = `
${t('usageDetails.title')}
• ${t('usageDetails.status')}: ${t('usageDetails.notLoggedIn')}
• ${t('usageDetails.dataSource')}: ${t('usageDetails.noData')}
${authStatus}`;

        // 如果有用户信息，也显示出来
        if (userInfo) {
            message += `\n\n${t('userInfo.title')}`;
            if (userInfo.email) {
                message += `\n• ${t('userInfo.email')}: ${userInfo.email}`;
            }
            if (userInfo.name) {
                message += `\n• ${t('userInfo.name')}: ${userInfo.name}`;
            }
            if (userInfo.plan) {
                const planText = typeof userInfo.plan === 'object'
                    ? JSON.stringify(userInfo.plan)
                    : String(userInfo.plan);
                message += `\n• ${t('userInfo.plan')}: ${planText}`;
            }
        }

        message += `\n\n${t('usageDetails.pleaseConfigureAuth')}`;

        vscode.window.showInformationMessage(message.trim(), t('usageDetails.configureNow')).then(selection => {
            if (selection === t('usageDetails.configureNow')) {
                vscode.commands.executeCommand('augmentTracker.webLogin');
            }
        });
        return;
    }

    let message = `
${t('usageDetails.title')}
• ${t('usage.currentUsage')}: ${usage} ${t('credits')}
• ${t('usage.monthlyLimit')}: ${limit} ${t('credits')}
• ${t('usage.usagePercentage')}: ${percentage}%
• ${t('usage.remaining')}: ${Math.max(0, limit - usage)} ${t('credits')}
• ${t('usageDetails.dataSource')}: ${hasRealData ? t('usageDetails.realDataFromApi') : t('usageDetails.noData')}
${authStatus}`;

    // 添加用户信息
    if (userInfo) {
        message += `\n\n${t('userInfo.title')}`;
        if (userInfo.email) {
            message += `\n• ${t('userInfo.email')}: ${userInfo.email}`;
        }
        if (userInfo.name) {
            message += `\n• ${t('userInfo.name')}: ${userInfo.name}`;
        }
        if (userInfo.plan) {
            const planText = typeof userInfo.plan === 'object'
                ? JSON.stringify(userInfo.plan)
                : String(userInfo.plan);
            message += `\n• ${t('userInfo.plan')}: ${planText}`;
        }
    
    }

    message += `\n\n${t('usage.lastReset')}: ${usageTracker.getLastResetDate()}`;
    message = message.trim();

    const actions = [t('button.resetUsage'), t('button.openSettings')];

    vscode.window.showInformationMessage(message, ...actions).then(selection => {
        if (selection === t('button.resetUsage')) {
            vscode.commands.executeCommand('augmentTracker.resetUsage');
        } else if (selection === t('button.openSettings')) {
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
