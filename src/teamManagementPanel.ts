import * as vscode from 'vscode';
import { AugmentApiClient } from './augmentApi';

export class TeamManagementPanel {
    public static currentPanel: TeamManagementPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _apiClient: AugmentApiClient;
    private _accountManager: any;
    private _usageTracker: any;
    private _statusBarManager: any;

    public static createOrShow(extensionUri: vscode.Uri, apiClient: AugmentApiClient, accountManager?: any, usageTracker?: any, statusBarManager?: any) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已经有面板，显示它
        if (TeamManagementPanel.currentPanel) {
            TeamManagementPanel.currentPanel._panel.reveal(column);
            return;
        }

        // 创建新面板
        const panel = vscode.window.createWebviewPanel(
            'augmentManagement',
            '🚀 Augment 管理中心',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out', 'compiled')
                ]
            }
        );

        TeamManagementPanel.currentPanel = new TeamManagementPanel(panel, extensionUri, apiClient, accountManager, usageTracker, statusBarManager);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, apiClient: AugmentApiClient, accountManager?: any, usageTracker?: any, statusBarManager?: any) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._apiClient = apiClient;
        this._accountManager = accountManager;
        this._usageTracker = usageTracker;
        this._statusBarManager = statusBarManager;

        // 设置初始HTML内容
        this._update();

        // 监听面板关闭事件
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // 处理来自WebView的消息
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'inviteTeamMembers':
                        await this.handleInviteTeamMembers(message.emails);
                        break;
                    case 'autoAcceptInvitations':
                        await this.handleAutoAcceptInvitations(message.email, message.epin);
                        break;
                    case 'refreshStatus':
                        await this.handleRefreshStatus();
                        break;
                    case 'resetUsage':
                        await this.handleResetUsage();
                        break;
                    case 'manualRefresh':
                        await this.handleManualRefresh();
                        break;
                    case 'logout':
                        await this.handleLogout();
                        break;
                    case 'setupCookies':
                        await this.handleSetupCookies();
                        break;
                    case 'webLogin':
                        await this.handleWebLogin();
                        break;
                    case 'manageAccounts':
                        await this.handleManageAccounts();
                        break;
                    case 'switchAccount':
                        await this.handleSwitchAccount();
                        break;
                    case 'addAccount':
                        await this.handleAddAccount();
                        break;
                    case 'showInfo':
                        vscode.window.showInformationMessage(message.text);
                        break;
                    case 'showError':
                        vscode.window.showErrorMessage(message.text);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async handleInviteTeamMembers(emails: string[]) {
        try {
            const result = await this._apiClient.inviteTeamMembers(emails);
            
            this._panel.webview.postMessage({
                command: 'inviteResult',
                success: result.success,
                data: result.data,
                error: result.error
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'inviteResult',
                success: false,
                error: `邀请失败: ${error}`
            });
        }
    }

    private async handleAutoAcceptInvitations(email: string, epin: string) {
        try {
            const result = await this._apiClient.monitorAndAcceptInvitations(email, epin);
            
            this._panel.webview.postMessage({
                command: 'autoAcceptResult',
                success: result.success,
                data: result.data,
                error: result.error
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'autoAcceptResult',
                success: false,
                error: `自动接受失败: ${error}`
            });
        }
    }

    private async handleRefreshStatus() {
        try {
            // 获取认证状态
            const hasAuth = this._apiClient.hasAnyAuth();

            // 获取使用数据
            let usageData = null;
            let userInfo = null;

            if (hasAuth && this._usageTracker) {
                usageData = {
                    currentUsage: this._usageTracker.getCurrentUsage(),
                    currentLimit: this._usageTracker.getCurrentLimit(),
                    hasRealData: this._usageTracker.hasRealUsageData()
                };
            }

            // 获取账户信息
            let accountInfo = null;
            if (this._accountManager) {
                const accounts = await this._accountManager.getAllAccounts();
                const currentAccount = await this._accountManager.getCurrentAccount();
                accountInfo = {
                    totalAccounts: accounts.length,
                    currentAccount: currentAccount?.name || null,
                    currentEmail: currentAccount?.email || null
                };
            }

            this._panel.webview.postMessage({
                command: 'statusUpdate',
                hasAuth: hasAuth,
                usageData: usageData,
                accountInfo: accountInfo,
                userInfo: userInfo,
                timestamp: new Date().toLocaleString()
            });
        } catch (error) {
            console.error('刷新状态失败:', error);
            this._panel.webview.postMessage({
                command: 'statusUpdate',
                hasAuth: false,
                error: `状态刷新失败: ${error}`,
                timestamp: new Date().toLocaleString()
            });
        }
    }

    private async handleResetUsage() {
        try {
            if (this._usageTracker) {
                this._usageTracker.resetUsage();
                this._panel.webview.postMessage({
                    command: 'operationResult',
                    operation: 'resetUsage',
                    success: true,
                    message: '使用统计已重置'
                });
                // 刷新状态
                await this.handleRefreshStatus();
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'resetUsage',
                success: false,
                error: `重置失败: ${error}`
            });
        }
    }

    private async handleManualRefresh() {
        try {
            if (!this._apiClient || !this._apiClient.hasAnyAuth()) {
                this._panel.webview.postMessage({
                    command: 'operationResult',
                    operation: 'manualRefresh',
                    success: false,
                    error: '未配置认证信息，请先登录'
                });
                return;
            }

            // 获取使用数据和用户信息
            const [creditsResult, userResult] = await Promise.all([
                this._apiClient.getCreditsInfo(),
                this._apiClient.getUserInfo()
            ]);

            if (creditsResult.success) {
                const usageData = await this._apiClient.parseUsageResponse(creditsResult);
                if (usageData && this._usageTracker) {
                    await this._usageTracker.updateWithRealData(usageData);

                    // 更新状态栏
                    if (this._statusBarManager) {
                        if (userResult.success) {
                            const userInfo = await this._apiClient.parseUserResponse(userResult);
                            this._statusBarManager.updateUserInfo(userInfo);
                        }
                        this._statusBarManager.updateDisplay();
                    }

                    this._panel.webview.postMessage({
                        command: 'operationResult',
                        operation: 'manualRefresh',
                        success: true,
                        message: '数据刷新成功'
                    });

                    // 刷新状态
                    await this.handleRefreshStatus();
                } else {
                    this._panel.webview.postMessage({
                        command: 'operationResult',
                        operation: 'manualRefresh',
                        success: false,
                        error: '数据解析失败'
                    });
                }
            } else {
                this._panel.webview.postMessage({
                    command: 'operationResult',
                    operation: 'manualRefresh',
                    success: false,
                    error: `数据获取失败: ${creditsResult.error}`
                });
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'manualRefresh',
                success: false,
                error: `刷新失败: ${error}`
            });
        }
    }

    private async handleLogout() {
        try {
            // 执行登出逻辑
            vscode.commands.executeCommand('augmentTracker.logout');

            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'logout',
                success: true,
                message: '已成功退出登录'
            });

            // 刷新状态
            setTimeout(() => this.handleRefreshStatus(), 1000);
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'logout',
                success: false,
                error: `退出登录失败: ${error}`
            });
        }
    }

    private async handleSetupCookies() {
        try {
            vscode.commands.executeCommand('augmentTracker.setupCookies');
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'setupCookies',
                success: true,
                message: 'Cookie配置窗口已打开'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'setupCookies',
                success: false,
                error: `打开配置失败: ${error}`
            });
        }
    }

    private async handleWebLogin() {
        try {
            vscode.commands.executeCommand('augmentTracker.webLogin');
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'webLogin',
                success: true,
                message: '浏览器登录已启动'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'webLogin',
                success: false,
                error: `启动登录失败: ${error}`
            });
        }
    }

    private async handleManageAccounts() {
        try {
            if (!this._accountManager) {
                this._panel.webview.postMessage({
                    command: 'accountsData',
                    accounts: [],
                    currentAccount: null,
                    error: '账户管理器未初始化'
                });
                return;
            }

            const accounts = await this._accountManager.getAllAccounts();
            const currentAccount = await this._accountManager.getCurrentAccount();

            this._panel.webview.postMessage({
                command: 'accountsData',
                accounts: accounts.map((acc: any) => ({
                    id: acc.id,
                    name: acc.name,
                    email: acc.email,
                    isActive: acc.isActive,
                    createdAt: acc.createdAt,
                    lastUsedAt: acc.lastUsedAt
                })),
                currentAccount: currentAccount
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'accountsData',
                accounts: [],
                currentAccount: null,
                error: `获取账户信息失败: ${error}`
            });
        }
    }

    private async handleSwitchAccount() {
        try {
            vscode.commands.executeCommand('augmentTracker.switchAccount');
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'switchAccount',
                success: true,
                message: '账户切换窗口已打开'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'switchAccount',
                success: false,
                error: `切换账户失败: ${error}`
            });
        }
    }

    private async handleAddAccount() {
        try {
            vscode.commands.executeCommand('augmentTracker.addAccount');
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'addAccount',
                success: true,
                message: '添加账户窗口已打开'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'operationResult',
                operation: 'addAccount',
                success: false,
                error: `添加账户失败: ${error}`
            });
        }
    }

    public dispose() {
        TeamManagementPanel.currentPanel = undefined;

        // 清理资源
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = '🚀 Augment 管理中心';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // 获取样式和脚本的URI
        const styleResetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
        );
        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
        );

        // 使用nonce来确保安全
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <title>Augment 管理中心</title>
                <style>
                    .container {
                        padding: 20px;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .section {
                        margin-bottom: 30px;
                        padding: 20px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 8px;
                        background: var(--vscode-editor-background);
                    }
                    .section h2 {
                        margin-top: 0;
                        color: var(--vscode-foreground);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .form-group {
                        margin-bottom: 15px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                        color: var(--vscode-foreground);
                    }
                    .form-group input, .form-group textarea {
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                    }
                    .form-group textarea {
                        resize: vertical;
                        min-height: 80px;
                    }
                    .button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        margin-right: 10px;
                        margin-bottom: 10px;
                    }
                    .button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .button.secondary {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    .button.secondary:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .status {
                        padding: 10px;
                        border-radius: 4px;
                        margin-bottom: 15px;
                    }
                    .status.success {
                        background: var(--vscode-testing-iconPassed);
                        color: white;
                    }
                    .status.error {
                        background: var(--vscode-testing-iconFailed);
                        color: white;
                    }
                    .status.info {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .loading {
                        display: none;
                        color: var(--vscode-foreground);
                    }
                    .result {
                        margin-top: 15px;
                        padding: 10px;
                        border-radius: 4px;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .help-text {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-top: 5px;
                    }
                    .tabs {
                        display: flex;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        margin-bottom: 20px;
                    }
                    .tab {
                        padding: 12px 20px;
                        cursor: pointer;
                        border: none;
                        background: transparent;
                        color: var(--vscode-foreground);
                        border-bottom: 2px solid transparent;
                        transition: all 0.2s ease;
                    }
                    .tab:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .tab.active {
                        border-bottom-color: var(--vscode-button-background);
                        color: var(--vscode-button-background);
                        font-weight: bold;
                    }
                    .tab-content {
                        display: none;
                    }
                    .tab-content.active {
                        display: block;
                    }
                    .stats {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 15px;
                        margin-top: 15px;
                    }
                    .stat-item {
                        text-align: center;
                        padding: 15px;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                    }
                    .stat-number {
                        font-size: 24px;
                        font-weight: bold;
                        color: var(--vscode-button-background);
                    }
                    .stat-label {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚀 Augment 管理中心</h1>

                    <!-- 标签页导航 -->
                    <div class="tabs">
                        <button class="tab active" data-tab="overview">📊 概览</button>
                        <button class="tab" data-tab="team">👥 团队管理</button>
                        <button class="tab" data-tab="account">👤 账户管理</button>
                        <button class="tab" data-tab="settings">⚙️ 设置</button>
                    </div>

                    <!-- 概览标签页 -->
                    <div id="overview" class="tab-content active">
                        <!-- 状态栏 -->
                    <div class="section">
                        <h2>📊 状态信息</h2>
                        <div id="authStatus" class="status info">
                            <span id="authStatusText">检查认证状态中...</span>
                            <button id="refreshStatus" class="button secondary">🔄 刷新状态</button>
                        </div>
                        <div class="help-text">
                            认证状态决定了您是否可以使用管理功能。如果未认证，请先配置Augment账户。
                        </div>
                    </div>

                    <!-- 使用统计 -->
                    <div class="section">
                        <h2>📈 使用统计</h2>
                        <div id="usageStats" class="stats">
                            <div class="stat-item">
                                <div class="stat-number" id="currentUsage">--</div>
                                <div class="stat-label">当前使用</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number" id="currentLimit">--</div>
                                <div class="stat-label">使用限制</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number" id="usagePercent">--%</div>
                                <div class="stat-label">使用率</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number" id="dataSource">--</div>
                                <div class="stat-label">数据来源</div>
                            </div>
                        </div>
                        <div style="margin-top: 15px;">
                            <button id="manualRefresh" class="button">🔄 刷新数据</button>
                            <button id="resetUsage" class="button secondary">🗑️ 重置统计</button>
                        </div>
                        <div class="help-text">
                            使用统计显示您的Augment使用情况。点击"刷新数据"获取最新信息。
                        </div>
                    </div>

                    <!-- 账户信息 -->
                    <div class="section">
                        <h2>👤 账户信息</h2>
                        <div id="accountInfo">
                            <div class="stats">
                                <div class="stat-item">
                                    <div class="stat-number" id="totalAccounts">--</div>
                                    <div class="stat-label">总账户数</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number" id="currentAccountName">--</div>
                                    <div class="stat-label">当前账户</div>
                                </div>
                            </div>
                            <div style="margin-top: 15px;">
                                <button id="switchAccount" class="button">🔄 切换账户</button>
                                <button id="addAccount" class="button secondary">➕ 添加账户</button>
                                <button id="manageAccounts" class="button secondary">⚙️ 管理账户</button>
                            </div>
                        </div>
                        <div class="help-text">
                            管理您的多个Augment账户，支持快速切换和添加新账户。
                        </div>
                    </div>

                    <!-- 快速操作 -->
                    <div class="section">
                        <h2>⚡ 快速操作</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            <button id="webLogin" class="button">🌐 浏览器登录</button>
                            <button id="setupCookies" class="button">🍪 配置Cookie</button>
                            <button id="logout" class="button">🚪 退出登录</button>
                            <button class="button secondary" data-tab="team">👥 团队管理</button>
                        </div>
                        <div class="help-text">
                            常用操作的快速入口，方便您快速完成各种任务。
                        </div>
                    </div>
                </div>

                    <!-- 团队管理标签页 -->
                    <div id="team" class="tab-content">
                        <!-- 团队邀请 -->
                    <div class="section">
                        <h2>📧 邀请团队成员</h2>
                        <div class="form-group">
                            <label for="inviteEmails">邮箱地址</label>
                            <textarea id="inviteEmails" placeholder="输入要邀请的邮箱地址，每行一个或用逗号分隔&#10;例如：&#10;user1@example.com&#10;user2@example.com, user3@example.com"></textarea>
                            <div class="help-text">
                                支持多种格式：每行一个邮箱，或用逗号分隔。一次最多邀请10个用户。
                            </div>
                        </div>
                        <button id="inviteTeamMembers" class="button">📧 发送邀请</button>
                        <div id="inviteLoading" class="loading">正在发送邀请...</div>
                        <div id="inviteResult" class="result" style="display: none;"></div>
                    </div>

                    <!-- 自动接受邀请 -->
                    <div class="section">
                        <h2>🤖 自动接受邀请</h2>
                        <div class="form-group">
                            <label for="monitorEmail">监控邮箱</label>
                            <input type="email" id="monitorEmail" placeholder="例如: user@akapril.in">
                            <div class="help-text">
                                支持TempMail Plus等临时邮箱服务。系统将自动监控此邮箱的Augment团队邀请。
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="emailPin">PIN码（可选）</label>
                            <input type="text" id="emailPin" placeholder="某些邮箱服务需要PIN码">
                            <div class="help-text">
                                如果邮箱服务需要PIN码验证，请在此输入。大多数情况下可以留空。
                            </div>
                        </div>
                        <button id="autoAcceptInvitations" class="button">🤖 开始监控</button>
                        <div id="autoAcceptLoading" class="loading">正在监控邮箱...</div>
                        <div id="autoAcceptResult" class="result" style="display: none;"></div>
                    </div>

                    <!-- 使用说明 -->
                    <div class="section">
                        <h2>📖 使用说明</h2>
                        <div style="line-height: 1.6;">
                            <h3>团队邀请流程：</h3>
                            <ol>
                                <li><strong>发送邀请</strong>：在上方输入要邀请的邮箱地址，点击"发送邀请"</li>
                                <li><strong>监控邮箱</strong>：在"自动接受邀请"部分输入接收邀请的邮箱</li>
                                <li><strong>自动处理</strong>：系统将自动检测并接受Augment团队邀请</li>
                            </ol>
                            
                            <h3>支持的邮箱服务：</h3>
                            <ul>
                                <li><strong>TempMail Plus</strong>：@akapril.in, @mailto.plus</li>
                                <li><strong>其他</strong>：任何支持相同API格式的临时邮箱服务</li>
                            </ul>
                            
                            <h3>注意事项：</h3>
                            <ul>
                                <li>确保网络连接稳定</li>
                                <li>邀请链接可能有时效限制</li>
                                <li>避免过于频繁的操作</li>
                                <li>如遇问题，请检查认证状态</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- 账户管理标签页 -->
                <div id="account" class="tab-content">
                    <div class="section">
                        <h2>👤 账户管理</h2>
                        <div id="accountsList">
                            <p>加载账户信息中...</p>
                        </div>
                        <div style="margin-top: 15px;">
                            <button id="addAccount2" class="button">➕ 添加账户</button>
                            <button id="refreshAccounts" class="button secondary">🔄 刷新列表</button>
                        </div>
                    </div>
                </div>

                <!-- 设置标签页 -->
                <div id="settings" class="tab-content">
                    <div class="section">
                        <h2>⚙️ 认证设置</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                            <div>
                                <h3>🌐 浏览器登录</h3>
                                <p>通过浏览器自动登录Augment账户</p>
                                <button id="webLogin2" class="button">启动浏览器登录</button>
                            </div>
                            <div>
                                <h3>🍪 Cookie配置</h3>
                                <p>手动配置认证Cookie信息</p>
                                <button id="setupCookies2" class="button">配置Cookie</button>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <h2>🔧 系统设置</h2>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="autoRefresh"> 自动刷新使用数据
                            </label>
                            <div class="help-text">启用后将定期自动刷新使用统计数据</div>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="showNotifications"> 显示通知
                            </label>
                            <div class="help-text">启用后将显示操作结果通知</div>
                        </div>
                        <button id="saveSettings" class="button">💾 保存设置</button>
                    </div>

                    <div class="section">
                        <h2>🚪 账户操作</h2>
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            <button id="logout2" class="button secondary">退出当前账户</button>
                            <button id="resetUsage2" class="button secondary">重置使用统计</button>
                        </div>
                        <div class="help-text">
                            注意：退出账户将清除当前认证信息，重置统计将清除本地使用数据。
                        </div>
                    </div>
                </div>
            </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();

                    // 使用事件监听器而不是onclick
                    document.addEventListener('DOMContentLoaded', function() {
                        // 绑定所有按钮事件
                        bindEvents();
                    });

                    function bindEvents() {
                        // 标签页切换
                        document.querySelectorAll('.tab').forEach(tab => {
                            tab.addEventListener('click', function() {
                                const tabName = this.getAttribute('data-tab');
                                switchTab(tabName);
                            });
                        });

                        // 绑定所有按钮
                        const buttons = {
                            'refreshStatus': refreshStatus,
                            'manualRefresh': manualRefresh,
                            'resetUsage': resetUsage,
                            'resetUsage2': resetUsage,
                            'logout': logout,
                            'logout2': logout,
                            'setupCookies': setupCookies,
                            'setupCookies2': setupCookies,
                            'webLogin': webLogin,
                            'webLogin2': webLogin,
                            'manageAccounts': manageAccounts,
                            'switchAccount': switchAccount,
                            'addAccount': addAccount,
                            'addAccount2': addAccount,
                            'refreshAccounts': refreshAccounts,
                            'saveSettings': saveSettings,
                            'inviteTeamMembers': inviteTeamMembers,
                            'autoAcceptInvitations': autoAcceptInvitations
                        };

                        Object.keys(buttons).forEach(id => {
                            const element = document.getElementById(id);
                            if (element) {
                                element.addEventListener('click', buttons[id]);
                            }
                        });

                        // 绑定标签页切换按钮
                        document.querySelectorAll('[data-tab]').forEach(element => {
                            element.addEventListener('click', function() {
                                const tabName = this.getAttribute('data-tab');
                                switchTab(tabName);
                            });
                        });
                    }

                    // 页面加载时刷新状态
                    window.addEventListener('load', () => {
                        refreshStatus();
                        refreshAccounts();
                    });

                    // 标签页切换
                    function switchTab(tabName) {
                        // 隐藏所有标签页内容
                        const tabContents = document.querySelectorAll('.tab-content');
                        tabContents.forEach(content => {
                            content.classList.remove('active');
                        });

                        // 移除所有标签的active类
                        const tabs = document.querySelectorAll('.tab');
                        tabs.forEach(tab => {
                            tab.classList.remove('active');
                        });

                        // 显示选中的标签页内容
                        const selectedContent = document.getElementById(tabName);
                        if (selectedContent) {
                            selectedContent.classList.add('active');
                        }

                        // 激活选中的标签
                        const selectedTab = document.querySelector('[onclick="switchTab(\'' + tabName + '\')"]');
                        if (selectedTab) {
                            selectedTab.classList.add('active');
                        }

                        // 如果切换到账户管理页面，刷新账户列表
                        if (tabName === 'account') {
                            refreshAccounts();
                        }
                    }

                    function refreshStatus() {
                        vscode.postMessage({
                            command: 'refreshStatus'
                        });
                    }

                    function manualRefresh() {
                        vscode.postMessage({
                            command: 'manualRefresh'
                        });
                    }

                    function resetUsage() {
                        if (confirm('确定要重置使用统计吗？此操作不可撤销。')) {
                            vscode.postMessage({
                                command: 'resetUsage'
                            });
                        }
                    }

                    function logout() {
                        if (confirm('确定要退出登录吗？')) {
                            vscode.postMessage({
                                command: 'logout'
                            });
                        }
                    }

                    function setupCookies() {
                        vscode.postMessage({
                            command: 'setupCookies'
                        });
                    }

                    function webLogin() {
                        vscode.postMessage({
                            command: 'webLogin'
                        });
                    }

                    function manageAccounts() {
                        vscode.postMessage({
                            command: 'manageAccounts'
                        });
                    }

                    function switchAccount() {
                        vscode.postMessage({
                            command: 'switchAccount'
                        });
                    }

                    function addAccount() {
                        vscode.postMessage({
                            command: 'addAccount'
                        });
                    }

                    function refreshAccounts() {
                        vscode.postMessage({
                            command: 'manageAccounts'
                        });
                    }

                    function saveSettings() {
                        const autoRefresh = document.getElementById('autoRefresh').checked;
                        const showNotifications = document.getElementById('showNotifications').checked;

                        // 这里可以添加保存设置的逻辑
                        showInfo('设置已保存');
                    }

                    function inviteTeamMembers() {
                        const emailsText = document.getElementById('inviteEmails').value.trim();
                        if (!emailsText) {
                            showError('请输入要邀请的邮箱地址');
                            return;
                        }

                        // 解析邮箱列表
                        const emails = parseEmails(emailsText);
                        if (emails.length === 0) {
                            showError('没有找到有效的邮箱地址');
                            return;
                        }

                        if (emails.length > 10) {
                            showError('一次最多只能邀请10个用户');
                            return;
                        }

                        // 验证邮箱格式
                        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                        const invalidEmails = emails.filter(email => !emailRegex.test(email));
                        if (invalidEmails.length > 0) {
                            showError('无效的邮箱地址: ' + invalidEmails.join(', '));
                            return;
                        }

                        showLoading('inviteLoading', true);
                        hideResult('inviteResult');

                        vscode.postMessage({
                            command: 'inviteTeamMembers',
                            emails: emails
                        });
                    }

                    function autoAcceptInvitations() {
                        const email = document.getElementById('monitorEmail').value.trim();
                        const epin = document.getElementById('emailPin').value.trim();

                        if (!email) {
                            showError('请输入要监控的邮箱地址');
                            return;
                        }

                        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                        if (!emailRegex.test(email)) {
                            showError('请输入有效的邮箱地址');
                            return;
                        }

                        showLoading('autoAcceptLoading', true);
                        hideResult('autoAcceptResult');

                        vscode.postMessage({
                            command: 'autoAcceptInvitations',
                            email: email,
                            epin: epin
                        });
                    }

                    function parseEmails(text) {
                        // 支持换行符和逗号分隔
                        return text
                            .split(/[\\n,]/)
                            .map(email => email.trim())
                            .filter(email => email.length > 0);
                    }

                    function showLoading(elementId, show) {
                        const element = document.getElementById(elementId);
                        element.style.display = show ? 'block' : 'none';
                    }

                    function showResult(elementId, content, isSuccess = true) {
                        const element = document.getElementById(elementId);
                        element.innerHTML = content;
                        element.className = 'result ' + (isSuccess ? 'success' : 'error');
                        element.style.display = 'block';
                    }

                    function hideResult(elementId) {
                        const element = document.getElementById(elementId);
                        element.style.display = 'none';
                    }

                    function showError(message) {
                        vscode.postMessage({
                            command: 'showError',
                            text: message
                        });
                    }

                    function showInfo(message) {
                        vscode.postMessage({
                            command: 'showInfo',
                            text: message
                        });
                    }

                    // 处理来自扩展的消息
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.command) {
                            case 'statusUpdate':
                                updateAuthStatus(message.hasAuth, message.timestamp);
                                updateUsageStats(message.usageData);
                                updateAccountInfo(message.accountInfo);
                                break;
                            case 'inviteResult':
                                handleInviteResult(message);
                                break;
                            case 'autoAcceptResult':
                                handleAutoAcceptResult(message);
                                break;
                            case 'operationResult':
                                handleOperationResult(message);
                                break;
                            case 'accountsData':
                                updateAccountsList(message);
                                break;
                        }
                    });

                    function updateAuthStatus(hasAuth, timestamp) {
                        const statusElement = document.getElementById('authStatus');
                        const statusText = document.getElementById('authStatusText');

                        if (hasAuth) {
                            statusElement.className = 'status success';
                            statusText.textContent = '✅ 已认证 - 可以使用所有功能 (更新时间: ' + timestamp + ')';
                        } else {
                            statusElement.className = 'status error';
                            statusText.textContent = '❌ 未认证 - 请先配置Augment账户 (更新时间: ' + timestamp + ')';
                        }
                    }

                    function updateUsageStats(usageData) {
                        if (usageData) {
                            document.getElementById('currentUsage').textContent = usageData.currentUsage || '--';
                            document.getElementById('currentLimit').textContent = usageData.currentLimit || '--';

                            const usage = parseInt(usageData.currentUsage) || 0;
                            const limit = parseInt(usageData.currentLimit) || 1;
                            const percent = Math.round((usage / limit) * 100);
                            document.getElementById('usagePercent').textContent = percent + '%';

                            document.getElementById('dataSource').textContent = usageData.hasRealData ? '实时' : '本地';
                        } else {
                            document.getElementById('currentUsage').textContent = '--';
                            document.getElementById('currentLimit').textContent = '--';
                            document.getElementById('usagePercent').textContent = '--%';
                            document.getElementById('dataSource').textContent = '--';
                        }
                    }

                    function updateAccountInfo(accountInfo) {
                        if (accountInfo) {
                            document.getElementById('totalAccounts').textContent = accountInfo.totalAccounts || '0';
                            document.getElementById('currentAccountName').textContent = accountInfo.currentAccount || '无';
                        } else {
                            document.getElementById('totalAccounts').textContent = '--';
                            document.getElementById('currentAccountName').textContent = '--';
                        }
                    }

                    function updateAccountsList(data) {
                        const accountsList = document.getElementById('accountsList');

                        if (data.error) {
                            accountsList.innerHTML = '<p style="color: var(--vscode-testing-iconFailed);">❌ ' + data.error + '</p>';
                            return;
                        }

                        if (!data.accounts || data.accounts.length === 0) {
                            accountsList.innerHTML = '<p>暂无账户，请先添加一个账户。</p>';
                            return;
                        }

                        let html = '<div class="stats">';
                        data.accounts.forEach(account => {
                            const isActive = account.isActive ? '✅' : '⭕';
                            const createdDate = new Date(account.createdAt).toLocaleDateString();
                            const lastUsedDate = new Date(account.lastUsedAt).toLocaleDateString();

                            html += '<div class="stat-item">' +
                                '<div style="text-align: left;">' +
                                '<div style="font-weight: bold;">' + isActive + ' ' + account.name + '</div>' +
                                '<div style="font-size: 12px; color: var(--vscode-descriptionForeground);">' +
                                '邮箱: ' + account.email + '<br>' +
                                '创建: ' + createdDate + '<br>' +
                                '最后使用: ' + lastUsedDate +
                                '</div>' +
                                '</div>' +
                                '</div>';
                        });
                        html += '</div>';

                        accountsList.innerHTML = html;
                    }

                    function handleOperationResult(result) {
                        if (result.success) {
                            showInfo(result.message || '操作成功');
                        } else {
                            showError(result.error || '操作失败');
                        }

                        // 某些操作后需要刷新状态
                        if (['resetUsage', 'manualRefresh', 'logout'].includes(result.operation)) {
                            setTimeout(() => refreshStatus(), 1000);
                        }
                    }

                    function handleInviteResult(result) {
                        showLoading('inviteLoading', false);
                        
                        if (result.success) {
                            const emails = result.data?.emails || [];
                            let content = '<h3>✅ 邀请发送成功！</h3>';
                            content += '<p>已向 ' + emails.length + ' 个邮箱地址发送邀请：</p>';
                            content += '<ul>';
                            emails.forEach(email => {
                                content += '<li>' + email + '</li>';
                            });
                            content += '</ul>';
                            content += '<p>受邀用户将收到邮件通知。</p>';
                            showResult('inviteResult', content, true);
                            
                            // 清空输入框
                            document.getElementById('inviteEmails').value = '';
                        } else {
                            let content = '<h3>❌ 邀请发送失败</h3>';
                            content += '<p>错误信息: ' + (result.error || '未知错误') + '</p>';
                            content += '<p>请检查网络连接和认证状态后重试。</p>';
                            showResult('inviteResult', content, false);
                        }
                    }

                    function handleAutoAcceptResult(result) {
                        showLoading('autoAcceptLoading', false);
                        
                        if (result.success) {
                            const data = result.data;
                            let content = '<h3>✅ 邮箱监控完成！</h3>';
                            
                            if (data) {
                                content += '<div class="stats">';
                                content += '<div class="stat-item"><div class="stat-number">' + (data.totalMails || 0) + '</div><div class="stat-label">总邮件数</div></div>';
                                content += '<div class="stat-item"><div class="stat-number">' + (data.invitationMails || 0) + '</div><div class="stat-label">邀请邮件</div></div>';
                                content += '<div class="stat-item"><div class="stat-number">' + (data.processedInvitations?.length || 0) + '</div><div class="stat-label">处理邀请</div></div>';
                                content += '<div class="stat-item"><div class="stat-number">' + (data.acceptedCount || 0) + '</div><div class="stat-label">成功接受</div></div>';
                                content += '</div>';
                                
                                if (data.processedInvitations && data.processedInvitations.length > 0) {
                                    content += '<h4>📋 处理详情：</h4>';
                                    content += '<ul>';
                                    data.processedInvitations.forEach((inv, index) => {
                                        content += '<li>';
                                        content += '<strong>' + (inv.subject || '无主题') + '</strong><br>';
                                        content += '来源: ' + inv.from + '<br>';
                                        content += '状态: ' + (inv.accepted ? '✅ 已接受' : '❌ 失败');
                                        if (inv.error) {
                                            content += '<br>错误: ' + inv.error;
                                        }
                                        content += '</li>';
                                    });
                                    content += '</ul>';
                                }
                            }
                            
                            showResult('autoAcceptResult', content, true);
                        } else {
                            let content = '<h3>❌ 邮箱监控失败</h3>';
                            content += '<p>错误信息: ' + (result.error || '未知错误') + '</p>';
                            content += '<p>请检查邮箱地址和网络连接后重试。</p>';
                            showResult('autoAcceptResult', content, false);
                        }
                    }
                </script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
