import * as vscode from 'vscode';

export interface AccountInfo {
    id: string;
    name: string;
    email: string;
    cookies: string;
    createdAt: number;
    lastUsedAt: number;
    isActive: boolean;
    usageData?: {
        totalUsage: number;
        remainingCredits: number;
        plan: string;
    };
}

export interface AccountsData {
    accounts: AccountInfo[];
    currentAccountId: string | null;
    lastUpdated: number;
}

export class AccountManager {
    private context: vscode.ExtensionContext;
    private readonly ACCOUNTS_STORAGE_KEY = 'augment.accounts';
    private readonly CURRENT_ACCOUNT_KEY = 'augment.currentAccount';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async initialize(): Promise<void> {
        console.log('👥 [AccountManager] Initializing account manager...');
        
        // 检查是否需要迁移现有的单账户数据
        await this.migrateExistingAccount();
        
        // 确保有默认的账户数据结构
        const accountsData = await this.getAccountsData();
        if (accountsData.accounts.length === 0) {
            console.log('👥 [AccountManager] No accounts found, ready for first account setup');
        } else {
            console.log(`👥 [AccountManager] Found ${accountsData.accounts.length} accounts`);
        }
    }

    private async migrateExistingAccount(): Promise<void> {
        try {
            // 检查是否有现有的单账户Cookie配置
            const existingCookies = vscode.workspace.getConfiguration().get<string>('augment.cookies', '');
            
            if (existingCookies && existingCookies.trim() !== '') {
                console.log('🔄 [AccountManager] Found existing single account, migrating...');
                
                const accountsData = await this.getAccountsData();
                
                // 检查是否已经迁移过
                const existingAccount = accountsData.accounts.find(acc => acc.cookies === existingCookies.trim());
                
                if (!existingAccount) {
                    // 创建迁移账户
                    const migratedAccount: AccountInfo = {
                        id: this.generateAccountId(),
                        name: '迁移账户',
                        email: 'migrated@account.local',
                        cookies: existingCookies.trim(),
                        createdAt: Date.now(),
                        lastUsedAt: Date.now(),
                        isActive: true
                    };
                    
                    accountsData.accounts.push(migratedAccount);
                    accountsData.currentAccountId = migratedAccount.id;
                    accountsData.lastUpdated = Date.now();
                    
                    await this.saveAccountsData(accountsData);
                    
                    console.log('✅ [AccountManager] Successfully migrated existing account');
                    
                    // 显示迁移通知
                    vscode.window.showInformationMessage(
                        '🔄 账户迁移完成\n\n' +
                        '您的现有账户已迁移到新的多账户管理系统。\n' +
                        '现在可以添加和切换多个Augment账户了！'
                    );
                }
            }
        } catch (error) {
            console.error('❌ [AccountManager] Migration failed:', error);
        }
    }

    private async getAccountsData(): Promise<AccountsData> {
        const defaultData: AccountsData = {
            accounts: [],
            currentAccountId: null,
            lastUpdated: Date.now()
        };

        const stored = this.context.globalState.get<AccountsData>(this.ACCOUNTS_STORAGE_KEY);
        return stored || defaultData;
    }

    private async saveAccountsData(data: AccountsData): Promise<void> {
        data.lastUpdated = Date.now();
        await this.context.globalState.update(this.ACCOUNTS_STORAGE_KEY, data);
    }

    async addAccount(name: string, email: string, cookies: string): Promise<AccountInfo> {
        const accountsData = await this.getAccountsData();
        
        // 检查是否已存在相同的Cookie
        const existingAccount = accountsData.accounts.find(acc => acc.cookies === cookies);
        if (existingAccount) {
            throw new Error(`账户已存在：${existingAccount.name} (${existingAccount.email})`);
        }
        
        // 创建新账户
        const newAccount: AccountInfo = {
            id: this.generateAccountId(),
            name: name,
            email: email,
            cookies: cookies,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            isActive: false
        };
        
        accountsData.accounts.push(newAccount);
        await this.saveAccountsData(accountsData);
        
        console.log(`✅ [AccountManager] Added new account: ${name} (${email})`);
        return newAccount;
    }

