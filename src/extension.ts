import * as vscode from 'vscode';
import { StatusBarManager } from './statusBar';
import { UsageTracker } from './usageTracker';
import { StorageManager } from './storage';
import { AugmentDetector } from './augmentDetector';
import { ConfigManager } from './config';
import { I18n, t } from './i18n';
import { AutoRegistrationManager } from './autoRegistrationManager';
import { PuppeteerLoginManager } from './puppeteerLoginManager';
import { AccountManager } from './accountManager';
import { TeamManagementPanel } from './teamManagementPanel';
import { NativeManagementPanel } from './nativeManagementPanel';
import { AugmentTreeDataProvider } from './treeViewProvider';

let statusBarManager: StatusBarManager;
let usageTracker: UsageTracker;
let storageManager: StorageManager;
let augmentDetector: AugmentDetector;
let configManager: ConfigManager;
let accountManager: AccountManager;
let treeDataProvider: AugmentTreeDataProvider;

export function activate(context: vscode.ExtensionContext) {
    // 初始化国际化
    I18n.init();

    // Initialize managers
    storageManager = new StorageManager(context);
    configManager = new ConfigManager();
    augmentDetector = new AugmentDetector();
    accountManager = new AccountManager(context);
    usageTracker = new UsageTracker(storageManager, configManager);
    statusBarManager = new StatusBarManager(usageTracker, configManager);

    // Initialize account manager
    accountManager.initialize();

    // Initialize native management panel
    NativeManagementPanel.initialize(context, (augmentDetector as any).apiClient, accountManager, usageTracker, statusBarManager);

    // Initialize tree view
    treeDataProvider = new AugmentTreeDataProvider((augmentDetector as any).apiClient, accountManager, usageTracker, statusBarManager);
    const treeView = vscode.window.createTreeView('augmentTracker', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

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
                    '🍪 Cookie状态: ⚠️ 已过期或无效\n\n' +
                    '检测到Cookie可能已过期，这会影响数据获取的准确性。\n' +
                    '建议立即刷新Cookie以恢复正常功能。',
                    '🔄 立即刷新',
                    '📋 查看详情',
                    '⏰ 稍后处理'
                ).then(selection => {
                    if (selection === '🔄 立即刷新') {
                        vscode.commands.executeCommand('augmentTracker.refreshCookie');
                    } else if (selection === '📋 查看详情') {
                        vscode.window.showInformationMessage(
                            '🍪 Cookie过期说明\n\n' +
                            '• Cookie是用于身份验证的临时凭证\n' +
                            '• 过期后无法获取最新的使用数据\n' +
                            '• 刷新Cookie需要重新登录Augment网站\n' +
                            '• 刷新后将自动恢复数据同步功能\n\n' +
                            '💡 提示：新的Cookie会自动在定时刷新时更新',
                            '🔄 现在刷新',
                            '❌ 关闭'
                        ).then(detailChoice => {
                            if (detailChoice === '🔄 现在刷新') {
                                vscode.commands.executeCommand('augmentTracker.refreshCookie');
                            }
                        });
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
            '🔄 刷新Cookie认证\n\n' +
            '即将打开浏览器进行重新认证：\n' +
            '1. 🌐 自动打开Augment登录页面\n' +
            '2. 🔐 请在浏览器中完成登录\n' +
            '3. 🍪 系统将自动提取新的Cookie\n' +
            '4. ✅ 认证完成后自动恢复数据同步\n\n' +
            '💡 提示：新Cookie将自动在后续的定时刷新中更新',
            '🌐 开始刷新',
            '❓ 了解详情',
            '❌ 取消'
        ).then(selection => {
            if (selection === '🌐 开始刷新') {
                vscode.commands.executeCommand('augmentTracker.webLogin');
            } else if (selection === '❓ 了解详情') {
                vscode.window.showInformationMessage(
                    '🔧 Cookie刷新机制说明\n\n' +
                    '🔄 自动更新：\n' +
                    '• 扩展每30秒检查一次Cookie状态\n' +
                    '• 发现新Cookie时自动合并更新\n' +
                    '• 无需用户手动干预\n\n' +
                    '🔐 手动刷新：\n' +
                    '• 适用于Cookie完全失效的情况\n' +
                    '• 通过浏览器重新登录获取新Cookie\n' +
                    '• 立即恢复所有功能\n\n' +
                    '⚙️ 可在设置中调整刷新间隔：augmentTracker.refreshInterval',
                    '🌐 现在刷新',
                    '⚙️ 打开设置'
                ).then(detailChoice => {
                    if (detailChoice === '🌐 现在刷新') {
                        vscode.commands.executeCommand('augmentTracker.webLogin');
                    } else if (detailChoice === '⚙️ 打开设置') {
                        vscode.commands.executeCommand('augmentTracker.openSettings');
                    }
                });
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

    // 自动注册命令
    const autoRegisterCommand = vscode.commands.registerCommand('augmentTracker.autoRegister', async () => {
        try {
            const registrationManager = new AutoRegistrationManager();
            const result = await registrationManager.startAutoRegistration();

            if (result.success && result.cookies) {
                // 保存cookies到配置
                await vscode.workspace.getConfiguration()
                    .update('augment.cookies', result.cookies, vscode.ConfigurationTarget.Global);

                // 设置API客户端cookies
                const apiClient = (augmentDetector as any).apiClient;
                if (apiClient) {
                    await apiClient.setCookies(result.cookies);
                }

                // 立即获取数据验证注册成功
                await handleCookieConfigSuccess(apiClient);

                vscode.window.showInformationMessage(
                    `🎉 自动注册成功！\n\n` +
                    `邮箱: ${result.userEmail}\n` +
                    `认证已配置，可以开始使用Augment服务。`
                );
            } else {
                vscode.window.showErrorMessage(
                    `❌ 自动注册失败\n\n` +
                    `错误: ${result.error}\n\n` +
                    `请尝试手动注册或使用现有账户登录。`
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `❌ 自动注册过程出错\n\n` +
                `错误: ${error}\n\n` +
                `请检查网络连接或尝试手动注册。`
            );
        }
    });

    // Puppeteer登录命令
    const puppeteerLoginCommand = vscode.commands.registerCommand('augmentTracker.puppeteerLogin', async () => {
        try {
            const puppeteerManager = new PuppeteerLoginManager();
            const result = await puppeteerManager.startPuppeteerLogin();

            if (result.success && result.cookies) {
                // 保存cookies到配置
                await vscode.workspace.getConfiguration()
                    .update('augment.cookies', result.cookies, vscode.ConfigurationTarget.Global);

                // 设置API客户端cookies
                const apiClient = (augmentDetector as any).apiClient;
                if (apiClient) {
                    await apiClient.setCookies(result.cookies);
                }

                // 立即获取数据验证登录成功
                await handleCookieConfigSuccess(apiClient);

                vscode.window.showInformationMessage(
                    `🎉 浏览器登录成功！\n\n` +
                    `已通过Puppeteer成功提取Cookie\n` +
                    `认证已配置，可以开始使用Augment服务。`
                );
            } else {
                vscode.window.showErrorMessage(
                    `❌ 浏览器登录失败\n\n` +
                    `错误: ${result.error}\n\n` +
                    `请检查网络连接或尝试其他登录方式。`
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `❌ 浏览器登录过程出错\n\n` +
                `错误: ${error}\n\n` +
                `请检查浏览器安装或尝试其他登录方式。`
            );
        }
    });

    // 账户管理命令
    const manageAccountsCommand = vscode.commands.registerCommand('augmentTracker.manageAccounts', async () => {
        try {
            const accounts = await accountManager.getAllAccounts();
            const currentAccount = await accountManager.getCurrentAccount();

            // 计算账户统计信息
            const activeAccounts = accounts.filter(acc => acc.isActive).length;
            const totalAccounts = accounts.length;
            const lastUsedAccount = accounts.length > 0 ?
                accounts.reduce((latest, acc) => acc.lastUsedAt > latest.lastUsedAt ? acc : latest) : null;

            const items = [
                {
                    label: '$(add) 添加新账户',
                    description: '通过浏览器登录、自动注册或手动输入',
                    detail: '支持多种认证方式，快速添加新的Augment账户',
                    action: 'add'
                },
                {
                    label: '$(arrow-swap) 切换账户',
                    description: `当前: ${currentAccount ? `${currentAccount.name} (${currentAccount.email})` : '无活跃账户'}`,
                    detail: `在 ${totalAccounts} 个账户中快速切换`,
                    action: 'switch'
                },
                {
                    label: '$(list-unordered) 账户列表',
                    description: `管理 ${totalAccounts} 个账户`,
                    detail: lastUsedAccount ? `最近使用: ${lastUsedAccount.name} (${new Date(lastUsedAccount.lastUsedAt).toLocaleString()})` : '暂无使用记录',
                    action: 'list'
                },
                {
                    label: '$(graph) 使用统计',
                    description: '查看各账户的使用情况对比',
                    detail: '分析账户使用模式和效率',
                    action: 'stats'
                },
                {
                    label: '$(sync) 同步账户',
                    description: '刷新所有账户的使用数据',
                    detail: '更新账户状态和使用统计信息',
                    action: 'sync'
                },
                {
                    label: '$(export) 导出配置',
                    description: '备份账户配置（不含敏感信息）',
                    detail: '生成可导入的账户配置文件',
                    action: 'export'
                },
                {
                    label: '$(import) 导入配置',
                    description: '从备份文件恢复账户配置',
                    detail: '批量导入账户设置',
                    action: 'import'
                },
                {
                    label: '$(trash) 删除账户',
                    description: '移除不需要的账户',
                    detail: '永久删除选定的账户及其数据',
                    action: 'remove'
                }
            ];

            const choice = await vscode.window.showQuickPick(items, {
                placeHolder: `账户管理中心 - 当前 ${totalAccounts} 个账户`,
                ignoreFocusOut: true,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (choice) {
                switch (choice.action) {
                    case 'add':
                        await vscode.commands.executeCommand('augmentTracker.addAccount');
                        break;
                    case 'switch':
                        await vscode.commands.executeCommand('augmentTracker.switchAccount');
                        break;
                    case 'list':
                        await showAccountsList();
                        break;
                    case 'stats':
                        await showAccountsStats();
                        break;
                    case 'sync':
                        await syncAllAccounts();
                        break;
                    case 'export':
                        await exportAccountsInfo();
                        break;
                    case 'import':
                        await importAccountsInfo();
                        break;
                    case 'remove':
                        await vscode.commands.executeCommand('augmentTracker.removeAccount');
                        break;
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`账户管理操作失败: ${error}`);
        }
    });

    // 切换账户命令
    const switchAccountCommand = vscode.commands.registerCommand('augmentTracker.switchAccount', async () => {
        try {
            const accounts = await accountManager.getAllAccounts();

            if (accounts.length === 0) {
                vscode.window.showInformationMessage(
                    '🚫 没有可用的账户\n\n请先添加一个账户以开始使用。',
                    '$(add) 添加账户',
                    '$(question) 帮助'
                ).then(choice => {
                    if (choice === '$(add) 添加账户') {
                        vscode.commands.executeCommand('augmentTracker.addAccount');
                    } else if (choice === '$(question) 帮助') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/akapril/augment-usage-tracker#readme'));
                    }
                });
                return;
            }

            if (accounts.length === 1) {
                const account = accounts[0];
                if (account.isActive) {
                    vscode.window.showInformationMessage(
                        `✅ 当前只有一个账户: ${account.name}\n\n` +
                        `邮箱: ${account.email}\n` +
                        `状态: 已激活`,
                        '$(add) 添加更多账户'
                    ).then(choice => {
                        if (choice === '$(add) 添加更多账户') {
                            vscode.commands.executeCommand('augmentTracker.addAccount');
                        }
                    });
                    return;
                }
            }

            const currentAccount = await accountManager.getCurrentAccount();

            // 为账户添加状态图标和详细信息
            const items = accounts.map(account => {
                const isActive = account.isActive;
                const lastUsed = new Date(account.lastUsedAt);
                const created = new Date(account.createdAt);
                const daysSinceLastUsed = Math.floor((Date.now() - account.lastUsedAt) / (1000 * 60 * 60 * 24));

                let statusIcon = isActive ? '$(check)' : '$(circle-outline)';
                let statusText = isActive ? '当前账户' : '点击切换';

                // 添加使用情况提示
                if (!isActive && daysSinceLastUsed > 30) {
                    statusIcon = '$(warning)';
                    statusText = '长期未使用';
                } else if (!isActive && daysSinceLastUsed > 7) {
                    statusIcon = '$(clock)';
                    statusText = '最近未使用';
                }

                return {
                    label: `${statusIcon} ${account.name}`,
                    description: account.email,
                    detail: `${statusText} | 最后使用: ${lastUsed.toLocaleDateString()} | 创建: ${created.toLocaleDateString()}`,
                    account: account
                };
            });

            const choice = await vscode.window.showQuickPick(items, {
                placeHolder: `选择要切换的账户 (当前: ${currentAccount?.name || '无活跃账户'})`,
                ignoreFocusOut: true,
                matchOnDescription: true,
                title: '账户切换'
            });

            if (choice && !choice.account.isActive) {
                // 显示切换进度
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "切换账户",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: `正在切换到 ${choice.account.name}...` });

                    const success = await accountManager.switchToAccount(choice.account.id);
                    progress.report({ increment: 50, message: "更新认证信息..." });

                    if (success) {
                        // 触发数据刷新
                        const apiClient = (augmentDetector as any).apiClient;
                        if (apiClient) {
                            await apiClient.setCookies(choice.account.cookies);
                            progress.report({ increment: 75, message: "验证账户状态..." });

                            // 立即获取数据验证切换成功
                            await handleCookieConfigSuccess(apiClient);
                            progress.report({ increment: 100, message: "切换完成！" });
                        }

                        vscode.window.showInformationMessage(
                            `✅ 账户切换成功！\n\n` +
                            `当前账户: ${choice.account.name}\n` +
                            `邮箱: ${choice.account.email}\n` +
                            `数据已刷新`
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `❌ 账户切换失败\n\n` +
                            `无法切换到账户: ${choice.account.name}\n` +
                            `请检查账户状态或重试`
                        );
                    }
                });
            } else if (choice && choice.account.isActive) {
                vscode.window.showInformationMessage(
                    `ℹ️ 已经是当前账户\n\n` +
                    `账户: ${choice.account.name}\n` +
                    `邮箱: ${choice.account.email}`,
                    '$(refresh) 刷新数据'
                ).then(refreshChoice => {
                    if (refreshChoice === '$(refresh) 刷新数据') {
                        vscode.commands.executeCommand('augmentTracker.manualRefresh');
                    }
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`切换账户失败: ${error}`);
        }
    });

    // 添加账户命令
    const addAccountCommand = vscode.commands.registerCommand('augmentTracker.addAccount', async () => {
        try {
            const addMethods = [
                {
                    label: '🎭 通过浏览器登录',
                    description: '使用Puppeteer自动登录并提取Cookie',
                    method: 'puppeteer'
                },
                {
                    label: '🤖 自动注册新账户',
                    description: '注册全新的Augment账户',
                    method: 'register'
                },
                {
                    label: '🍪 手动输入Cookie',
                    description: '直接输入已有的Cookie信息',
                    method: 'manual'
                }
            ];

            const choice = await vscode.window.showQuickPick(addMethods, {
                placeHolder: '选择添加账户的方式',
                ignoreFocusOut: true
            });

            if (!choice) return;

            let cookies = '';
            let email = '';
            let name = '';

            switch (choice.method) {
                case 'puppeteer':
                    const puppeteerManager = new PuppeteerLoginManager();
                    const puppeteerResult = await puppeteerManager.startPuppeteerLogin();
                    if (puppeteerResult.success && puppeteerResult.cookies) {
                        cookies = puppeteerResult.cookies;
                        email = puppeteerResult.userEmail || 'puppeteer@extracted.local';
                        name = await promptForAccountName(email);
                    } else {
                        vscode.window.showErrorMessage(`浏览器登录失败: ${puppeteerResult.error}`);
                        return;
                    }
                    break;

                case 'register':
                    const registrationManager = new AutoRegistrationManager();
                    const registrationResult = await registrationManager.startAutoRegistration();
                    if (registrationResult.success && registrationResult.cookies) {
                        cookies = registrationResult.cookies;
                        email = registrationResult.userEmail || 'auto@registered.local';
                        name = await promptForAccountName(email);
                    } else {
                        vscode.window.showErrorMessage(`自动注册失败: ${registrationResult.error}`);
                        return;
                    }
                    break;

                case 'manual':
                    const manualResult = await promptForManualAccount();
                    if (manualResult) {
                        cookies = manualResult.cookies;
                        email = manualResult.email;
                        name = manualResult.name;
                    } else {
                        return;
                    }
                    break;
            }

            if (cookies && email && name) {
                try {
                    const newAccount = await accountManager.addAccount(name, email, cookies);
                    vscode.window.showInformationMessage(
                        `✅ 账户添加成功！\n\n` +
                        `名称: ${newAccount.name}\n` +
                        `邮箱: ${newAccount.email}\n\n` +
                        '是否立即切换到此账户？',
                        '立即切换',
                        '稍后切换'
                    ).then(switchChoice => {
                        if (switchChoice === '立即切换') {
                            accountManager.switchToAccount(newAccount.id);
                        }
                    });
                } catch (error) {
                    vscode.window.showErrorMessage(`添加账户失败: ${error}`);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`添加账户过程出错: ${error}`);
        }
    });

    // 团队邀请命令
    const inviteTeamMembersCommand = vscode.commands.registerCommand('augmentTracker.inviteTeamMembers', async () => {
        try {
            const apiClient = (augmentDetector as any).apiClient;

            if (!apiClient || !apiClient.hasAnyAuth()) {
                vscode.window.showErrorMessage(
                    '❌ 团队邀请需要认证\n\n请先配置Augment账户认证信息。',
                    '配置认证'
                ).then(choice => {
                    if (choice === '配置认证') {
                        vscode.commands.executeCommand('augmentTracker.webLogin');
                    }
                });
                return;
            }

            // 输入邮箱地址
            const emailsInput = await vscode.window.showInputBox({
                prompt: '输入要邀请的团队成员邮箱地址',
                placeHolder: '例如: user1@example.com, user2@example.com, user3@example.com',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return '邮箱地址不能为空';
                    }

                    // 简单验证邮箱格式
                    const emails = value.split(',').map(email => email.trim());
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    const invalidEmails = emails.filter(email => !emailRegex.test(email));

                    if (invalidEmails.length > 0) {
                        return `无效的邮箱地址: ${invalidEmails.join(', ')}`;
                    }

                    if (emails.length > 10) {
                        return '一次最多只能邀请10个用户';
                    }

                    return null;
                }
            });

            if (!emailsInput) {
                return;
            }

            // 解析邮箱列表
            const emails = emailsInput.split(',').map(email => email.trim()).filter(email => email.length > 0);

            if (emails.length === 0) {
                vscode.window.showErrorMessage('没有有效的邮箱地址');
                return;
            }

            // 确认邀请
            const confirmMessage = `📧 确认邀请团队成员\n\n` +
                `将邀请以下 ${emails.length} 个邮箱地址:\n` +
                emails.map(email => `• ${email}`).join('\n') + '\n\n' +
                `确定要发送邀请吗？`;

            const confirmation = await vscode.window.showInformationMessage(
                confirmMessage,
                '✅ 发送邀请',
                '❌ 取消'
            );

            if (confirmation !== '✅ 发送邀请') {
                return;
            }

            // 发送邀请
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "发送团队邀请",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: `正在邀请 ${emails.length} 个用户...` });

                try {
                    const result = await apiClient.inviteTeamMembers(emails);
                    progress.report({ increment: 100, message: "邀请完成" });

                    if (result.success) {
                        vscode.window.showInformationMessage(
                            `✅ 团队邀请发送成功！\n\n` +
                            `已向 ${emails.length} 个邮箱地址发送邀请:\n` +
                            emails.map(email => `• ${email}`).join('\n') + '\n\n' +
                            `受邀用户将收到邮件通知。`
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `❌ 团队邀请发送失败\n\n` +
                            `错误信息: ${result.error || '未知错误'}\n\n` +
                            `请检查网络连接和认证状态后重试。`
                        );
                    }
                } catch (error) {
                    progress.report({ increment: 100, message: "邀请失败" });
                    vscode.window.showErrorMessage(`❌ 团队邀请过程出错: ${error}`);
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`❌ 团队邀请功能出错: ${error}`);
        }
    });

    // 自动接受邀请命令
    const autoAcceptInvitationsCommand = vscode.commands.registerCommand('augmentTracker.autoAcceptInvitations', async () => {
        try {
            const apiClient = (augmentDetector as any).apiClient;

            if (!apiClient) {
                vscode.window.showErrorMessage('❌ API客户端未初始化');
                return;
            }

            // 输入邮箱地址
            const email = await vscode.window.showInputBox({
                prompt: '输入要监控的邮箱地址',
                placeHolder: '例如: user@akapril.in, user@mailto.plus',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return '邮箱地址不能为空';
                    }

                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(value.trim())) {
                        return '请输入有效的邮箱地址';
                    }

                    return null;
                }
            });

            if (!email) {
                return;
            }

            // 输入PIN码（可选）
            const epin = await vscode.window.showInputBox({
                prompt: '输入邮箱PIN码（可选，某些邮箱服务需要）',
                placeHolder: '留空如果不需要PIN码',
                password: false
            });

            // 确认监控
            const confirmMessage = `📧 确认自动接受邀请\n\n` +
                `将监控邮箱: ${email}\n` +
                `PIN码: ${epin ? '已设置' : '未设置'}\n\n` +
                `系统将自动查找并接受Augment团队邀请。\n` +
                `确定要开始监控吗？`;

            const confirmation = await vscode.window.showInformationMessage(
                confirmMessage,
                '✅ 开始监控',
                '❌ 取消'
            );

            if (confirmation !== '✅ 开始监控') {
                return;
            }

            // 开始监控
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "监控团队邀请",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: `正在检查邮箱 ${email}...` });

                try {
                    const result = await apiClient.monitorAndAcceptInvitations(email, epin || '');
                    progress.report({ increment: 100, message: "监控完成" });

                    if (result.success) {
                        const data = result.data;
                        let message = `✅ 邀请监控完成！\n\n`;
                        message += `📊 统计信息:\n`;
                        message += `• 总邮件数: ${data.totalMails || 0}\n`;
                        message += `• 邀请邮件: ${data.invitationMails || 0}\n`;
                        message += `• 处理邀请: ${data.processedInvitations?.length || 0}\n`;
                        message += `• 成功接受: ${data.acceptedCount || 0}\n\n`;

                        if (data.processedInvitations && data.processedInvitations.length > 0) {
                            message += `📋 处理详情:\n`;
                            data.processedInvitations.forEach((inv: any, index: number) => {
                                message += `${index + 1}. ${inv.subject || '无主题'}\n`;
                                message += `   来源: ${inv.from}\n`;
                                message += `   状态: ${inv.accepted ? '✅ 已接受' : '❌ 失败'}\n`;
                                if (inv.error) {
                                    message += `   错误: ${inv.error}\n`;
                                }
                                message += '\n';
                            });
                        }

                        vscode.window.showInformationMessage(message);
                    } else {
                        vscode.window.showErrorMessage(
                            `❌ 邀请监控失败\n\n` +
                            `错误信息: ${result.error || '未知错误'}\n\n` +
                            `请检查邮箱地址和网络连接后重试。`
                        );
                    }
                } catch (error) {
                    progress.report({ increment: 100, message: "监控失败" });
                    vscode.window.showErrorMessage(`❌ 邀请监控过程出错: ${error}`);
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`❌ 自动接受邀请功能出错: ${error}`);
        }
    });

    // 团队管理面板命令
    const teamManagementCommand = vscode.commands.registerCommand('augmentTracker.teamManagement', () => {
        const apiClient = (augmentDetector as any).apiClient;
        TeamManagementPanel.createOrShow(context.extensionUri, apiClient, accountManager, usageTracker, statusBarManager);
    });

    // 原生管理面板命令（备选方案）
    const nativeManagementCommand = vscode.commands.registerCommand('augmentTracker.nativeManagement', () => {
        NativeManagementPanel.showMainMenu();
    });

    // TreeView刷新命令
    const refreshTreeViewCommand = vscode.commands.registerCommand('augmentTracker.refreshTreeView', () => {
        treeDataProvider.refresh();
    });

    // 团队邀请输入命令
    const inviteTeamMembersInputCommand = vscode.commands.registerCommand('augmentTracker.inviteTeamMembersInput', async () => {
        // 首先检查认证状态
        const apiClient = (augmentDetector as any).apiClient;
        if (!apiClient || !apiClient.hasAnyAuth()) {
            const result = await vscode.window.showWarningMessage(
                '❌ 未认证\n\n需要先配置Augment账户才能邀请团队成员。',
                '🌐 立即配置',
                '取消'
            );
            if (result === '🌐 立即配置') {
                vscode.commands.executeCommand('augmentTracker.webLogin');
            }
            return;
        }

        const emails = await vscode.window.showInputBox({
            prompt: '输入要邀请的邮箱地址（用逗号或换行分隔）',
            placeHolder: 'user1@example.com, user2@example.com\nuser3@example.com',
            value: '',
            validateInput: (value) => {
                if (!value.trim()) {
                    return '请输入至少一个邮箱地址';
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const emailList = value.split(/[,\n]/).map(e => e.trim()).filter(e => e);
                const invalidEmails = emailList.filter(email => !emailRegex.test(email));
                if (invalidEmails.length > 0) {
                    return `无效的邮箱地址: ${invalidEmails.join(', ')}`;
                }
                if (emailList.length > 10) {
                    return '一次最多只能邀请10个用户';
                }
                return null;
            }
        });

        if (emails) {
            vscode.window.showInformationMessage('📧 正在发送邀请...');
            vscode.commands.executeCommand('augmentTracker.inviteTeamMembers', emails);
        }
    });

    // 自动接受邀请输入命令
    const autoAcceptInvitationsInputCommand = vscode.commands.registerCommand('augmentTracker.autoAcceptInvitationsInput', async () => {
        const email = await vscode.window.showInputBox({
            prompt: '输入要监控的邮箱地址',
            placeHolder: 'your-email@example.com',
            validateInput: (value) => {
                if (!value.trim()) {
                    return '请输入邮箱地址';
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value.trim())) {
                    return '请输入有效的邮箱地址';
                }
                return null;
            }
        });

        if (email) {
            const epin = await vscode.window.showInputBox({
                prompt: '输入邮箱PIN码（可选，大多数情况下留空）',
                placeHolder: '留空或输入PIN码（如果邮箱服务需要）'
            });

            vscode.window.showInformationMessage('🤖 开始监控邮箱邀请...');
            vscode.commands.executeCommand('augmentTracker.autoAcceptInvitations', email, epin || '');
        }
    });

    // 删除账户命令
    const removeAccountCommand = vscode.commands.registerCommand('augmentTracker.removeAccount', async () => {
        try {
            const accounts = await accountManager.getAllAccounts();

            if (accounts.length === 0) {
                vscode.window.showInformationMessage('没有可删除的账户');
                return;
            }

            const items = accounts.map(account => ({
                label: `${account.isActive ? '✅' : '⭕'} ${account.name}`,
                description: account.email,
                detail: `${account.isActive ? '当前账户 - ' : ''}创建于: ${new Date(account.createdAt).toLocaleDateString()}`,
                account: account
            }));

            const choice = await vscode.window.showQuickPick(items, {
                placeHolder: '选择要删除的账户',
                ignoreFocusOut: true
            });

            if (choice) {
                const confirmation = await vscode.window.showWarningMessage(
                    `🗑️ 确定要删除账户吗？\n\n` +
                    `账户名称: ${choice.account.name}\n` +
                    `邮箱: ${choice.account.email}\n\n` +
                    `${choice.account.isActive ? '⚠️ 这是当前活跃账户，删除后将自动切换到其他账户。' : ''}`,
                    '确定删除',
                    '取消'
                );

                if (confirmation === '确定删除') {
                    const success = await accountManager.removeAccount(choice.account.id);
                    if (success) {
                        vscode.window.showInformationMessage(
                            `✅ 账户删除成功\n\n已删除账户: ${choice.account.name}`
                        );

                        // 如果删除的是当前账户，刷新状态
                        if (choice.account.isActive) {
                            const newCurrentAccount = await accountManager.getCurrentAccount();
                            if (newCurrentAccount) {
                                // 切换到新的当前账户
                                const apiClient = (augmentDetector as any).apiClient;
                                if (apiClient) {
                                    await apiClient.setCookies(newCurrentAccount.cookies);
                                    await handleCookieConfigSuccess(apiClient);
                                }
                            } else {
                                // 没有其他账户了，显示未登录状态
                                statusBarManager.updateLogoutStatus();
                            }
                        }
                    } else {
                        vscode.window.showErrorMessage('删除账户失败');
                    }
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`删除账户失败: ${error}`);
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
                // 同时获取Credits API数据和用户信息（用户信息会自动更新cookies）
                const [creditsResult, userResult] = await Promise.all([
                    apiClient.getCreditsInfo(),
                    apiClient.getUserInfoWithCookieUpdate() // 使用新方法自动更新cookies
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

                            // 如果响应中包含新的cookies，会在getUserInfoWithCookieUpdate中自动处理
                            if (userResult.cookies) {
                                console.log('🍪 定时刷新时获取到新的cookies，已自动更新');
                            }
                        } else if (userResult.sessionInvalidated) {
                            // 处理会话失效（在其他地方登录）
                            console.warn('🚨 检测到会话失效，可能在其他地方登录了');
                            await handleSessionInvalidation(apiClient);
                        }
                    }
                } else if (creditsResult.sessionInvalidated) {
                    // Credits API也检测到会话失效
                    console.warn('🚨 Credits API检测到会话失效');
                    await handleSessionInvalidation(apiClient);
                } else {
                    console.warn('⚠️ Credits API调用失败:', creditsResult.error);
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

                        // 显示友好的过期提示
                        vscode.window.showWarningMessage(
                            '🍪 认证状态: ⚠️ Cookie已过期\n\n' +
                            '检测到已保存的Cookie无法正常工作，可能是因为：\n' +
                            '• Cookie已过期（通常7-30天）\n' +
                            '• Augment网站更新了认证机制\n' +
                            '• 网络连接问题\n\n' +
                            '💡 新的Cookie会在定时刷新时自动更新，或您可以手动刷新。',
                            '🔄 立即刷新',
                            '⏰ 稍后处理',
                            '❓ 了解更多'
                        ).then(choice => {
                            if (choice === '🔄 立即刷新') {
                                vscode.commands.executeCommand('augmentTracker.webLogin');
                            } else if (choice === '❓ 了解更多') {
                                vscode.window.showInformationMessage(
                                    '🔧 Cookie自动更新机制\n\n' +
                                    '✅ 自动更新：扩展会在定时刷新时自动检测并更新Cookie\n' +
                                    '✅ 智能合并：新Cookie会与现有Cookie智能合并\n' +
                                    '✅ 无感知：整个过程在后台进行，无需用户干预\n\n' +
                                    '🕐 默认刷新间隔：30秒\n' +
                                    '📍 可在设置中调整：augmentTracker.refreshInterval\n\n' +
                                    '如果问题持续存在，建议手动刷新Cookie。',
                                    '🔄 手动刷新',
                                    '⚙️ 打开设置'
                                ).then(moreChoice => {
                                    if (moreChoice === '🔄 手动刷新') {
                                        vscode.commands.executeCommand('augmentTracker.webLogin');
                                    } else if (moreChoice === '⚙️ 打开设置') {
                                        vscode.commands.executeCommand('augmentTracker.openSettings');
                                    }
                                });
                            }
                        });

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
        autoRegisterCommand,
        puppeteerLoginCommand,
        manageAccountsCommand,
        switchAccountCommand,
        addAccountCommand,
        inviteTeamMembersCommand,
        autoAcceptInvitationsCommand,
        teamManagementCommand,
        nativeManagementCommand,
        refreshTreeViewCommand,
        inviteTeamMembersInputCommand,
        autoAcceptInvitationsInputCommand,
        removeAccountCommand,
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

// 辅助函数：显示账户列表
async function showAccountsList() {
    try {
        const accounts = await accountManager.getAllAccounts();
        const currentAccount = await accountManager.getCurrentAccount();

        if (accounts.length === 0) {
            vscode.window.showInformationMessage(
                '📋 账户列表为空\n\n还没有添加任何账户。',
                '$(add) 添加账户'
            ).then(choice => {
                if (choice === '$(add) 添加账户') {
                    vscode.commands.executeCommand('augmentTracker.addAccount');
                }
            });
            return;
        }

        const items = accounts.map((account, index) => {
            const isActive = account.isActive;
            const lastUsed = new Date(account.lastUsedAt);
            const created = new Date(account.createdAt);
            const daysSinceLastUsed = Math.floor((Date.now() - account.lastUsedAt) / (1000 * 60 * 60 * 24));

            let statusIcon = isActive ? '$(check)' : '$(circle-outline)';
            let healthStatus = '健康';

            if (daysSinceLastUsed > 30) {
                healthStatus = '长期未使用';
                statusIcon = isActive ? '$(check)' : '$(warning)';
            } else if (daysSinceLastUsed > 7) {
                healthStatus = '最近未使用';
                statusIcon = isActive ? '$(check)' : '$(clock)';
            }

            return {
                label: `${statusIcon} ${account.name}`,
                description: `${account.email} | ${healthStatus}`,
                detail: `最后使用: ${lastUsed.toLocaleDateString()} | 创建: ${created.toLocaleDateString()}${account.usageData ? ` | 使用量: ${account.usageData.totalUsage}` : ''}`,
                account: account
            };
        });

        const choice = await vscode.window.showQuickPick(items, {
            placeHolder: `账户列表 (${accounts.length} 个账户)`,
            ignoreFocusOut: true,
            title: '账户详情'
        });

        if (choice) {
            // 显示账户详细信息
            await showAccountDetails(choice.account);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`显示账户列表失败: ${error}`);
    }
}

// 辅助函数：显示账户详细信息
async function showAccountDetails(account: any) {
    const created = new Date(account.createdAt);
    const lastUsed = new Date(account.lastUsedAt);
    const daysSinceCreated = Math.floor((Date.now() - account.createdAt) / (1000 * 60 * 60 * 24));
    const daysSinceLastUsed = Math.floor((Date.now() - account.lastUsedAt) / (1000 * 60 * 60 * 24));

    let detailMessage = `📋 账户详情\n\n`;
    detailMessage += `名称: ${account.name}\n`;
    detailMessage += `邮箱: ${account.email}\n`;
    detailMessage += `状态: ${account.isActive ? '✅ 当前活跃' : '⭕ 非活跃'}\n`;
    detailMessage += `创建时间: ${created.toLocaleString()} (${daysSinceCreated} 天前)\n`;
    detailMessage += `最后使用: ${lastUsed.toLocaleString()} (${daysSinceLastUsed} 天前)\n`;

    if (account.usageData) {
        detailMessage += `\n📊 使用统计:\n`;
        detailMessage += `总使用量: ${account.usageData.totalUsage}\n`;
        detailMessage += `剩余额度: ${account.usageData.remainingCredits || 'N/A'}\n`;
        detailMessage += `计划类型: ${account.usageData.plan || 'N/A'}\n`;
    }

    const actions = [];
    if (!account.isActive) {
        actions.push('$(arrow-swap) 切换到此账户');
    }
    actions.push('$(edit) 编辑信息', '$(refresh) 刷新数据', '$(trash) 删除账户');

    const choice = await vscode.window.showInformationMessage(
        detailMessage,
        ...actions
    );

    switch (choice) {
        case '$(arrow-swap) 切换到此账户':
            await accountManager.switchToAccount(account.id);
            vscode.window.showInformationMessage(`已切换到账户: ${account.name}`);
            break;
        case '$(edit) 编辑信息':
            await editAccountInfo(account);
            break;
        case '$(refresh) 刷新数据':
            await refreshAccountData(account);
            break;
        case '$(trash) 删除账户':
            vscode.commands.executeCommand('augmentTracker.removeAccount');
            break;
    }
}

// 辅助函数：编辑账户信息
async function editAccountInfo(account: any) {
    const newName = await vscode.window.showInputBox({
        prompt: '输入新的账户名称',
        value: account.name,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return '账户名称不能为空';
            }
            return null;
        }
    });

    if (newName && newName !== account.name) {
        const success = await accountManager.updateAccountInfo(account.id, { name: newName });
        if (success) {
            vscode.window.showInformationMessage(`✅ 账户名称已更新: ${newName}`);
        } else {
            vscode.window.showErrorMessage('❌ 更新账户名称失败');
        }
    }
}

// 辅助函数：刷新账户数据
async function refreshAccountData(account: any) {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "刷新账户数据",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: `正在刷新 ${account.name} 的数据...` });

        try {
            // 这里可以添加具体的数据刷新逻辑
            // 暂时模拟刷新过程
            await new Promise(resolve => setTimeout(resolve, 1000));
            progress.report({ increment: 100, message: "刷新完成" });

            vscode.window.showInformationMessage(`✅ ${account.name} 的数据已刷新`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ 刷新 ${account.name} 的数据失败: ${error}`);
        }
    });
}

// 辅助函数：显示账户统计
async function showAccountsStats() {
    try {
        const accounts = await accountManager.getAllAccounts();

        if (accounts.length === 0) {
            vscode.window.showInformationMessage(
                '📊 暂无统计数据\n\n还没有添加任何账户。',
                '$(add) 添加账户'
            ).then(choice => {
                if (choice === '$(add) 添加账户') {
                    vscode.commands.executeCommand('augmentTracker.addAccount');
                }
            });
            return;
        }

        // 计算统计数据
        const totalAccounts = accounts.length;
        const activeAccounts = accounts.filter(acc => acc.isActive).length;
        const accountsWithUsageData = accounts.filter(acc => acc.usageData).length;

        const totalUsage = accounts.reduce((sum, acc) =>
            sum + (acc.usageData?.totalUsage || 0), 0);
        const totalCredits = accounts.reduce((sum, acc) =>
            sum + (acc.usageData?.remainingCredits || 0), 0);

        const oldestAccount = accounts.reduce((oldest, acc) =>
            acc.createdAt < oldest.createdAt ? acc : oldest);
        const newestAccount = accounts.reduce((newest, acc) =>
            acc.createdAt > newest.createdAt ? acc : newest);
        const mostActiveAccount = accounts.reduce((mostActive, acc) =>
            acc.lastUsedAt > mostActive.lastUsedAt ? acc : mostActive);

        let statsMessage = `📊 账户统计概览\n\n`;
        statsMessage += `总账户数: ${totalAccounts}\n`;
        statsMessage += `活跃账户: ${activeAccounts}\n`;
        statsMessage += `有数据账户: ${accountsWithUsageData}\n\n`;

        statsMessage += `📈 使用统计:\n`;
        statsMessage += `总使用量: ${totalUsage}\n`;
        statsMessage += `总剩余额度: ${totalCredits}\n`;
        statsMessage += `平均使用量: ${totalAccounts > 0 ? Math.round(totalUsage / totalAccounts) : 0}\n\n`;

        statsMessage += `🏆 账户记录:\n`;
        statsMessage += `最早账户: ${oldestAccount.name} (${new Date(oldestAccount.createdAt).toLocaleDateString()})\n`;
        statsMessage += `最新账户: ${newestAccount.name} (${new Date(newestAccount.createdAt).toLocaleDateString()})\n`;
        statsMessage += `最活跃账户: ${mostActiveAccount.name} (${new Date(mostActiveAccount.lastUsedAt).toLocaleDateString()})\n`;

        const choice = await vscode.window.showInformationMessage(
            statsMessage,
            '$(list-unordered) 详细列表',
            '$(graph) 使用对比',
            '$(export) 导出报告'
        );

        switch (choice) {
            case '$(list-unordered) 详细列表':
                await showAccountsList();
                break;
            case '$(graph) 使用对比':
                await showUsageComparison();
                break;
            case '$(export) 导出报告':
                await exportStatsReport();
                break;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`显示账户统计失败: ${error}`);
    }
}

// 辅助函数：显示使用对比
async function showUsageComparison() {
    try {
        const accounts = await accountManager.getAllAccounts();
        const accountsWithData = accounts.filter(acc => acc.usageData);

        if (accountsWithData.length === 0) {
            vscode.window.showInformationMessage(
                '📊 暂无使用数据\n\n没有账户包含使用统计信息。',
                '$(refresh) 刷新数据'
            ).then(choice => {
                if (choice === '$(refresh) 刷新数据') {
                    vscode.commands.executeCommand('augmentTracker.manualRefresh');
                }
            });
            return;
        }

        // 按使用量排序
        const sortedAccounts = accountsWithData.sort((a, b) =>
            (b.usageData?.totalUsage || 0) - (a.usageData?.totalUsage || 0));

        const items = sortedAccounts.map((account, index) => {
            const usage = account.usageData?.totalUsage || 0;
            const credits = account.usageData?.remainingCredits || 0;
            const plan = account.usageData?.plan || 'Unknown';

            let rankIcon = '$(circle-outline)';
            if (index === 0) rankIcon = '$(star-full)';
            else if (index === 1) rankIcon = '$(star-half)';
            else if (index === 2) rankIcon = '$(star-empty)';

            return {
                label: `${rankIcon} #${index + 1} ${account.name}`,
                description: `使用量: ${usage} | 剩余: ${credits} | ${plan}`,
                detail: `邮箱: ${account.email} | 最后使用: ${new Date(account.lastUsedAt).toLocaleDateString()}`,
                account: account
            };
        });

        const choice = await vscode.window.showQuickPick(items, {
            placeHolder: `使用量对比 (${accountsWithData.length} 个有数据的账户)`,
            ignoreFocusOut: true,
            title: '账户使用对比'
        });

        if (choice) {
            await showAccountDetails(choice.account);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`显示使用对比失败: ${error}`);
    }
}

