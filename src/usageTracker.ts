import * as vscode from 'vscode';
import { StorageManager, UsageData } from './storage';
import { ConfigManager } from './config';

export interface RealUsageData {
    totalUsage?: number;
    usageLimit?: number;
    dailyUsage?: number;
    lastUpdate?: string;
}

export class UsageTracker implements vscode.Disposable {
    private storageManager: StorageManager;
    private configManager: ConfigManager;
    private disposables: vscode.Disposable[] = [];
    private currentUsage: number = 0;
    private currentLimit: number = 0;
    private lastResetDate: string = '';
    private hasRealData: boolean = false;
    private realDataSource: string = 'simulation';
    private realDataFetcher: (() => Promise<void>) | null = null;

    constructor(storageManager: StorageManager, configManager: ConfigManager) {
        this.storageManager = storageManager;
        this.configManager = configManager;
        this.loadCurrentUsage();
    }

    private async loadCurrentUsage() {
        const data = await this.storageManager.getUsageData();
        this.currentUsage = data.totalUsage;
        this.lastResetDate = data.lastResetDate;
    }

    startTracking() {
        if (!this.configManager.isEnabled()) {
            return;
        }

        // 只进行真实数据获取，不再模拟任何使用数据
        // Periodic cleanup of old data
        setInterval(() => {
            this.storageManager.cleanOldData();
        }, 24 * 60 * 60 * 1000); // Daily cleanup

        // 定期获取真实数据
        const refreshInterval = this.configManager.getRefreshInterval() * 1000;

        setInterval(() => {
            this.fetchRealUsageData();
        }, refreshInterval);

        // 立即获取一次真实数据
        this.fetchRealUsageData();
    }



    // 移除了trackUsage和showUsageLimitWarning方法，因为我们只使用真实API数据

    async resetUsage() {
        await this.storageManager.resetUsage();
        const data = await this.storageManager.getUsageData();
        this.currentUsage = data.totalUsage;
        this.lastResetDate = data.lastResetDate;
        this.hasRealData = false;
        this.realDataSource = 'no_data';
    }

    getCurrentUsage(): number {
        return Math.round(this.currentUsage);
    }

    getCurrentLimit(): number {
        // 如果有真实数据，返回API中的真实limit
        if (this.hasRealData && this.realDataSource === 'augment_api') {
            return this.currentLimit;
        }
        return 0; // 没有真实数据时返回0
    }

    getLastResetDate(): string {
        return new Date(this.lastResetDate).toLocaleDateString();
    }

    hasRealUsageData(): boolean {
        return this.hasRealData;
    }

    getDataSource(): string {
        return this.realDataSource;
    }

    async updateWithRealData(realData: RealUsageData): Promise<void> {
        try {
            if (realData.totalUsage !== undefined) {
                // Update with real total usage and limit
                this.currentUsage = realData.totalUsage;
                if (realData.usageLimit !== undefined) {
                    this.currentLimit = realData.usageLimit;
                }
                this.hasRealData = true;
                this.realDataSource = 'augment_api';

                // Store the real data
                const data = await this.storageManager.getUsageData();
                data.totalUsage = realData.totalUsage;
                if (realData.lastUpdate) {
                    data.lastUpdateDate = realData.lastUpdate;
                }
                await this.storageManager.saveUsageData(data);

                // 更新完成
            } else if (realData.dailyUsage !== undefined) {
                // Update with daily usage increment
                const data = await this.storageManager.incrementUsage(realData.dailyUsage);
                this.currentUsage = data.totalUsage;
                this.hasRealData = true;
                this.realDataSource = 'augment_daily';
            }
        } catch (error) {
            console.error('Error updating with real data:', error);
        }
    }

    async promptUserForRealData(): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            'Would you like to manually input your Augment usage data?',
            'Enter Usage', 'Enter Limit', 'Cancel'
        );

        if (choice === 'Enter Usage') {
            const usageInput = await vscode.window.showInputBox({
                prompt: 'Enter your current Augment usage count',
                placeHolder: 'e.g., 150',
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 0) {
                        return 'Please enter a valid positive number';
                    }
                    return null;
                }
            });

            if (usageInput) {
                const usage = parseInt(usageInput);
                await this.updateWithRealData({ totalUsage: usage });
                this.realDataSource = 'user_input';
                vscode.window.showInformationMessage(`Usage updated to ${usage}`);
            }
        } else if (choice === 'Enter Limit') {
            const limitInput = await vscode.window.showInputBox({
                prompt: 'Enter your Augment usage limit',
                placeHolder: 'e.g., 1000',
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num <= 0) {
                        return 'Please enter a valid positive number';
                    }
                    return null;
                }
            });

            if (limitInput) {
                const limit = parseInt(limitInput);
                await this.configManager.updateConfig('usageLimit', limit);
                vscode.window.showInformationMessage(`Usage limit updated to ${limit}`);
            }
        }
    }

    async getTodayUsage(): Promise<number> {
        return await this.storageManager.getTodayUsage();
    }

    async getWeeklyUsage(): Promise<number> {
        return await this.storageManager.getWeeklyUsage();
    }

    private async fetchRealUsageData(): Promise<void> {
        try {
            // 检查是否已退出登录或数据获取器被清除
            if (this.realDataFetcher && this.hasRealData !== false) {
                await this.realDataFetcher();
            }
        } catch (error) {
            console.error('Error fetching real usage data:', error);
        }
    }

    // 设置真实数据获取器（由extension.ts调用）
    setRealDataFetcher(fetcher: (() => Promise<void>) | null): void {
        this.realDataFetcher = fetcher;
    }

    // 清除真实数据标志（用于退出登录）
    clearRealDataFlag(): void {
        this.hasRealData = false;
        this.realDataSource = 'no_data';
        this.currentUsage = 0;
        this.currentLimit = 0;
    }

    // 停止数据获取（用于退出登录）
    stopDataFetching(): void {
        this.realDataFetcher = null;
        this.clearRealDataFlag();
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        // 清理数据获取器
        this.realDataFetcher = null;
    }
}