    async removeAccount(accountId: string): Promise<boolean> {
        const accountsData = await this.getAccountsData();
        const accountIndex = accountsData.accounts.findIndex(acc => acc.id === accountId);
        
        if (accountIndex === -1) {
            return false;
        }
        
        const account = accountsData.accounts[accountIndex];
        accountsData.accounts.splice(accountIndex, 1);
        
        // 如果删除的是当前活跃账户，需要切换到其他账户或清空
        if (accountsData.currentAccountId === accountId) {
            if (accountsData.accounts.length > 0) {
                await this.switchToAccount(accountsData.accounts[0].id);
            } else {
                accountsData.currentAccountId = null;
                await this.clearCurrentAccountConfig();
            }
        }
        
        await this.saveAccountsData(accountsData);
        
        console.log(`🗑️ [AccountManager] Removed account: ${account.name} (${account.email})`);
        return true;
    }

    async switchToAccount(accountId: string): Promise<boolean> {
        const accountsData = await this.getAccountsData();
        const account = accountsData.accounts.find(acc => acc.id === accountId);
        
        if (!account) {
            return false;
        }
        
        // 更新所有账户的活跃状态
        accountsData.accounts.forEach(acc => {
            acc.isActive = acc.id === accountId;
            if (acc.id === accountId) {
                acc.lastUsedAt = Date.now();
            }
        });
        
        accountsData.currentAccountId = accountId;
        await this.saveAccountsData(accountsData);
        
        // 更新VSCode配置
        await vscode.workspace.getConfiguration()
            .update('augment.cookies', account.cookies, vscode.ConfigurationTarget.Global);
        
        console.log(`🔄 [AccountManager] Switched to account: ${account.name} (${account.email})`);
        return true;
    }

    async getCurrentAccount(): Promise<AccountInfo | null> {
        const accountsData = await this.getAccountsData();
        
        if (!accountsData.currentAccountId) {
            return null;
        }
        
        return accountsData.accounts.find(acc => acc.id === accountsData.currentAccountId) || null;
    }

    async getAllAccounts(): Promise<AccountInfo[]> {
        const accountsData = await this.getAccountsData();
        return accountsData.accounts;
    }

    async updateAccountUsageData(accountId: string, usageData: AccountInfo['usageData']): Promise<void> {
        const accountsData = await this.getAccountsData();
        const account = accountsData.accounts.find(acc => acc.id === accountId);
        
        if (account) {
            account.usageData = usageData;
            await this.saveAccountsData(accountsData);
        }
    }

    async updateAccountInfo(accountId: string, updates: Partial<Pick<AccountInfo, 'name' | 'email'>>): Promise<boolean> {
        const accountsData = await this.getAccountsData();
        const account = accountsData.accounts.find(acc => acc.id === accountId);
        
        if (!account) {
            return false;
        }
        
        if (updates.name !== undefined) {
            account.name = updates.name;
        }
        if (updates.email !== undefined) {
            account.email = updates.email;
        }
        
        await this.saveAccountsData(accountsData);
        return true;
    }

    private async clearCurrentAccountConfig(): Promise<void> {
        await vscode.workspace.getConfiguration()
            .update('augment.cookies', '', vscode.ConfigurationTarget.Global);
    }

    async getAccountStats(): Promise<{
        totalAccounts: number;
        activeAccounts: number;
        accountsWithData: number;
        totalUsage: number;
        totalCredits: number;
        oldestAccount: AccountInfo | null;
        newestAccount: AccountInfo | null;
        mostActiveAccount: AccountInfo | null;
    }> {
        const accounts = await this.getAllAccounts();

        if (accounts.length === 0) {
            return {
                totalAccounts: 0,
                activeAccounts: 0,
                accountsWithData: 0,
                totalUsage: 0,
                totalCredits: 0,
                oldestAccount: null,
                newestAccount: null,
                mostActiveAccount: null
            };
        }

        const activeAccounts = accounts.filter(acc => acc.isActive).length;
        const accountsWithData = accounts.filter(acc => acc.usageData).length;
        const totalUsage = accounts.reduce((sum, acc) => sum + (acc.usageData?.totalUsage || 0), 0);
        const totalCredits = accounts.reduce((sum, acc) => sum + (acc.usageData?.remainingCredits || 0), 0);

        const oldestAccount = accounts.reduce((oldest, acc) =>
            acc.createdAt < oldest.createdAt ? acc : oldest);
        const newestAccount = accounts.reduce((newest, acc) =>
            acc.createdAt > newest.createdAt ? acc : newest);
        const mostActiveAccount = accounts.reduce((mostActive, acc) =>
            acc.lastUsedAt > mostActive.lastUsedAt ? acc : mostActive);

        return {
            totalAccounts: accounts.length,
            activeAccounts,
            accountsWithData,
            totalUsage,
            totalCredits,
            oldestAccount,
            newestAccount,
            mostActiveAccount
        };
    }