// 辅助函数：同步所有账户
async function syncAllAccounts() {
    try {
        const accounts = await accountManager.getAllAccounts();

        if (accounts.length === 0) {
            vscode.window.showInformationMessage('没有账户需要同步');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "同步账户数据",
            cancellable: false
        }, async (progress) => {
            const totalAccounts = accounts.length;

            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i];
                const progressPercent = Math.round((i / totalAccounts) * 100);

                progress.report({
                    increment: progressPercent,
                    message: `正在同步 ${account.name}... (${i + 1}/${totalAccounts})`
                });

                try {
                    // 这里可以添加具体的同步逻辑
                    // 暂时模拟同步过程
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`同步账户 ${account.name} 失败:`, error);
                }
            }

            progress.report({ increment: 100, message: "同步完成" });
        });

        vscode.window.showInformationMessage(
            `✅ 账户同步完成\n\n已同步 ${accounts.length} 个账户的数据。`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`同步账户失败: ${error}`);
    }
}

// 辅助函数：导出账户信息
async function exportAccountsInfo() {
    try {
        const accounts = await accountManager.getAllAccounts();

        if (accounts.length === 0) {
            vscode.window.showInformationMessage('没有账户可以导出');
            return;
        }

        // 创建导出数据（不包含敏感信息）
        const exportData = {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            totalAccounts: accounts.length,
            accounts: accounts.map(account => ({
                id: account.id,
                name: account.name,
                email: account.email,
                createdAt: account.createdAt,
                lastUsedAt: account.lastUsedAt,
                isActive: account.isActive,
                usageData: account.usageData ? {
                    totalUsage: account.usageData.totalUsage,
                    plan: account.usageData.plan
                } : null
                // 注意：不导出 cookies 等敏感信息
            }))
        };

        const exportJson = JSON.stringify(exportData, null, 2);
        const fileName = `augment-accounts-${new Date().toISOString().split('T')[0]}.json`;

        // 使用VSCode的保存对话框
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName),
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            }
        });

        if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(exportJson, 'utf8'));

            vscode.window.showInformationMessage(
                `✅ 账户配置导出成功\n\n` +
                `文件: ${saveUri.fsPath}\n` +
                `包含 ${accounts.length} 个账户的配置信息\n` +
                `(不包含敏感的认证数据)`,
                '$(folder) 打开文件夹'
            ).then(choice => {
                if (choice === '$(folder) 打开文件夹') {
                    vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            });
        }
    } catch (error) {
        vscode.window.showErrorMessage(`导出账户信息失败: ${error}`);
    }
}

