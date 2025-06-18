import * as vscode from 'vscode';
import { AugmentApiClient, AugmentUsageData } from './augmentApi';

export interface AugmentStatus {
    installed: boolean;
    active: boolean;
    version?: string;
    hasRealData: boolean;
    usageData?: {
        totalUsage?: number;
        dailyUsage?: number;
        lastUpdate?: string;
    };
    integrationMethod?: 'none' | 'detection' | 'user_input' | 'api';
}

export class AugmentDetector {
    private readonly AUGMENT_EXTENSION_ID = 'augment.vscode-augment';
    private lastDetectionTime: number = 0;
    private cachedStatus: AugmentStatus | null = null;
    private readonly CACHE_DURATION = 30000; // 30 seconds
    private apiClient: AugmentApiClient;

    constructor() {
        this.apiClient = new AugmentApiClient();
    }

    // 简化的检测方法，主要用于API客户端
    async isAugmentActive(): Promise<boolean> {
        const extension = vscode.extensions.getExtension(this.AUGMENT_EXTENSION_ID);
        return extension?.isActive || false;
    }

    async getAugmentVersion(): Promise<string | undefined> {
        const extension = vscode.extensions.getExtension(this.AUGMENT_EXTENSION_ID);
        return extension?.packageJSON?.version;
    }

    async getAugmentStatus(): Promise<AugmentStatus> {
        // Use cached result if still valid
        const now = Date.now();
        if (this.cachedStatus && (now - this.lastDetectionTime) < this.CACHE_DURATION) {
            return this.cachedStatus;
        }

        const extension = vscode.extensions.getExtension(this.AUGMENT_EXTENSION_ID);
        const installed = extension !== undefined;
        const active = extension?.isActive || false;
        const version = extension?.packageJSON?.version;

        let hasRealData = false;
        let usageData: AugmentStatus['usageData'] = undefined;
        let integrationMethod: AugmentStatus['integrationMethod'] = 'none';

        // 简化：不再尝试从Augment插件获取数据，只使用API
        hasRealData = false;
        integrationMethod = 'api';

        const status: AugmentStatus = {
            installed,
            active,
            version,
            hasRealData,
            usageData,
            integrationMethod
        };

        // Cache the result
        this.cachedStatus = status;
        this.lastDetectionTime = now;

        return status;
    }

    // Monitor Augment extension state changes
    onAugmentStateChange(callback: (status: AugmentStatus) => void): vscode.Disposable {
        return vscode.extensions.onDidChange(async () => {
            // Clear cache to force fresh detection
            this.cachedStatus = null;
            const status = await this.getAugmentStatus();
            callback(status);
        });
    }

    // 移除了复杂的Augment插件数据获取逻辑，现在只使用API客户端



    // Check if we can integrate with Augment's status bar or UI
    async checkAugmentIntegrationPossibility(): Promise<{
        canIntegrate: boolean;
        methods: string[];
        limitations: string[];
    }> {
        const status = await this.getAugmentStatus();
        
        const methods: string[] = [];
        const limitations: string[] = [];

        if (status.installed) {
            methods.push('Extension state monitoring');
            
            if (status.active) {
                methods.push('Active extension detection');
                // TODO: Add more integration methods as they're discovered
            } else {
                limitations.push('Extension is installed but not active');
            }
        } else {
            limitations.push('Augment extension is not installed');
        }

        // Always add simulation as a fallback
        methods.push('Usage simulation based on editor events');

        return {
            canIntegrate: status.installed,
            methods,
            limitations
        };
    }

    // API-related methods
    async promptForApiToken(): Promise<boolean> {
        const success = await this.apiClient.promptForAuthToken();
        if (success) {
            // Clear cache to force re-detection with new token
            this.cachedStatus = null;
        }
        return success;
    }

    async testApiConnection(): Promise<{
        success: boolean;
        error?: string;
        hasToken: boolean;
    }> {
        const hasToken = this.apiClient.hasAuthToken();

        if (!hasToken) {
            return {
                success: false,
                error: 'No authentication token provided',
                hasToken: false
            };
        }

        const testResult = await this.apiClient.testConnection();
        return {
            success: testResult.success,
            error: testResult.error,
            hasToken: true
        };
    }

    async getApiUsageData(): Promise<AugmentUsageData | null> {
        if (!this.apiClient.hasAuthToken()) {
            return null;
        }

        try {
            const response = await this.apiClient.getUsageData();
            if (response.success) {
                return await this.apiClient.parseUsageResponse(response);
            }
        } catch (error) {
            console.error('Error getting API usage data:', error);
        }

        return null;
    }

    clearApiToken(): void {
        this.apiClient.clearAuthToken();
        this.cachedStatus = null;
    }

    hasApiToken(): boolean {
        return this.apiClient.hasAuthToken();
    }
}
