import * as vscode from 'vscode';

export class NativeManagementPanel {
    private static context: vscode.ExtensionContext;
    private static apiClient: any;
    private static accountManager: any;
    private static usageTracker: any;
    private static statusBarManager: any;

    public static initialize(context: vscode.ExtensionContext, apiClient: any, accountManager: any, usageTracker: any, statusBarManager: any) {
        this.context = context;
        this.apiClient = apiClient;
        this.accountManager = accountManager;
        this.usageTracker = usageTracker;
        this.statusBarManager = statusBarManager;
    }
    
    public static async showMainMenu() {
        const options = [
            {
                label: '📊 概览',
                description: '查看认证状态和使用统计',
                action: 'overview'
            },
            {
                label: '👥 团队管理',
                description: '邀请团队成员和自动接受邀请',
                action: 'team'
            },
            {
                label: '👤 账户管理',
                description: '管理多个Augment账户',
                action: 'account'
            },
            {
                label: '⚙️ 设置',
                description: '认证设置和系统配置',
                action: 'settings'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '选择要管理的功能',
            title: '🚀 Augment 管理中心'
        });

        if (selected) {
            switch (selected.action) {
                case 'overview':
                    await this.showOverview();
                    break;
                case 'team':
                    await this.showTeamManagement();
                    break;
                case 'account':
                    await this.showAccountManagement();
                    break;
                case 'settings':
                    await this.showSettings();
                    break;
            }
        }
    }

    private static async showOverview() {
        // 获取当前状态信息
        const hasAuth = this.apiClient ? this.apiClient.hasAnyAuth() : false;
        const currentUsage = this.usageTracker ? this.usageTracker.getCurrentUsage() : 0;
        const currentLimit = this.usageTracker ? this.usageTracker.getCurrentLimit() : 0;
        const hasRealData = this.usageTracker ? this.usageTracker.hasRealUsageData() : false;
        const percentage = currentLimit > 0 ? Math.round((currentUsage / currentLimit) * 100) : 0;

        // 获取账户信息
        let accountInfo = '';
        if (this.accountManager) {
            try {
                const accounts = await this.accountManager.getAllAccounts();
                const currentAccount = await this.accountManager.getCurrentAccount();
                accountInfo = `账户: ${accounts.length}个 | 当前: ${currentAccount?.name || '无'}`;
            } catch (error) {
                accountInfo = '账户信息获取失败';
            }
        }

        const statusInfo = hasAuth ? '✅ 已认证' : '❌ 未认证';
        const usageInfo = `使用: ${currentUsage}/${currentLimit} (${percentage}%)`;
        const dataSource = hasRealData ? '实时数据' : '本地数据';

        const options = [
            {
                label: '📊 当前状态',
                description: `${statusInfo} | ${usageInfo} | ${dataSource}`,
                action: 'showStatus'
            },
            {
                label: '👤 账户信息',
                description: accountInfo,
                action: 'showAccountInfo'
            },
            {
                label: '🔄 刷新状态',
                description: '检查认证状态和更新数据',
                action: 'refreshStatus'
            },
            {
                label: '📊 查看详细统计',
                description: '显示详细的使用统计信息',
                action: 'showDetails'
            },
            {
                label: '🔄 手动刷新数据',
                description: '从服务器获取最新使用数据',
                action: 'manualRefresh'
            },
            {
                label: '🗑️ 重置统计',
                description: '重置本地使用统计数据',
                action: 'resetUsage'
            },
            {
                label: '← 返回主菜单',
                description: '',
                action: 'back'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '选择操作',
            title: '📊 概览管理'
        });

        if (selected) {
            switch (selected.action) {
                case 'showStatus':
                    await this.showDetailedStatus();
                    break;
                case 'showAccountInfo':
                    await this.showDetailedAccountInfo();
                    break;
                case 'refreshStatus':
                    vscode.commands.executeCommand('augmentTracker.checkAuthStatus');
                    await this.showOverview(); // 返回概览页面
                    break;
                case 'showDetails':
                    vscode.commands.executeCommand('augmentTracker.showDetails');
                    await this.showOverview();
                    break;
                case 'manualRefresh':
                    vscode.commands.executeCommand('augmentTracker.manualRefresh');
                    await this.showOverview();
                    break;
                case 'resetUsage':
                    const confirm = await vscode.window.showWarningMessage(
                        '确定要重置使用统计吗？此操作不可撤销。',
                        '确定',
                        '取消'
                    );
                    if (confirm === '确定') {
                        vscode.commands.executeCommand('augmentTracker.resetUsage');
                    }
                    await this.showOverview();
                    break;
                case 'back':
                    await this.showMainMenu();
                    break;
            }
        }
    }