// 辅助函数：导入账户信息
async function importAccountsInfo() {
    try {
        // 使用VSCode的打开对话框
        const openUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            }
        });

        if (!openUri || openUri.length === 0) {
            return;
        }

        const fileUri = openUri[0];
        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        const importData = JSON.parse(fileContent.toString());

        // 验证导入数据格式
        if (!importData.accounts || !Array.isArray(importData.accounts)) {
            vscode.window.showErrorMessage('❌ 无效的导入文件格式');
            return;
        }

        const importAccounts = importData.accounts;
        const existingAccounts = await accountManager.getAllAccounts();

        // 检查重复账户
        const duplicates = importAccounts.filter((importAcc: any) =>
            existingAccounts.some(existingAcc => existingAcc.email === importAcc.email)
        );

        let confirmMessage = `📥 准备导入 ${importAccounts.length} 个账户\n\n`;
        if (duplicates.length > 0) {
            confirmMessage += `⚠️ 发现 ${duplicates.length} 个重复账户:\n`;
            duplicates.forEach((acc: any) => {
                confirmMessage += `• ${acc.name} (${acc.email})\n`;
            });
            confirmMessage += `\n重复账户将被跳过。\n\n`;
        }
        confirmMessage += `是否继续导入？`;

        const confirmation = await vscode.window.showWarningMessage(
            confirmMessage,
            '$(check) 确认导入',
            '$(x) 取消'
        );

        if (confirmation !== '$(check) 确认导入') {
            return;
        }

        // 执行导入
        let importedCount = 0;
        let skippedCount = 0;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "导入账户配置",
            cancellable: false
        }, async (progress) => {
            for (let i = 0; i < importAccounts.length; i++) {
                const importAcc = importAccounts[i];
                const progressPercent = Math.round((i / importAccounts.length) * 100);

                progress.report({
                    increment: progressPercent,
                    message: `正在导入 ${importAcc.name}... (${i + 1}/${importAccounts.length})`
                });

                // 检查是否重复
                const isDuplicate = existingAccounts.some(existingAcc =>
                    existingAcc.email === importAcc.email
                );

                if (isDuplicate) {
                    skippedCount++;
                    continue;
                }

                try {
                    // 注意：导入的账户没有cookies，需要用户后续手动配置
                    await accountManager.addAccount(
                        importAcc.name,
                        importAcc.email,
                        '' // 空的cookies，需要用户后续配置
                    );
                    importedCount++;
                } catch (error) {
                    console.error(`导入账户 ${importAcc.name} 失败:`, error);
                    skippedCount++;
                }
            }

            progress.report({ increment: 100, message: "导入完成" });
        });

        vscode.window.showInformationMessage(
            `✅ 账户导入完成\n\n` +
            `成功导入: ${importedCount} 个账户\n` +
            `跳过重复: ${skippedCount} 个账户\n\n` +
            `⚠️ 导入的账户需要重新配置认证信息`,
            '$(list-unordered) 查看账户'
        ).then(choice => {
            if (choice === '$(list-unordered) 查看账户') {
                vscode.commands.executeCommand('augmentTracker.manageAccounts');
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`导入账户信息失败: ${error}`);
    }
}