    async validateAccountCookies(accountId: string): Promise<boolean> {
        const account = await this.getAccountById(accountId);
        if (!account || !account.cookies) {
            return false;
        }

        // 简单的cookie格式验证
        const requiredCookies = ['_session', 'ajs_user_id'];
        return requiredCookies.every(cookieName =>
            account.cookies.includes(cookieName + '=')
        );
    }

    async getAccountById(accountId: string): Promise<AccountInfo | null> {
        const accountsData = await this.getAccountsData();
        return accountsData.accounts.find(acc => acc.id === accountId) || null;
    }

    async getAccountsByStatus(isActive: boolean): Promise<AccountInfo[]> {
        const accounts = await this.getAllAccounts();
        return accounts.filter(acc => acc.isActive === isActive);
    }

    async getAccountsWithUsageData(): Promise<AccountInfo[]> {
        const accounts = await this.getAllAccounts();
        return accounts.filter(acc => acc.usageData);
    }

    async cleanupOldAccounts(daysThreshold: number = 90): Promise<number> {
        const accounts = await this.getAllAccounts();
        const cutoffTime = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);

        const oldAccounts = accounts.filter(acc =>
            !acc.isActive && acc.lastUsedAt < cutoffTime
        );

        let cleanedCount = 0;
        for (const account of oldAccounts) {
            const success = await this.removeAccount(account.id);
            if (success) {
                cleanedCount++;
            }
        }

        console.log(`🧹 [AccountManager] Cleaned up ${cleanedCount} old accounts`);
        return cleanedCount;
    }

    async exportAccountsConfig(): Promise<any> {
        const accounts = await this.getAllAccounts();

        return {
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
    }

    async importAccountsConfig(importData: any): Promise<{imported: number, skipped: number}> {
        if (!importData.accounts || !Array.isArray(importData.accounts)) {
            throw new Error('Invalid import data format');
        }

        const existingAccounts = await this.getAllAccounts();
        let importedCount = 0;
        let skippedCount = 0;

        for (const importAcc of importData.accounts) {
            // 检查是否重复
            const isDuplicate = existingAccounts.some(existingAcc =>
                existingAcc.email === importAcc.email
            );

            if (isDuplicate) {
                skippedCount++;
                continue;
            }

            try {
                // 导入账户（不包含cookies）
                await this.addAccount(
                    importAcc.name,
                    importAcc.email,
                    '' // 空的cookies，需要用户后续配置
                );
                importedCount++;
            } catch (error) {
                console.error(`Import account ${importAcc.name} failed:`, error);
                skippedCount++;
            }
        }

        return { imported: importedCount, skipped: skippedCount };
    }

    private generateAccountId(): string {
        return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    async clearAllAccounts(): Promise<void> {
        const defaultData: AccountsData = {
            accounts: [],
            currentAccountId: null,
            lastUpdated: Date.now()
        };
        
        await this.saveAccountsData(defaultData);
        await this.clearCurrentAccountConfig();
        
        console.log('🚪 [AccountManager] All accounts cleared');
    }

    async getAccountsCount(): Promise<number> {
        const accountsData = await this.getAccountsData();
        return accountsData.accounts.length;
    }

    async exportAccounts(): Promise<string> {
        const accountsData = await this.getAccountsData();
        
        // 创建导出数据（不包含敏感的Cookie信息）
        const exportData = {
            accounts: accountsData.accounts.map(acc => ({
                name: acc.name,
                email: acc.email,
                createdAt: acc.createdAt,
                lastUsedAt: acc.lastUsedAt,
                // 不导出cookies以保护隐私
            })),
            exportedAt: Date.now(),
            version: '1.0'
        };
        
        return JSON.stringify(exportData, null, 2);
    }
}