    private static async showTeamManagement() {
        const options = [
            {
                label: '📧 邀请团队成员',
                description: '批量邀请用户加入团队',
                action: 'invite'
            },
            {
                label: '🤖 自动接受邀请',
                description: '监控邮箱并自动接受邀请',
                action: 'autoAccept'
            },
            {
                label: '← 返回主菜单',
                description: '',
                action: 'back'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '选择团队管理操作',
            title: '👥 团队管理'
        });

        if (selected) {
            switch (selected.action) {
                case 'invite':
                    await this.handleTeamInvite();
                    break;
                case 'autoAccept':
                    await this.handleAutoAccept();
                    break;
                case 'back':
                    await this.showMainMenu();
                    break;
            }
        }
    }

    private static async showAccountManagement() {
        const options = [
            {
                label: '📋 查看账户列表',
                description: '显示所有已添加的账户',
                action: 'list'
            },
            {
                label: '➕ 添加账户',
                description: '添加新的Augment账户',
                action: 'add'
            },
            {
                label: '🔄 切换账户',
                description: '切换到其他账户',
                action: 'switch'
            },
            {
                label: '🗑️ 删除账户',
                description: '删除不需要的账户',
                action: 'remove'
            },
            {
                label: '← 返回主菜单',
                description: '',
                action: 'back'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '选择账户管理操作',
            title: '👤 账户管理'
        });

        if (selected) {
            switch (selected.action) {
                case 'list':
                    vscode.commands.executeCommand('augmentTracker.listAccounts');
                    break;
                case 'add':
                    vscode.commands.executeCommand('augmentTracker.addAccount');
                    break;
                case 'switch':
                    vscode.commands.executeCommand('augmentTracker.switchAccount');
                    break;
                case 'remove':
                    vscode.commands.executeCommand('augmentTracker.removeAccount');
                    break;
                case 'back':
                    await this.showMainMenu();
                    break;
            }
        }
    }

    private static async showSettings() {
        const options = [
            {
                label: '🌐 浏览器登录',
                description: '通过浏览器登录Augment账户',
                action: 'webLogin'
            },
            {
                label: '🍪 配置Cookie',
                description: '手动配置认证Cookie',
                action: 'setupCookies'
            },
            {
                label: '🚪 退出登录',
                description: '退出当前账户',
                action: 'logout'
            },
            {
                label: '🌍 设置语言',
                description: '更改界面语言',
                action: 'setLanguage'
            },
            {
                label: '⚙️ 打开设置',
                description: '打开扩展设置页面',
                action: 'openSettings'
            },
            {
                label: '← 返回主菜单',
                description: '',
                action: 'back'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '选择设置操作',
            title: '⚙️ 设置'
        });

        if (selected) {
            switch (selected.action) {
                case 'webLogin':
                    vscode.commands.executeCommand('augmentTracker.webLogin');
                    break;
                case 'setupCookies':
                    vscode.commands.executeCommand('augmentTracker.setupCookies');
                    break;
                case 'logout':
                    vscode.commands.executeCommand('augmentTracker.logout');
                    break;
                case 'setLanguage':
                    vscode.commands.executeCommand('augmentTracker.setLanguage');
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('augmentTracker.openSettings');
                    break;
                case 'back':
                    await this.showMainMenu();
                    break;
            }
        }
    }