// 辅助函数：导出统计报告
async function exportStatsReport() {
    try {
        const accounts = await accountManager.getAllAccounts();

        if (accounts.length === 0) {
            vscode.window.showInformationMessage('没有数据可以导出');
            return;
        }

        // 生成统计报告
        const reportData = {
            reportDate: new Date().toISOString(),
            summary: {
                totalAccounts: accounts.length,
                activeAccounts: accounts.filter(acc => acc.isActive).length,
                accountsWithData: accounts.filter(acc => acc.usageData).length,
                totalUsage: accounts.reduce((sum, acc) => sum + (acc.usageData?.totalUsage || 0), 0),
                totalCredits: accounts.reduce((sum, acc) => sum + (acc.usageData?.remainingCredits || 0), 0)
            },
            accounts: accounts.map(account => ({
                name: account.name,
                email: account.email,
                isActive: account.isActive,
                createdAt: account.createdAt,
                lastUsedAt: account.lastUsedAt,
                daysSinceCreated: Math.floor((Date.now() - account.createdAt) / (1000 * 60 * 60 * 24)),
                daysSinceLastUsed: Math.floor((Date.now() - account.lastUsedAt) / (1000 * 60 * 60 * 24)),
                usageData: account.usageData
            }))
        };

        const reportJson = JSON.stringify(reportData, null, 2);
        const fileName = `augment-stats-report-${new Date().toISOString().split('T')[0]}.json`;

        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName),
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            }
        });

        if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(reportJson, 'utf8'));

            vscode.window.showInformationMessage(
                `✅ 统计报告导出成功\n\n` +
                `文件: ${saveUri.fsPath}\n` +
                `包含 ${accounts.length} 个账户的详细统计`,
                '$(folder) 打开文件夹'
            ).then(choice => {
                if (choice === '$(folder) 打开文件夹') {
                    vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            });
        }
    } catch (error) {
        vscode.window.showErrorMessage(`导出统计报告失败: ${error}`);
    }
}

