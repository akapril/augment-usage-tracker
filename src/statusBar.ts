import * as vscode from 'vscode';
import { UsageTracker } from './usageTracker';
import { ConfigManager } from './config';
import { AugmentStatus } from './augmentDetector';
import { t } from './i18n';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private usageTracker: UsageTracker;
    private configManager: ConfigManager;
    private refreshTimer: NodeJS.Timeout | undefined;
    private augmentStatus: AugmentStatus | null = null;

    constructor(usageTracker: UsageTracker, configManager: ConfigManager) {
        this.usageTracker = usageTracker;
        this.configManager = configManager;
        
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.setupStatusBarItem();
        this.startRefreshTimer();
    }

    private setupStatusBarItem() {
        this.statusBarItem.tooltip = 'Augment Usage Tracker - Click for more options';
        this.updateDisplay();
        
        // Set click command based on configuration
        this.updateClickCommand();
    }

    private updateClickCommand() {
        const clickAction = this.configManager.getClickAction();
        
        switch (clickAction) {
            case 'openWebsite':
                this.statusBarItem.command = {
                    command: 'vscode.open',
                    arguments: [vscode.Uri.parse('https://www.augmentcode.com')],
                    title: 'Open Augment Website'
                };
                break;
            case 'showDetails':
                this.statusBarItem.command = 'augmentTracker.showDetails';
                break;
            case 'openSettings':
                this.statusBarItem.command = 'augmentTracker.openSettings';
                break;
            default:
                this.statusBarItem.command = 'augmentTracker.showDetails';
        }
    }

    updateDisplay() {
        if (!this.configManager.isEnabled() || !this.configManager.shouldShowInStatusBar()) {
            this.statusBarItem.hide();
            return;
        }

        const usage = this.usageTracker.getCurrentUsage();
        const limit = this.usageTracker.getCurrentLimit(); // 使用API返回的limit
        const percentage = limit > 0 ? Math.round((usage / limit) * 100) : 0;
        const hasRealData = this.usageTracker.hasRealUsageData();
        const dataSource = this.usageTracker.getDataSource();

        // 如果没有真实数据或limit为0，显示未登录状态
        if (!hasRealData || limit === 0) {
            this.updateLogoutStatus();
            return;
        }

        // Update text with usage information and data source indicator
        const dataIndicator = hasRealData ? '●' : '○';
        this.statusBarItem.text = `$(pulse) Augment: ${usage}/${limit} ${dataIndicator}`;

        // Build detailed tooltip
        let tooltip = `${t('tooltip.augmentUsageTracker')}
${t('tooltip.current')}: ${usage} ${t('credits')}
${t('tooltip.limit')}: ${limit} ${t('credits')}
${t('tooltip.usage')}: ${percentage}%
${t('tooltip.remaining')}: ${limit - usage} ${t('credits')}
${t('tooltip.dataSource')}: ${this.getDataSourceDescription(dataSource, hasRealData)}`;

        // Add Augment status if available
        if (this.augmentStatus) {
            tooltip += `\n\nAugment Plugin:`;
            tooltip += `\n• Installed: ${this.augmentStatus.installed ? 'Yes' : 'No'}`;
            if (this.augmentStatus.installed) {
                tooltip += `\n• Active: ${this.augmentStatus.active ? 'Yes' : 'No'}`;
                if (this.augmentStatus.version) {
                    tooltip += `\n• Version: ${this.augmentStatus.version}`;
                }
                tooltip += `\n• Integration: ${this.augmentStatus.integrationMethod || 'none'}`;
            }
        }

        tooltip += `\n\nClick to ${this.getClickActionDescription()}`;
        this.statusBarItem.tooltip = tooltip;

        // Change color based on usage percentage and data source
        if (percentage >= 90) {
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        } else if (percentage >= 75) {
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        } else if (hasRealData) {
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        } else {
            this.statusBarItem.color = undefined;
        }

        this.updateClickCommand();
        this.statusBarItem.show();
    }

    private getDataSourceDescription(source: string, hasRealData: boolean): string {
        if (hasRealData) {
            return t('tooltip.realDataFromApi');
        } else {
            return '无数据 (未登录)';
        }
    }

    updateAugmentStatus(status: AugmentStatus) {
        this.augmentStatus = status;
        this.updateDisplay();
    }

    private getClickActionDescription(): string {
        const action = this.configManager.getClickAction();
        switch (action) {
            case 'openWebsite': return 'open Augment website';
            case 'showDetails': return 'show usage details';
            case 'openSettings': return 'open settings';
            default: return 'show details';
        }
    }

    private startRefreshTimer() {
        const interval = this.configManager.getRefreshInterval() * 1000;
        
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        this.refreshTimer = setInterval(() => {
            this.updateDisplay();
        }, interval);
    }

    show() {
        this.updateDisplay();
    }

    hide() {
        this.statusBarItem.hide();
    }

    updateLogoutStatus() {
        const showInStatusBar = vscode.workspace.getConfiguration('augmentTracker').get<boolean>('showInStatusBar', true);
        if (!showInStatusBar) {
            this.statusBarItem.hide();
            return;
        }

        // 显示未登录状态
        this.statusBarItem.text = '$(circle-slash) Augment: 未登录';
        this.statusBarItem.tooltip = 'Augment 使用量追踪器\n状态: 未登录\n点击配置认证';
        this.statusBarItem.command = 'augmentTracker.webLogin';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.statusBarItem.show();

        // 状态栏已更新为未登录状态
    }

    dispose() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this.statusBarItem.dispose();
    }
}