    private static async handleTeamInvite() {
        // 首先检查认证状态
        if (!this.apiClient || !this.apiClient.hasAnyAuth()) {
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
    }

    private static async handleAutoAccept() {
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
    }

    private static async showDetailedStatus() {
        const hasAuth = this.apiClient ? this.apiClient.hasAnyAuth() : false;
        const currentUsage = this.usageTracker ? this.usageTracker.getCurrentUsage() : 0;
        const currentLimit = this.usageTracker ? this.usageTracker.getCurrentLimit() : 0;
        const hasRealData = this.usageTracker ? this.usageTracker.hasRealUsageData() : false;
        const percentage = currentLimit > 0 ? Math.round((currentUsage / currentLimit) * 100) : 0;

        let statusMessage = '📊 Augment 状态详情\n\n';
        statusMessage += `🔐 认证状态: ${hasAuth ? '✅ 已认证' : '❌ 未认证'}\n`;
        statusMessage += `📈 使用情况: ${currentUsage}/${currentLimit} (${percentage}%)\n`;
        statusMessage += `📊 数据来源: ${hasRealData ? '✅ 实时数据' : '⚠️ 本地数据'}\n`;
        statusMessage += `⏰ 更新时间: ${new Date().toLocaleString()}\n\n`;

        if (!hasAuth) {
            statusMessage += '💡 提示: 请先配置认证信息以获取实时数据';
        } else if (!hasRealData) {
            statusMessage += '💡 提示: 点击"手动刷新数据"获取最新使用统计';
        }

        const actions = hasAuth ? ['🔄 刷新数据', '⚙️ 管理设置', '确定'] : ['🌐 立即配置', '确定'];

        const result = await vscode.window.showInformationMessage(statusMessage, ...actions);

        if (result === '🔄 刷新数据') {
            vscode.commands.executeCommand('augmentTracker.manualRefresh');
        } else if (result === '🌐 立即配置') {
            vscode.commands.executeCommand('augmentTracker.webLogin');
        } else if (result === '⚙️ 管理设置') {
            await this.showSettings();
        }

        await this.showOverview();
    }

    private static async showDetailedAccountInfo() {
        if (!this.accountManager) {
            vscode.window.showErrorMessage('账户管理器未初始化');
            await this.showOverview();
            return;
        }

        try {
            const accounts = await this.accountManager.getAllAccounts();
            const currentAccount = await this.accountManager.getCurrentAccount();

            let message = '👤 账户信息详情\n\n';
            message += `📊 总账户数: ${accounts.length}\n`;
            message += `✅ 当前账户: ${currentAccount?.name || '无'}\n`;
            message += `📧 当前邮箱: ${currentAccount?.email || '无'}\n\n`;

            if (accounts.length > 0) {
                message += '📋 所有账户:\n';
                accounts.forEach((account: any, index: number) => {
                    const status = account.isActive ? '✅' : '⭕';
                    const lastUsed = new Date(account.lastUsedAt).toLocaleDateString();
                    message += `${index + 1}. ${status} ${account.name} (${account.email}) - 最后使用: ${lastUsed}\n`;
                });
            } else {
                message += '📝 暂无账户，请先添加一个账户';
            }

            const actions = accounts.length > 0 ?
                ['🔄 切换账户', '➕ 添加账户', '⚙️ 管理账户', '确定'] :
                ['➕ 添加账户', '确定'];

            const result = await vscode.window.showInformationMessage(message, ...actions);

            if (result === '🔄 切换账户') {
                vscode.commands.executeCommand('augmentTracker.switchAccount');
            } else if (result === '➕ 添加账户') {
                vscode.commands.executeCommand('augmentTracker.addAccount');
            } else if (result === '⚙️ 管理账户') {
                await this.showAccountManagement();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`获取账户信息失败: ${error}`);
        }

        await this.showOverview();
    }
}
