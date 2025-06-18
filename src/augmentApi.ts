import * as vscode from 'vscode';

// 添加fetch类型支持
interface RequestInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}

interface Response {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
    json(): Promise<any>;
}

interface Headers {
    entries(): IterableIterator<[string, string]>;
}

declare global {
    function fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface AugmentApiResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export interface AugmentUsageData {
    totalUsage?: number;
    usageLimit?: number;
    dailyUsage?: number;
    monthlyUsage?: number;
    lastUpdate?: string;
    subscriptionType?: string;
    renewalDate?: string;
}

export class AugmentApiClient {
    private readonly API_BASE_URL = 'https://app.augmentcode.com/api';
    private readonly WEB_BASE_URL = 'https://app.augmentcode.com';
    private authToken: string | null = null;
    private cookies: string | null = null;
    private tempStorage: Map<string, string> = new Map();

    constructor() {
        this.loadAuthToken();
        this.loadCookies();
    }

    private async loadAuthToken(): Promise<void> {
        try {
            // Try to get auth token from VSCode secrets
            const secrets = vscode.workspace.getConfiguration().get('augment.authToken') as string;
            if (secrets) {
                this.authToken = secrets;
            }
        } catch (error) {
            console.log('No Augment auth token found');
        }
    }

    private async loadCookies(): Promise<void> {
        try {
            // Try to get cookies from VSCode configuration
            const cookies = vscode.workspace.getConfiguration().get('augment.cookies') as string;
            if (cookies) {
                this.cookies = cookies;
            }
        } catch (error) {
            console.log('No Augment cookies found');
        }
    }

    async setAuthToken(token: string): Promise<void> {
        this.authToken = token;
        // Store in temporary storage and try VSCode configuration
        this.tempStorage.set('authToken', token);
        try {
            await vscode.workspace.getConfiguration().update('augment.authToken', token, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.warn('Failed to save auth token to configuration, using temporary storage:', error);
        }
    }

    async setCookies(cookies: string): Promise<void> {
        this.cookies = cookies;
        // Store in temporary storage and try VSCode configuration
        this.tempStorage.set('cookies', cookies);
        try {
            await vscode.workspace.getConfiguration().update('augment.cookies', cookies, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.warn('Failed to save cookies to configuration, using temporary storage:', error);
        }
    }

    private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<AugmentApiResponse> {
        try {
            const url = `${this.API_BASE_URL}${endpoint}`;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            // 如果有cookies，也添加到请求中
            if (this.cookies) {
                headers['Cookie'] = this.cookies;
                headers['Referer'] = this.WEB_BASE_URL;
                headers['Origin'] = this.WEB_BASE_URL;
            }

            // 详细日志记录
            console.log(`🌐 Augment API Request:`, {
                url,
                method: options.method || 'GET',
                headers: { ...headers, Authorization: this.authToken ? 'Bearer [HIDDEN]' : 'None' },
                timestamp: new Date().toISOString()
            });

            const startTime = Date.now();
            const response = await fetch(url, {
                ...options,
                headers
            });
            const duration = Date.now() - startTime;

            console.log(`📡 Augment API Response:`, {
                url,
                status: response.status,
                statusText: response.statusText,
                duration: `${duration}ms`,
                headers: Object.fromEntries(response.headers.entries()),
                timestamp: new Date().toISOString()
            });

            if (response.status === 401) {
                console.warn('🔒 Authentication failed - token may be invalid or expired');
                return {
                    success: false,
                    error: 'Authentication required. Please provide your Augment auth token.'
                };
            }

            if (!response.ok) {
                console.error(`❌ API request failed:`, {
                    status: response.status,
                    statusText: response.statusText,
                    url
                });
                return {
                    success: false,
                    error: `API request failed: ${response.status} ${response.statusText}`
                };
            }

            const data = await response.json();
            console.log(`✅ API request successful:`, {
                url,
                dataKeys: Object.keys(data),
                dataSize: JSON.stringify(data).length,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                data
            };
        } catch (error: any) {
            console.error(`🚨 Network error:`, {
                endpoint,
                error: error?.message || 'Unknown error',
                stack: error?.stack || 'No stack trace',
                timestamp: new Date().toISOString()
            });
            return {
                success: false,
                error: `Network error: ${error?.message || error}`
            };
        }
    }

    async checkHealth(): Promise<AugmentApiResponse> {
        try {
            // 使用真实的用户API端点作为健康检查
            const response = await this.makeRequest('/user');
            if (response.success) {
                return {
                    success: true,
                    data: { status: 'healthy', userConnected: true }
                };
            }
            return {
                success: false,
                error: 'API health check failed'
            };
        } catch (error) {
            return {
                success: false,
                error: `Health check failed: ${error}`
            };
        }
    }

    async getUserInfo(): Promise<AugmentApiResponse> {
        return await this.makeRequest('/user');
    }

    async getUsageData(): Promise<AugmentApiResponse> {
        return await this.makeRequest('/credits');
    }

    async getSubscriptionInfo(): Promise<AugmentApiResponse> {
        return await this.makeRequest('/subscription');
    }

    async getCreditsInfo(): Promise<AugmentApiResponse> {
        return await this.makeRequest('/credits');
    }

    async getPlansInfo(): Promise<AugmentApiResponse> {
        return await this.makeRequest('/plans');
    }

    async parseUsageResponse(response: AugmentApiResponse): Promise<AugmentUsageData | null> {
        if (!response.success || !response.data) {
            return null;
        }

        try {
            const data = response.data;

            // 基于HAR文件分析的真实数据结构
            if (data.usageUnitsUsedThisBillingCycle !== undefined) {
                // Credits API 响应格式
                return {
                    totalUsage: data.usageUnitsUsedThisBillingCycle,
                    usageLimit: data.usageUnitsAvailable + data.usageUnitsUsedThisBillingCycle,
                    dailyUsage: data.usageUnitsUsedThisBillingCycle,
                    monthlyUsage: data.usageUnitsUsedThisBillingCycle,
                    lastUpdate: new Date().toISOString(),
                    subscriptionType: 'community', // 从订阅信息获取
                    renewalDate: undefined
                };
            }

            // 订阅API响应格式
            if (data.creditsRenewingEachBillingCycle !== undefined) {
                return {
                    totalUsage: data.creditsIncludedThisBillingCycle - data.creditsRenewingEachBillingCycle,
                    usageLimit: data.creditsIncludedThisBillingCycle,
                    dailyUsage: undefined,
                    monthlyUsage: data.creditsIncludedThisBillingCycle - data.creditsRenewingEachBillingCycle,
                    lastUpdate: new Date().toISOString(),
                    subscriptionType: data.augmentPlanType || data.planName,
                    renewalDate: data.billingPeriodEnd
                };
            }

            // 回退到通用格式
            return {
                totalUsage: data.totalUsage || data.usage || data.count || 0,
                usageLimit: data.limit || data.quota || data.maxUsage || 1000,
                dailyUsage: data.dailyUsage || data.today,
                monthlyUsage: data.monthlyUsage || data.thisMonth,
                lastUpdate: data.lastUpdate || data.updatedAt || new Date().toISOString(),
                subscriptionType: data.plan || data.tier || data.subscriptionType,
                renewalDate: data.renewalDate || data.nextBilling
            };
        } catch (error) {
            console.error('Error parsing usage response:', error);
            return null;
        }
    }

    async promptForAuthToken(): Promise<boolean> {
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your Augment authentication token',
            placeHolder: 'Bearer token from Augment dashboard',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Token cannot be empty';
                }
                return null;
            }
        });

        if (token) {
            await this.setAuthToken(token.trim());
            return true;
        }
        return false;
    }

    async promptForCookies(): Promise<boolean> {
        const cookies = await vscode.window.showInputBox({
            prompt: 'Enter your Augment session cookies',
            placeHolder: 'Copy cookies from browser after logging into app.augmentcode.com',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Cookies cannot be empty';
                }
                if (!value.includes('_session=')) {
                    return 'Invalid cookies format - should contain _session=';
                }
                return null;
            }
        });

        if (cookies) {
            await this.setCookies(cookies.trim());
            return true;
        }
        return false;
    }

    async testConnection(): Promise<AugmentApiResponse> {
        // First check health
        const healthCheck = await this.checkHealth();
        if (!healthCheck.success) {
            return healthCheck;
        }

        // Then try to get user info to test auth
        const userInfo = await this.getUserInfo();
        return userInfo;
    }

    hasAuthToken(): boolean {
        return this.authToken !== null && this.authToken.length > 0;
    }

    hasCookies(): boolean {
        return this.cookies !== null && this.cookies.length > 0;
    }

    hasAnyAuth(): boolean {
        return this.hasAuthToken() || this.hasCookies();
    }

    clearAuthToken(): void {
        this.authToken = null;
        try {
            vscode.workspace.getConfiguration().update('augment.authToken', undefined, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.warn('Failed to clear auth token from configuration:', error);
        }
    }

    clearCookies(): void {
        this.cookies = null;
        try {
            vscode.workspace.getConfiguration().update('augment.cookies', undefined, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.warn('Failed to clear cookies from configuration:', error);
        }
    }

    clearAllAuth(): void {
        this.clearAuthToken();
        this.clearCookies();
    }
}