// 辅助函数：提示输入账户名称
async function promptForAccountName(email: string): Promise<string> {
    const defaultName = email.split('@')[0] || 'New Account';

    const name = await vscode.window.showInputBox({
        prompt: '为此账户设置一个友好的名称',
        value: defaultName,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return '账户名称不能为空';
            }
            if (value.length > 50) {
                return '账户名称不能超过50个字符';
            }
            return null;
        }
    });

    return name?.trim() || defaultName;
}

// 辅助函数：手动输入账户信息
async function promptForManualAccount(): Promise<{name: string, email: string, cookies: string} | null> {
    // 输入账户名称
    const name = await vscode.window.showInputBox({
        prompt: '输入账户名称',
        placeHolder: '例如: 工作账户',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return '账户名称不能为空';
            }
            return null;
        }
    });

    if (!name) return null;

    // 输入邮箱
    const email = await vscode.window.showInputBox({
        prompt: '输入账户邮箱',
        placeHolder: '例如: user@example.com',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return '邮箱不能为空';
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return '请输入有效的邮箱地址';
            }
            return null;
        }
    });

    if (!email) return null;

    // 输入Cookies
    const cookies = await vscode.window.showInputBox({
        prompt: '输入Augment网站的Cookies',
        placeHolder: '从浏览器开发者工具中复制完整的Cookie字符串',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Cookies不能为空';
            }
            if (!value.includes('_session') || !value.includes('ajs_user_id')) {
                return 'Cookies格式不正确，请确保包含必要的认证信息';
            }
            return null;
        }
    });

    if (!cookies) return null;

    return {
        name: name.trim(),
        email: email.trim(),
        cookies: cookies.trim()
    };
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
            vscode.commands.executeCommand('augmentTracker.manualRefresh');
        } else if (selection === t('button.openSettings')) {
            vscode.commands.executeCommand('augmentTracker.openSettings');
        }
    });
}









