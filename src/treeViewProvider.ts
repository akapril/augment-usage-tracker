import * as vscode from 'vscode';

export class AugmentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly contextValue?: string,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly description?: string,
        public readonly tooltip?: string
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.contextValue = contextValue;
        this.iconPath = iconPath;
        this.description = description;
        this.tooltip = tooltip;
    }
}

export class AugmentTreeDataProvider implements vscode.TreeDataProvider<AugmentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AugmentTreeItem | undefined | null | void> = new vscode.EventEmitter<AugmentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AugmentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private apiClient: any;
    private accountManager: any;
    private usageTracker: any;
    private statusBarManager: any;

    constructor(apiClient: any, accountManager: any, usageTracker: any, statusBarManager: any) {
        this.apiClient = apiClient;
        this.accountManager = accountManager;
        this.usageTracker = usageTracker;
        this.statusBarManager = statusBarManager;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AugmentTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AugmentTreeItem): Promise<AugmentTreeItem[]> {
        if (!element) {
            // 根节点
            return this.getRootItems();
        }

        switch (element.contextValue) {
            case 'overview':
                return this.getOverviewItems();
            case 'team':
                return this.getTeamItems();
            case 'account':
                return this.getAccountItems();
            case 'settings':
                return this.getSettingsItems();
            default:
                return [];
        }
    }

    private async getRootItems(): Promise<AugmentTreeItem[]> {
        const hasAuth = this.apiClient ? this.apiClient.hasAnyAuth() : false;
        const currentUsage = this.usageTracker ? this.usageTracker.getCurrentUsage() : 0;
        const currentLimit = this.usageTracker ? this.usageTracker.getCurrentLimit() : 0;
        const percentage = currentLimit > 0 ? Math.round((currentUsage / currentLimit) * 100) : 0;

        return [
            new AugmentTreeItem(
                '概览',
                vscode.TreeItemCollapsibleState.Expanded,
                undefined,
                'overview',
                new vscode.ThemeIcon('dashboard'),
                `${hasAuth ? '已认证' : '未认证'} | ${currentUsage}/${currentLimit} (${percentage}%)`,
                '查看系统状态和使用统计'
            ),
            new AugmentTreeItem(
                '团队管理',
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                'team',
                new vscode.ThemeIcon('organization'),
                undefined,
                '邀请团队成员和自动接受邀请'
            ),
            new AugmentTreeItem(
                '账户管理',
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                'account',
                new vscode.ThemeIcon('account'),
                undefined,
                '管理多个Augment账户'
            ),
            new AugmentTreeItem(
                '设置',
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                'settings',
                new vscode.ThemeIcon('settings-gear'),
                undefined,
                '认证设置和系统配置'
            )
        ];
    }

    private async getOverviewItems(): Promise<AugmentTreeItem[]> {
        const hasAuth = this.apiClient ? this.apiClient.hasAnyAuth() : false;
        const currentUsage = this.usageTracker ? this.usageTracker.getCurrentUsage() : 0;
        const currentLimit = this.usageTracker ? this.usageTracker.getCurrentLimit() : 0;
        const hasRealData = this.usageTracker ? this.usageTracker.hasRealUsageData() : false;
        const percentage = currentLimit > 0 ? Math.round((currentUsage / currentLimit) * 100) : 0;

        const items = [
            new AugmentTreeItem(
                '认证状态',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'status',
                new vscode.ThemeIcon(hasAuth ? 'check' : 'x'),
                hasAuth ? '已认证' : '未认证',
                hasAuth ? '已成功认证，可以使用所有功能' : '未认证，请先配置账户'
            ),
            new AugmentTreeItem(
                '使用统计',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'usage',
                new vscode.ThemeIcon('graph'),
                `${currentUsage}/${currentLimit} (${percentage}%)`,
                `当前使用量: ${currentUsage}, 限制: ${currentLimit}, 使用率: ${percentage}%`
            ),
            new AugmentTreeItem(
                '数据来源',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'datasource',
                new vscode.ThemeIcon(hasRealData ? 'cloud' : 'database'),
                hasRealData ? '实时数据' : '本地数据',
                hasRealData ? '数据来自服务器，实时更新' : '使用本地缓存数据'
            )
        ];

        // 添加操作按钮
        items.push(
            new AugmentTreeItem(
                '刷新状态',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.checkAuthStatus',
                    title: '刷新状态'
                },
                'action',
                new vscode.ThemeIcon('refresh'),
                undefined,
                '检查认证状态和更新数据'
            ),
            new AugmentTreeItem(
                '手动刷新数据',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.manualRefresh',
                    title: '手动刷新数据'
                },
                'action',
                new vscode.ThemeIcon('sync'),
                undefined,
                '从服务器获取最新使用数据'
            ),
            new AugmentTreeItem(
                '查看详细统计',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.showDetails',
                    title: '查看详细统计'
                },
                'action',
                new vscode.ThemeIcon('graph-line'),
                undefined,
                '显示详细的使用统计信息'
            )
        );

        return items;
    }

    private getTeamItems(): AugmentTreeItem[] {
        return [
            new AugmentTreeItem(
                '邀请团队成员',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.inviteTeamMembersInput',
                    title: '邀请团队成员'
                },
                'action',
                new vscode.ThemeIcon('mail'),
                undefined,
                '批量邀请用户加入团队'
            ),
            new AugmentTreeItem(
                '自动接受邀请',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.autoAcceptInvitationsInput',
                    title: '自动接受邀请'
                },
                'action',
                new vscode.ThemeIcon('robot'),
                undefined,
                '监控邮箱并自动接受邀请'
            )
        ];
    }

    private async getAccountItems(): Promise<AugmentTreeItem[]> {
        const items = [
            new AugmentTreeItem(
                '查看账户列表',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.manageAccounts',
                    title: '查看账户列表'
                },
                'action',
                new vscode.ThemeIcon('list-unordered'),
                undefined,
                '显示所有已添加的账户'
            ),
            new AugmentTreeItem(
                '添加账户',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.addAccount',
                    title: '添加账户'
                },
                'action',
                new vscode.ThemeIcon('add'),
                undefined,
                '添加新的Augment账户'
            ),
            new AugmentTreeItem(
                '切换账户',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.switchAccount',
                    title: '切换账户'
                },
                'action',
                new vscode.ThemeIcon('arrow-swap'),
                undefined,
                '切换到其他账户'
            )
        ];

        // 显示当前账户信息
        if (this.accountManager) {
            try {
                const currentAccount = await this.accountManager.getCurrentAccount();
                if (currentAccount) {
                    items.unshift(
                        new AugmentTreeItem(
                            '当前账户',
                            vscode.TreeItemCollapsibleState.None,
                            undefined,
                            'current-account',
                            new vscode.ThemeIcon('person'),
                            currentAccount.name,
                            `当前账户: ${currentAccount.name} (${currentAccount.email})`
                        )
                    );
                }
            } catch (error) {
                // 忽略错误
            }
        }

        return items;
    }

    private getSettingsItems(): AugmentTreeItem[] {
        return [
            new AugmentTreeItem(
                '浏览器登录',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.webLogin',
                    title: '浏览器登录'
                },
                'action',
                new vscode.ThemeIcon('browser'),
                undefined,
                '通过浏览器登录Augment账户'
            ),
            new AugmentTreeItem(
                '配置Cookie',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.setupCookies',
                    title: '配置Cookie'
                },
                'action',
                new vscode.ThemeIcon('key'),
                undefined,
                '手动配置认证Cookie'
            ),
            new AugmentTreeItem(
                '退出登录',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.logout',
                    title: '退出登录'
                },
                'action',
                new vscode.ThemeIcon('sign-out'),
                undefined,
                '退出当前账户'
            ),
            new AugmentTreeItem(
                '设置语言',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.setLanguage',
                    title: '设置语言'
                },
                'action',
                new vscode.ThemeIcon('globe'),
                undefined,
                '更改界面语言'
            ),
            new AugmentTreeItem(
                '打开设置',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.openSettings',
                    title: '打开设置'
                },
                'action',
                new vscode.ThemeIcon('settings'),
                undefined,
                '打开扩展设置页面'
            ),
            new AugmentTreeItem(
                '重置统计',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'augmentTracker.resetUsage',
                    title: '重置统计'
                },
                'action',
                new vscode.ThemeIcon('trash'),
                undefined,
                '重置本地使用统计数据'
            )
        ];
    }
}
