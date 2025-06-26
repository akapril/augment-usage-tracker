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
    cookies?: string; // 添加cookies字段
    sessionInvalidated?: boolean; // 添加会话失效标志
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

export interface AugmentUserInfo {
    email?: string;
    name?: string;
    id?: string;
    plan?: string;
    avatar?: string;
    verified?: boolean;
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

    private loadCookies(): void {
        try {
            // Try to get cookies from VSCode configuration
            const cookies = vscode.workspace.getConfiguration().get('augment.cookies') as string;
            if (cookies && cookies.trim() !== '') {
                this.cookies = cookies.trim();
                console.log('🔄 从配置中恢复Cookie:', cookies.substring(0, 50) + '...');
            } else {
                console.log('🔍 未找到已保存的Cookie配置');
            }
        } catch (error) {
            console.warn('❌ 加载Cookie配置失败:', error);
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

            // 提取响应中的cookies
            const responseCookies = this.extractCookiesFromResponse(response);
            if (responseCookies && responseCookies.length > 0) {
                console.log(`🍪 从响应中获取到新的cookies:`, responseCookies.substring(0, 100) + '...');
                await this.updateCookiesFromResponse(responseCookies);
            }

            console.log(`📡 Augment API Response:`, {
                url,
                status: response.status,
                statusText: response.statusText,
                duration: `${duration}ms`,
                headers: Object.fromEntries(response.headers.entries()),
                hasCookies: responseCookies ? 'Yes' : 'No',
                timestamp: new Date().toISOString()
            });

            if (response.status === 401) {
                console.warn('🔒 Authentication failed - token may be invalid or expired');

                // 检查是否是会话失效（在其他地方登录导致）
                const sessionInvalidated = await this.detectSessionInvalidation(response);
                if (sessionInvalidated) {
                    console.warn('🚨 检测到会话失效，可能在其他地方登录了');
                    return {
                        success: false,
                        error: 'SESSION_INVALIDATED',
                        sessionInvalidated: true
                    };
                }

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
                data,
                cookies: responseCookies || undefined // 将cookies包含在响应中
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

    async parseUserResponse(response: AugmentApiResponse): Promise<AugmentUserInfo | null> {
        if (!response.success || !response.data) {
            return null;
        }

        try {
            const data = response.data;
            console.log('🔍 [parseUserResponse] 原始用户数据:', JSON.stringify(data, null, 2));

            // 处理plan字段，确保是字符串格式
            let planValue = data.plan || data.planType || data.subscriptionType;
            if (planValue && typeof planValue === 'object') {
                console.log('📋 [parseUserResponse] Plan是对象类型:', planValue);
                // 如果plan是对象，尝试提取有用信息
                planValue = planValue.name || planValue.type || planValue.title || JSON.stringify(planValue);
                console.log('📋 [parseUserResponse] 处理后的Plan:', planValue);
            }

            // 基于HAR文件分析的用户API响应格式
            const userInfo = {
                email: data.email || data.emailAddress || data.userEmail,
                name: data.name || data.displayName || data.fullName || data.username,
                id: data.id || data.userId || data.user_id,
                plan: planValue ? String(planValue) : undefined,
                avatar: data.avatar || data.avatarUrl || data.profileImage,
                verified: data.verified || data.emailVerified || false
            };

            console.log('✅ [parseUserResponse] 解析后的用户信息:', userInfo);
            return userInfo;
        } catch (error) {
            console.error('❌ [parseUserResponse] 解析用户响应错误:', error);
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
            prompt: '请输入您的Augment session cookies',
            placeHolder: '从浏览器复制cookie，支持完整cookie字符串或单独的session值',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Cookie不能为空';
                }

                const trimmed = value.trim();

                // 检查是否包含_session或者是URL编码的session格式
                if (!trimmed.includes('_session=') && !trimmed.startsWith('eyJ')) {
                    return '无效的Cookie格式 - 应包含_session=或以eyJ开头的session值';
                }

                // 检查长度是否合理
                if (trimmed.length < 50) {
                    return 'Cookie值太短，请检查是否完整';
                }

                return null;
            }
        });

        if (cookies) {
            console.log('🍪 用户输入的Cookie:', cookies.substring(0, 50) + '...');
            await this.setCookies(cookies.trim());
            console.log('✅ Cookie已保存到API客户端');
            return true;
        }
        console.log('❌ 用户取消了Cookie输入');
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

    /**
     * 邀请团队成员
     * @param emails 邮箱地址数组
     * @returns API响应结果
     */
    async inviteTeamMembers(emails: string[]): Promise<AugmentApiResponse> {
        if (!emails || emails.length === 0) {
            return {
                success: false,
                error: '邮箱列表不能为空'
            };
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emails.filter(email => !emailRegex.test(email.trim()));

        if (invalidEmails.length > 0) {
            return {
                success: false,
                error: `无效的邮箱地址: ${invalidEmails.join(', ')}`
            };
        }

        // 清理邮箱地址（去除空格）
        const cleanedEmails = emails.map(email => email.trim());

        try {
            console.log(`📧 正在邀请团队成员:`, cleanedEmails);

            const response = await this.makeRequest('/team/invite', {
                method: 'POST',
                body: JSON.stringify({ emails: cleanedEmails })
            });

            if (response.success) {
                console.log(`✅ 团队邀请发送成功:`, {
                    invitedCount: cleanedEmails.length,
                    emails: cleanedEmails
                });
            } else {
                console.error(`❌ 团队邀请失败:`, response.error);
            }

            return response;
        } catch (error: any) {
            console.error(`🚨 团队邀请请求失败:`, error);
            return {
                success: false,
                error: `团队邀请失败: ${error?.message || error}`
            };
        }
    }

    /**
     * 监控邮箱并自动接受团队邀请
     * @param email 邮箱地址
     * @param epin 邮箱PIN码
     * @returns 监控结果
     */
    async monitorAndAcceptInvitations(email: string, epin: string = ''): Promise<AugmentApiResponse> {
        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return {
                success: false,
                error: '无效的邮箱地址'
            };
        }

        try {
            console.log(`📧 开始监控邮箱邀请:`, email);

            // 获取邮箱列表
            const mailListUrl = `https://tempmail.plus/api/mails?email=${encodeURIComponent(email)}&limit=20&epin=${epin}`;
            const mailListResponse = await fetch(mailListUrl);

            if (!mailListResponse.ok) {
                return {
                    success: false,
                    error: `获取邮箱列表失败: ${mailListResponse.status}`
                };
            }

            const mailListData = await mailListResponse.json();

            if (!mailListData.result || !mailListData.mail_list) {
                return {
                    success: false,
                    error: '邮箱列表格式错误'
                };
            }

            // 查找Augment邀请邮件
            const invitationMails = mailListData.mail_list.filter((mail: any) =>
                mail.from_mail && (
                    mail.from_mail.includes('augmentcode.com') ||
                    mail.from_mail.includes('auggie@')
                ) && (
                    mail.subject && (
                        mail.subject.toLowerCase().includes('invite') ||
                        mail.subject.toLowerCase().includes('team') ||
                        mail.subject.toLowerCase().includes('join')
                    )
                )
            );

            if (invitationMails.length === 0) {
                return {
                    success: true,
                    data: {
                        message: '未找到团队邀请邮件',
                        checked: mailListData.mail_list.length,
                        invitations: 0
                    }
                };
            }

            console.log(`📬 找到 ${invitationMails.length} 封邀请邮件`);

            const processedInvitations = [];

            // 处理每封邀请邮件
            for (const mail of invitationMails) {
                try {
                    // 获取邮件内容
                    const mailContentUrl = `https://tempmail.plus/api/mails/${mail.mail_id}?email=${encodeURIComponent(email)}&epin=${epin}`;
                    const mailContentResponse = await fetch(mailContentUrl);

                    if (!mailContentResponse.ok) {
                        console.warn(`获取邮件内容失败: ${mail.mail_id}`);
                        continue;
                    }

                    const mailContent = await mailContentResponse.json();

                    if (!mailContent.result) {
                        console.warn(`邮件内容格式错误: ${mail.mail_id}`);
                        continue;
                    }

                    // 提取邀请链接
                    const invitationLink = this.extractInvitationLink(mailContent.html || mailContent.text || '');

                    if (invitationLink) {
                        console.log(`🔗 找到邀请链接:`, invitationLink);

                        // 自动访问邀请链接
                        const acceptResult = await this.acceptInvitation(invitationLink);

                        processedInvitations.push({
                            mailId: mail.mail_id,
                            subject: mail.subject,
                            from: mail.from_mail,
                            link: invitationLink,
                            accepted: acceptResult.success,
                            error: acceptResult.error
                        });
                    }
                } catch (error) {
                    console.error(`处理邮件失败: ${mail.mail_id}`, error);
                }
            }

            return {
                success: true,
                data: {
                    message: `处理完成，共处理 ${processedInvitations.length} 个邀请`,
                    totalMails: mailListData.mail_list.length,
                    invitationMails: invitationMails.length,
                    processedInvitations: processedInvitations,
                    acceptedCount: processedInvitations.filter(inv => inv.accepted).length
                }
            };

        } catch (error: any) {
            console.error(`🚨 监控邀请失败:`, error);
            return {
                success: false,
                error: `监控邀请失败: ${error?.message || error}`
            };
        }
    }

    /**
     * 从邮件内容中提取邀请链接
     * @param content 邮件内容
     * @returns 邀请链接或null
     */
    private extractInvitationLink(content: string): string | null {
        // 匹配Augment邀请链接的正则表达式
        const linkPatterns = [
            /https:\/\/auth\.augmentcode\.com\/invitations[^\s"'>]*/gi,
            /https:\/\/growth\.augmentcode\.com\/e\/c\/[^\s"'>]*/gi
        ];

        for (const pattern of linkPatterns) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                return matches[0];
            }
        }

        return null;
    }

    /**
     * 自动接受邀请
     * @param invitationLink 邀请链接
     * @returns 接受结果
     */
    private async acceptInvitation(invitationLink: string): Promise<AugmentApiResponse> {
        try {
            console.log(`🤝 正在接受邀请:`, invitationLink);

            // 访问邀请链接
            const response = await fetch(invitationLink, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            });

            if (response.ok) {
                console.log(`✅ 邀请链接访问成功: ${response.status}`);
                return {
                    success: true,
                    data: {
                        status: response.status,
                        url: invitationLink,
                        message: '邀请已自动接受'
                    }
                };
            } else {
                console.warn(`⚠️ 邀请链接访问失败: ${response.status}`);
                return {
                    success: false,
                    error: `邀请链接访问失败: ${response.status} ${response.statusText}`
                };
            }

        } catch (error: any) {
            console.error(`🚨 接受邀请失败:`, error);
            return {
                success: false,
                error: `接受邀请失败: ${error?.message || error}`
            };
        }
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

    /**
     * 从HTTP响应中提取cookies
     * @param response HTTP响应对象
     * @returns 提取的cookies字符串，如果没有则返回null
     */
    private extractCookiesFromResponse(response: Response): string | null {
        try {
            const setCookieHeaders: string[] = [];

            // 遍历响应头，查找Set-Cookie头
            for (const [name, value] of response.headers.entries()) {
                if (name.toLowerCase() === 'set-cookie') {
                    setCookieHeaders.push(value);
                    console.log(`🍪 [extractCookiesFromResponse] 发现Set-Cookie头:`, value.substring(0, 100) + '...');
                }
            }

            if (setCookieHeaders.length === 0) {
                console.log('ℹ️ [extractCookiesFromResponse] 响应中没有Set-Cookie头');
                return null;
            }

            // 解析Set-Cookie头，提取cookie名称和值
            const cookies: string[] = [];

            for (const setCookieHeader of setCookieHeaders) {
                // Set-Cookie头的格式: name=value; Path=/; Domain=.example.com; HttpOnly; Secure
                // 我们只需要 name=value 部分

                // 首先按分号分割，第一部分是 name=value
                const parts = setCookieHeader.split(';');
                const nameValuePart = parts[0].trim();

                // 验证格式是否正确
                if (nameValuePart.includes('=')) {
                    const [name, ...valueParts] = nameValuePart.split('=');
                    const value = valueParts.join('='); // 处理值中可能包含=的情况

                    if (name && value) {
                        const cookieString = `${name.trim()}=${value.trim()}`;
                        cookies.push(cookieString);
                        console.log(`🍪 [extractCookiesFromResponse] 解析cookie:`, cookieString.substring(0, 100) + '...');
                    }
                }
            }

            if (cookies.length === 0) {
                console.warn('⚠️ [extractCookiesFromResponse] 无法解析任何有效的cookie');
                return null;
            }

            const cookieString = cookies.join('; ');
            console.log(`✅ [extractCookiesFromResponse] 成功提取 ${cookies.length} 个cookies:`, cookieString.substring(0, 200) + '...');

            return cookieString;

        } catch (error) {
            console.error('❌ [extractCookiesFromResponse] 提取cookies失败:', error);
            return null;
        }
    }

    /**
     * 更新本地cookies，合并新的cookies
     * @param newCookies 新的cookies字符串
     */
    private async updateCookiesFromResponse(newCookies: string): Promise<void> {
        try {
            if (!newCookies || newCookies.trim() === '') {
                console.log('ℹ️ [updateCookiesFromResponse] 没有新的cookies需要更新');
                return;
            }

            console.log(`🔄 [updateCookiesFromResponse] 开始更新cookies...`);
            console.log(`📥 [updateCookiesFromResponse] 新cookies:`, newCookies.substring(0, 200) + '...');

            let updatedCookies = newCookies.trim();

            // 如果已有cookies，需要智能合并
            if (this.cookies && this.cookies.trim() !== '') {
                console.log(`📋 [updateCookiesFromResponse] 现有cookies:`, this.cookies.substring(0, 200) + '...');

                const existingCookies = this.parseCookieString(this.cookies);
                const newCookiesParsed = this.parseCookieString(newCookies);

                console.log(`🔍 [updateCookiesFromResponse] 解析结果:`, {
                    existingKeys: Object.keys(existingCookies),
                    newKeys: Object.keys(newCookiesParsed)
                });

                // 合并cookies，新的覆盖旧的
                const mergedCookies = { ...existingCookies, ...newCookiesParsed };

                // 重新构建cookie字符串
                updatedCookies = Object.entries(mergedCookies)
                    .map(([name, value]) => `${name}=${value}`)
                    .join('; ');

                console.log(`🔄 [updateCookiesFromResponse] 合并完成:`, {
                    existing: Object.keys(existingCookies).length,
                    new: Object.keys(newCookiesParsed).length,
                    merged: Object.keys(mergedCookies).length,
                    updatedKeys: Object.keys(mergedCookies)
                });
            } else {
                console.log(`📝 [updateCookiesFromResponse] 首次设置cookies`);
            }

            // 更新内存中的cookies
            const oldCookies = this.cookies;
            this.cookies = updatedCookies;

            // 保存到配置中
            await this.setCookies(updatedCookies);

            console.log(`✅ [updateCookiesFromResponse] Cookies更新完成:`);
            console.log(`   旧cookies长度: ${oldCookies?.length || 0}`);
            console.log(`   新cookies长度: ${updatedCookies.length}`);
            console.log(`   新cookies预览: ${updatedCookies.substring(0, 150)}...`);

        } catch (error) {
            console.error('❌ [updateCookiesFromResponse] 更新cookies失败:', error);
        }
    }

    /**
     * 解析cookie字符串为对象
     * @param cookieString cookie字符串
     * @returns cookie对象
     */
    private parseCookieString(cookieString: string): Record<string, string> {
        const cookies: Record<string, string> = {};

        if (!cookieString || cookieString.trim() === '') {
            return cookies;
        }

        try {
            const cookiePairs = cookieString.split(';');

            for (const pair of cookiePairs) {
                const trimmedPair = pair.trim();
                const equalIndex = trimmedPair.indexOf('=');

                if (equalIndex > 0) {
                    const name = trimmedPair.substring(0, equalIndex).trim();
                    const value = trimmedPair.substring(equalIndex + 1).trim();
                    cookies[name] = value;
                }
            }
        } catch (error) {
            console.error('❌ [parseCookieString] 解析cookie字符串失败:', error);
        }

        return cookies;
    }

    /**
     * 获取用户信息并自动更新cookies
     * 这是专门用于定时刷新的方法
     */
    async getUserInfoWithCookieUpdate(): Promise<AugmentApiResponse> {
        console.log('🔄 [getUserInfoWithCookieUpdate] 开始获取用户信息并更新cookies...');

        const response = await this.makeRequest('/user');

        if (response.success && response.cookies) {
            console.log('✅ [getUserInfoWithCookieUpdate] 用户信息获取成功，cookies已自动更新');
        } else if (response.success) {
            console.log('ℹ️ [getUserInfoWithCookieUpdate] 用户信息获取成功，但响应中没有新的cookies');
        } else {
            console.warn('⚠️ [getUserInfoWithCookieUpdate] 用户信息获取失败:', response.error);
        }

        return response;
    }

    /**
     * 检测会话是否因为在其他地方登录而失效
     * @param response HTTP响应对象
     * @returns 是否检测到会话失效
     */
    private async detectSessionInvalidation(response: Response): Promise<boolean> {
        try {
            // 检查响应状态码
            if (response.status !== 401) {
                return false;
            }

            console.log('🔍 [detectSessionInvalidation] 检测到401状态码，分析会话失效原因...');

            // 如果有cookies但仍然401，很可能是会话冲突（在其他地方登录）
            if (this.cookies && this.cookies.length > 0) {
                console.log('🚨 [detectSessionInvalidation] 有cookies但仍401，可能在其他地方登录导致会话失效');
                return true;
            }

            // 如果没有cookies，可能是正常的未认证状态
            console.log('ℹ️ [detectSessionInvalidation] 没有cookies，可能是正常的未认证状态');
            return false;

        } catch (error) {
            console.error('❌ [detectSessionInvalidation] 检测会话失效时出错:', error);
            return false;
        }
    }

    /**
     * 尝试自动恢复会话
     * @returns 恢复是否成功
     */
    async attemptSessionRecovery(): Promise<boolean> {
        try {
            console.log('🔄 [attemptSessionRecovery] 尝试自动恢复会话...');

            // 清除当前的cookies
            this.cookies = null;

            // 尝试从配置中重新加载cookies
            const savedCookies = vscode.workspace.getConfiguration().get<string>('augment.cookies', '');
            if (savedCookies && savedCookies.trim() !== '') {
                await this.setCookies(savedCookies.trim());

                // 测试新的cookies是否有效
                const testResponse = await this.getUserInfo();
                if (testResponse.success) {
                    console.log('✅ [attemptSessionRecovery] 会话恢复成功');
                    return true;
                }
            }

            console.log('❌ [attemptSessionRecovery] 自动恢复失败');
            return false;
        } catch (error) {
            console.error('❌ [attemptSessionRecovery] 恢复会话时出错:', error);
            return false;
        }
    }
}