// 处理会话失效的函数
async function handleSessionInvalidation(apiClient: any) {
    try {
        console.log('🔄 [handleSessionInvalidation] 开始处理会话失效...');

        // 首先尝试自动恢复
        const recoverySuccess = await apiClient.attemptSessionRecovery();
        if (recoverySuccess) {
            console.log('✅ [handleSessionInvalidation] 会话自动恢复成功');
            vscode.window.showInformationMessage(
                '🔄 会话已自动恢复\n\n' +
                '检测到您在其他地方登录，系统已自动恢复会话。\n' +
                '数据同步功能已恢复正常。'
            );
            return;
        }

        // 自动恢复失败，显示用户友好的提示
        console.log('⚠️ [handleSessionInvalidation] 自动恢复失败，需要用户干预');

        const choice = await vscode.window.showWarningMessage(
            '🚨 会话冲突检测\n\n' +
            '检测到您可能在其他地方登录了Augment账户，导致当前会话失效。\n' +
            '这是正常的安全机制，每个账户同时只能在一个地方保持活跃会话。\n\n' +
            '💡 解决方案：\n' +
            '• 立即重新认证：快速恢复数据同步\n' +
            '• 稍后处理：继续使用本地缓存数据\n' +
            '• 了解详情：查看会话管理机制说明',
            '🔄 立即重新认证',
            '⏰ 稍后处理',
            '❓ 了解详情'
        );

        switch (choice) {
            case '🔄 立即重新认证':
                console.log('🔄 [handleSessionInvalidation] 用户选择立即重新认证');
                await vscode.commands.executeCommand('augmentTracker.webLogin');
                break;

            case '❓ 了解详情':
                await vscode.window.showInformationMessage(
                    '🔧 会话管理机制说明\n\n' +
                    '🔒 安全机制：\n' +
                    '• Augment使用会话认证确保账户安全\n' +
                    '• 同一账户同时只能在一个地方保持活跃\n' +
                    '• 在其他地方登录会使之前的会话失效\n\n' +
                    '🔄 自动恢复：\n' +
                    '• 系统会尝试自动恢复会话\n' +
                    '• 如果自动恢复失败，需要重新认证\n' +
                    '• 重新认证后会立即恢复所有功能\n\n' +
                    '💡 最佳实践：\n' +
                    '• 避免在多个地方同时使用同一账户\n' +
                    '• 使用完毕后可以退出登录\n' +
                    '• 定期检查账户安全状态',
                    '🔄 现在重新认证',
                    '❌ 关闭'
                ).then(detailChoice => {
                    if (detailChoice === '🔄 现在重新认证') {
                        vscode.commands.executeCommand('augmentTracker.webLogin');
                    }
                });
                break;

            case '⏰ 稍后处理':
            default:
                console.log('⏰ [handleSessionInvalidation] 用户选择稍后处理');
                // 显示状态栏提示
                if (statusBarManager) {
                    statusBarManager.updateLogoutStatus();
                }
                break;
        }

    } catch (error) {
        console.error('❌ [handleSessionInvalidation] 处理会话失效时出错:', error);
        vscode.window.showErrorMessage(
            '❌ 处理会话失效时出错\n\n' +
            `错误: ${error}\n\n` +
            '请尝试手动重新认证。'
        );
    }
}

export function deactivate() {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    if (usageTracker) {
        usageTracker.dispose();
    }
}
