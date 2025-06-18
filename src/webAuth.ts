import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';

export interface WebAuthResult {
    success: boolean;
    cookies?: string;
    error?: string;
}

export class WebAuthManager {
    private readonly AUGMENT_LOGIN_URL = 'https://app.augmentcode.com';
    private readonly CALLBACK_PORT = 3000;
    private server: http.Server | null = null;
    private apiClient: any = null;

    constructor(apiClient?: any) {
        // 接受可选的API客户端参数
        this.apiClient = apiClient;
    }

    setApiClient(apiClient: any) {
        this.apiClient = apiClient;
    }

    async authenticateWithWebLogin(): Promise<WebAuthResult> {
        try {
            // 显示进度提示
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Augment Web Authentication",
                cancellable: true
            }, async (progress, _token) => {
                
                progress.report({ increment: 0, message: "Opening Augment login page..." });
                
                // 打开登录页面
                const loginUri = vscode.Uri.parse(this.AUGMENT_LOGIN_URL);
                await vscode.env.openExternal(loginUri);
                
                progress.report({ increment: 25, message: "Please login in your browser..." });
                
                // 等待用户登录
                const loginChoice = await vscode.window.showInformationMessage(
                    '🌐 Please login to Augment in your browser, then click "Continue" when you reach the dashboard.',
                    { modal: false },
                    'Continue',
                    'Cancel'
                );
                
                if (loginChoice !== 'Continue') {
                    return { success: false, error: 'User cancelled authentication' };
                }
                
                progress.report({ increment: 50, message: "Waiting for cookie input..." });
                
                // 提示用户获取cookie（支持HttpOnly）
                const cookieInstructions = await vscode.window.showInformationMessage(
                    '🍪 获取Session Cookies（支持HttpOnly）:\n\n' +
                    '📋 方法1 - 开发者工具（推荐）:\n' +
                    '1. 按F12打开开发者工具\n' +
                    '2. 切换到Application/Storage标签页\n' +
                    '3. 左侧选择Cookies → app.augmentcode.com\n' +
                    '4. 找到_session cookie并复制其Value\n\n' +
                    '🔧 方法2 - Network标签页:\n' +
                    '1. 开发者工具 → Network标签页\n' +
                    '2. 刷新页面或访问/api/user\n' +
                    '3. 查看请求的Cookie请求头\n' +
                    '4. 复制_session=xxx部分',
                    '📋 手动输入Cookie',
                    '🔧 自动提取器',
                    '❌ 取消'
                );
                
                if (cookieInstructions === '❌ 取消') {
                    return { success: false, error: 'User cancelled cookie extraction' };
                }

                progress.report({ increment: 75, message: "Getting cookies..." });

                if (cookieInstructions === '🔧 自动提取器') {
                    return await this.startAutoSessionExtraction();
                } else if (cookieInstructions === '📋 手动输入Cookie') {
                    // 直接使用手动输入方法
                    return await this.manualCookieInput();
                } else {
                    return await this.manualCookieInput();
                }
            });
            
        } catch (error) {
            return {
                success: false,
                error: `Authentication failed: ${error}`
            };
        }
    }



    private async manualCookieInput(): Promise<WebAuthResult> {
        const cookies = await vscode.window.showInputBox({
            prompt: 'Paste your Augment cookies here',
            placeHolder: 'intercom-id-oiuh4kg0=...; _session=...; ajs_user_id=...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Cookies cannot be empty';
                }
                if (!value.includes('_session=')) {
                    return 'Invalid cookies - should contain _session=';
                }
                if (!value.includes('ajs_user_id=')) {
                    return 'Invalid cookies - should contain ajs_user_id=';
                }
                return null;
            }
        });

        if (cookies) {
            return {
                success: true,
                cookies: cookies.trim()
            };
        } else {
            return {
                success: false,
                error: 'No cookies provided'
            };
        }
    }

    async quickLogin(): Promise<WebAuthResult> {
        // 简化的登录流程
        const choice = await vscode.window.showQuickPick([
            {
                label: '🌐 Web Login',
                description: 'Open browser and login automatically',
                detail: 'Recommended for first-time setup'
            },
            {
                label: '🍪 Paste Cookies',
                description: 'Manually paste cookies from browser',
                detail: 'Quick option if you already have cookies'
            },
            {
                label: '🔑 API Token',
                description: 'Use API token instead',
                detail: 'For advanced users'
            }
        ], {
            placeHolder: 'Choose authentication method',
            ignoreFocusOut: true
        });

        if (!choice) {
            return { success: false, error: 'No authentication method selected' };
        }

        switch (choice.label) {
            case '🌐 Web Login':
                return await this.authenticateWithWebLogin();
            case '🍪 Paste Cookies':
                return await this.manualCookieInput();
            case '🔑 API Token':
                // 这里可以调用API token设置
                return { success: false, error: 'API token setup not implemented in this method' };
            default:
                return { success: false, error: 'Unknown authentication method' };
        }
    }

    async validateCookies(cookies: string): Promise<boolean> {
        // 简单的cookie格式验证
        const requiredCookies = ['_session', 'ajs_user_id'];
        return requiredCookies.every(cookieName => 
            cookies.includes(cookieName + '=')
        );
    }

    generateCookieExtractionScript(): string {
        return `
// 🍪 Augment Cookie Extractor Script
// Run this in browser console on app.augmentcode.com

(function() {
    console.log('🔍 Extracting Augment cookies...');
    
    const cookies = document.cookie;
    const domain = window.location.hostname;
    
    console.log('🌐 Domain:', domain);
    console.log('📊 Total cookies:', document.cookie.split(';').length);
    
    if (!cookies.includes('_session=')) {
        console.error('❌ No session cookie found. Please login first.');
        alert('❌ Please login to Augment first, then run this script again.');
        return null;
    }
    
    console.log('✅ Session cookie found!');
    console.log('📋 Cookies to copy:');
    console.log('--- COPY BELOW ---');
    console.log(cookies);
    console.log('--- COPY ABOVE ---');
    
    // Try to copy to clipboard
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(cookies).then(() => {
            console.log('✅ Cookies copied to clipboard!');
            alert('✅ Cookies copied to clipboard! Paste them in VSCode.');
        }).catch(err => {
            console.log('⚠️ Could not copy to clipboard:', err);
            alert('⚠️ Please manually copy the cookies from console.');
        });
    } else {
        console.log('⚠️ Clipboard not available. Please copy manually.');
        alert('⚠️ Please manually copy the cookies from console.');
    }
    
    return cookies;
})();`;
    }

    async startAutoSessionExtraction(): Promise<WebAuthResult> {
        return new Promise((resolve, reject) => {
            // 创建本地服务器监听回调
            this.server = http.createServer((req, res) => {
                const parsedUrl = url.parse(req.url || '', true);

                if (parsedUrl.pathname === '/extract-session') {
                    // 处理session提取请求
                    this.handleSessionExtraction(req, res, resolve, reject);
                } else if (parsedUrl.pathname === '/api-extract') {
                    // 处理API响应头提取
                    this.handleApiExtraction(req, res, resolve, reject);
                } else if (parsedUrl.pathname === '/configure-cookie') {
                    // 处理cookie配置请求
                    this.handleCookieConfiguration(req, res);
                } else {
                    // 提供Cookie提取页面
                    this.serveCookieExtractorPage(res);
                }
            });

            this.server.listen(this.CALLBACK_PORT, () => {
                // 打开浏览器到Cookie提取页面
                const extractorUrl = `http://localhost:${this.CALLBACK_PORT}`;
                vscode.env.openExternal(vscode.Uri.parse(extractorUrl));

                vscode.window.showInformationMessage(
                    `🔄 自动Cookie提取器已启动！\n\n` +
                    `1. 浏览器将打开提取页面\n` +
                    `2. 支持多种提取方法\n` +
                    `3. Cookie将自动传回VSCode\n\n` +
                    `如果浏览器未自动打开，请访问: http://localhost:${this.CALLBACK_PORT}`,
                    'OK'
                );

                // 设置超时
                setTimeout(() => {
                    this.cleanup();
                    reject(new Error('Authentication timeout (5 minutes)'));
                }, 300000); // 5分钟超时
            });

            this.server.on('error', (error) => {
                console.error('Server error:', error);
                this.cleanup();
                reject(error);
            });
        });
    }

    private handleSessionExtraction(req: http.IncomingMessage, res: http.ServerResponse, resolve: (value: WebAuthResult) => void, reject: (reason?: any) => void) {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (data.cookies && data.cookies.includes('_session=')) {
                        console.log('🍪 收到手动输入的Cookie:', data.cookies.substring(0, 50) + '...');
                        console.log('🔍 API客户端状态:', {
                            hasApiClient: !!this.apiClient,
                            apiClientType: this.apiClient ? typeof this.apiClient : 'undefined',
                            apiClientConstructor: this.apiClient ? this.apiClient.constructor.name : 'N/A'
                        });

                        // 立即配置到API客户端
                        try {
                            // 尝试多种方式获取API客户端
                            let apiClient = this.apiClient;

                            // 如果this.apiClient不可用，尝试通过全局方式获取
                            if (!apiClient && (global as any).augmentDetector) {
                                apiClient = (global as any).augmentDetector.apiClient;
                                console.log('🔄 通过全局方式获取API客户端');
                            }

                            // 如果还是不可用，尝试通过require方式获取
                            if (!apiClient) {
                                try {
                                    const vscode = require('vscode');
                                    const extension = vscode.extensions.getExtension('your-extension-id');
                                    if (extension && extension.exports && extension.exports.apiClient) {
                                        apiClient = extension.exports.apiClient;
                                        console.log('🔄 通过扩展exports获取API客户端');
                                    }
                                } catch (e) {
                                    console.log('🔄 无法通过扩展exports获取API客户端');
                                }
                            }

                            if (apiClient) {
                                console.log('🔧 正在配置Cookie到API客户端...');

                                // 检查setCookies方法是否存在
                                if (typeof apiClient.setCookies === 'function') {
                                    await apiClient.setCookies(data.cookies);
                                    console.log('✅ Cookie已配置到API客户端');

                                    // 验证cookie是否真的设置了
                                    if (typeof apiClient.hasCookies === 'function') {
                                        const hasCookies = apiClient.hasCookies();
                                        console.log('🔍 Cookie设置验证:', hasCookies);
                                    }

                                    // 测试API连接
                                    if (typeof apiClient.getCreditsInfo === 'function') {
                                        const testResult = await apiClient.getCreditsInfo();
                                        if (testResult.success) {
                                            console.log('✅ API连接测试成功');
                                        } else {
                                            console.warn('⚠️ API连接测试失败:', testResult.error);
                                        }
                                    } else {
                                        console.warn('⚠️ API客户端没有getCreditsInfo方法');
                                    }
                                } else {
                                    console.error('❌ API客户端没有setCookies方法');
                                }
                            } else {
                                console.warn('⚠️ API客户端不可用，Cookie将在后续配置');
                                console.log('🔍 WebAuthManager状态:', {
                                    hasThis: !!this,
                                    thisKeys: Object.keys(this),
                                    apiClientValue: this.apiClient
                                });
                            }
                        } catch (configError) {
                            console.error('❌ 配置Cookie到API客户端失败:', configError);
                            if (configError instanceof Error) {
                                console.error('❌ 错误详情:', {
                                    message: configError.message,
                                    stack: configError.stack
                                });
                            }
                        }

                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({ success: true, message: 'Cookies received and configured successfully' }));

                        this.cleanup();
                        resolve({
                            success: true,
                            cookies: data.cookies
                        });
                    } else {
                        res.writeHead(400, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({ success: false, message: 'No _session cookie found' }));

                        this.cleanup();
                        reject(new Error('No _session cookie found'));
                    }
                } catch (error) {
                    res.writeHead(400, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success: false, message: 'Invalid JSON' }));

                    this.cleanup();
                    reject(error);
                }
            });
        } else if (req.method === 'OPTIONS') {
            // 处理CORS预检请求
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end();
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
        }
    }

    private serveCookieExtractorPage(res: http.ServerResponse) {
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Augment Cookie 自动提取器</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .step {
            margin: 20px 0;
            padding: 15px;
            border-left: 4px solid #007acc;
            background: #f8f9fa;
            border-radius: 0 5px 5px 0;
        }
        .button {
            background: #007acc;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
            transition: background 0.3s;
        }
        .button:hover {
            background: #005a9e;
        }
        .button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .status {
            margin: 20px 0;
            padding: 15px;
            border-radius: 5px;
            display: none;
        }
        .status.success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .status.error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .status.info {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
        }
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .highlight {
            background: #fff3cd;
            padding: 10px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
            margin: 10px 0;
        }
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #007acc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🍪 Augment Cookie 配置中心</h1>
        <p>这个工具提供多种方式来获取和配置Augment的session cookie，选择最适合您的方法。</p>

        <div class="step">
            <h3>🎯 方法1: 直接输入Cookie（推荐）</h3>
            <p>如果您已经获取了Cookie，可以直接粘贴到下面的文本框中：</p>
            <textarea id="cookieInput" placeholder="粘贴您的Cookie内容...&#10;&#10;支持格式：&#10;• _session=eyJhbGciOiJIUzI1NiJ9...&#10;• 完整的Cookie字符串&#10;• 或者只是session值" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-family: monospace; font-size: 14px; margin: 10px 0;"></textarea>
            <button class="button" onclick="submitManualCookie()">✅ 配置Cookie</button>
            <button class="button" onclick="showCookieGuide()">📖 如何获取Cookie？</button>
        </div>

        <div class="step">
            <h3>🚀 方法2: 自动提取Cookie</h3>
            <p>首先确保您已经登录到Augment，然后选择自动提取方法：</p>
            <button class="button" onclick="openAugmentLogin()">🌐 打开 Augment 登录</button>
            <button class="button" id="apiExtractBtn" onclick="extractFromApi()">🚀 从API响应头提取</button>
            <button class="button" id="extractBtn" onclick="extractCookies()">🔄 从浏览器提取</button>
        </div>

        <div id="status" class="status">
            <span id="statusMessage"></span>
        </div>

        <div id="cookieGuide" class="step" style="display: none;">
            <h3>📋 Cookie获取详细教程</h3>
            <div class="highlight">
                <h4>🎯 方法A: 浏览器开发者工具（最可靠）</h4>
                <ol>
                    <li><strong>打开Augment网站</strong>：访问 <a href="https://app.augmentcode.com" target="_blank">app.augmentcode.com</a> 并确保已登录</li>
                    <li><strong>打开开发者工具</strong>：按 <code>F12</code> 键或右键页面选择"检查元素"</li>
                    <li><strong>导航到Cookie存储</strong>：
                        <ul>
                            <li>点击 <code>Application</code> 标签页</li>
                            <li>在左侧面板找到 <code>Storage</code> → <code>Cookies</code></li>
                            <li>点击 <code>https://app.augmentcode.com</code></li>
                        </ul>
                    </li>
                    <li><strong>复制Session Cookie</strong>：
                        <ul>
                            <li>在右侧找到名为 <code>_session</code> 的cookie</li>
                            <li>双击 <code>Value</code> 列中的值</li>
                            <li>按 <code>Ctrl+C</code> 复制</li>
                        </ul>
                    </li>
                    <li><strong>粘贴到上方文本框</strong>：返回此页面，粘贴到"方法1"的文本框中</li>
                </ol>

                <h4>🔧 方法B: Network标签页（备用方法）</h4>
                <ol>
                    <li>在开发者工具中切换到 <code>Network</code> 标签页</li>
                    <li>刷新Augment页面或访问任意功能</li>
                    <li>点击任意请求查看详情</li>
                    <li>在 <code>Request Headers</code> 中找到 <code>Cookie</code> 字段</li>
                    <li>复制整个Cookie字符串或只复制 <code>_session=xxx</code> 部分</li>
                </ol>

                <h4>💡 格式说明</h4>
                <p>支持以下任意格式：</p>
                <ul>
                    <li><code>_session=eyJhbGciOiJIUzI1NiJ9...</code> （推荐格式）</li>
                    <li><code>eyJhbGciOiJIUzI1NiJ9...</code> （只有session值）</li>
                    <li><code>_session=xxx; other_cookie=yyy</code> （完整Cookie字符串）</li>
                </ul>

                <h4>⚠️ 注意事项</h4>
                <ul>
                    <li>确保已经登录到Augment账户</li>
                    <li>Session值通常很长（100+字符），以 <code>eyJ</code> 开头</li>
                    <li>如果找不到_session，可能是HttpOnly cookie，请使用开发者工具方法</li>
                    <li>Cookie包含敏感信息，请妥善保管</li>
                </ul>
            </div>
            <button class="button" onclick="hideCookieGuide()">🔙 返回</button>
        </div>

        <div class="step">
            <h3>📋 提取方法说明</h3>
            <div class="highlight">
                <strong>🚀 API响应头提取（推荐）：</strong>
                <ul>
                    <li>直接从 <code>https://app.augmentcode.com/api/user</code> 的响应头提取</li>
                    <li>获取最新的 <code>_session</code> 值</li>
                    <li>更准确、更可靠</li>
                    <li>自动处理cookie格式</li>
                </ul>

                <strong>🔄 浏览器提取（备用）：</strong>
                <ul>
                    <li>从当前浏览器的cookie中提取</li>
                    <li>适用于API方法失败的情况</li>
                    <li>需要确保已在同一浏览器中登录</li>
                </ul>

                <strong>📋 手动提取（最后备用）：</strong>
                <ol>
                    <li>在Augment页面按 <code>F12</code> 打开开发者工具</li>
                    <li>切换到 <code>Network</code> 标签页</li>
                    <li>刷新页面或访问 <code>/api/user</code></li>
                    <li>查看请求的 <code>set-cookie</code> 响应头</li>
                    <li>复制 <code>_session</code> 的值</li>
                </ol>
            </div>
        </div>

        <div class="step">
            <h3>🔧 高级选项</h3>
            <p>如果您是开发者，可以使用我们的JavaScript提取脚本：</p>
            <button class="button" onclick="showExtractorScript()">📜 显示提取脚本</button>
            <div id="scriptContainer" style="display: none; margin-top: 15px;">
                <p>在Augment页面的控制台中运行以下脚本：</p>
                <textarea id="extractorScript" readonly style="width: 100%; height: 150px; font-family: monospace; font-size: 12px;"></textarea>
                <button class="button" onclick="copyScript()">📋 复制脚本</button>
            </div>
        </div>
    </div>

    <script>
        let isExtracting = false;

        function openAugmentLogin() {
            window.open('https://app.augmentcode.com', '_blank');
            showStatus('请在新窗口中完成登录，然后返回此页面使用任意方法获取Cookie', 'info');
        }

        function showCookieGuide() {
            document.getElementById('cookieGuide').style.display = 'block';
            document.getElementById('cookieGuide').scrollIntoView({ behavior: 'smooth' });
        }

        function hideCookieGuide() {
            document.getElementById('cookieGuide').style.display = 'none';
        }

        async function submitManualCookie() {
            const cookieInput = document.getElementById('cookieInput');
            const cookieValue = cookieInput.value.trim();

            if (!cookieValue) {
                showStatus('❌ 请先输入Cookie内容', 'error');
                cookieInput.focus();
                return;
            }

            // 验证Cookie格式
            const validation = validateCookieFormat(cookieValue);
            if (!validation.valid) {
                showStatus('❌ ' + validation.error, 'error');
                cookieInput.focus();
                return;
            }

            // 解析Cookie数据
            const parsedData = parseCookieData(cookieValue);
            showStatus('🔄 正在配置Cookie...', 'info');

            try {
                // 发送到VSCode
                await sendCookiesToVSCode(parsedData.cookies);
            } catch (error) {
                showStatus('❌ 配置失败: ' + error.message, 'error');
            }
        }

        function validateCookieFormat(cookieValue) {
            if (!cookieValue || cookieValue.trim().length === 0) {
                return { valid: false, error: 'Cookie不能为空' };
            }

            const trimmed = cookieValue.trim();

            // 检查是否包含_session
            if (!trimmed.includes('_session=')) {
                return { valid: false, error: '请确保包含_session cookie' };
            }

            // 提取session值
            const match = trimmed.match(/_session=([^;]+)/);
            if (!match) {
                return { valid: false, error: '无法提取_session值' };
            }

            const sessionValue = match[1];
            if (!sessionValue || sessionValue.length < 50) {
                return { valid: false, error: 'Session值太短，请检查是否完整' };
            }

            // 检查是否是Augment的URL编码session格式
            if (sessionValue.includes('%') && sessionValue.includes('.')) {
                // 这是Augment的标准格式：URL编码的payload + 签名
                return { valid: true };
            }

            // 检查是否是标准JWT格式
            if (sessionValue.startsWith('eyJ')) {
                const parts = sessionValue.split('.');
                if (parts.length === 3) {
                    return { valid: true };
                }
            }

            // 其他长度合理的session值也认为是有效的
            if (sessionValue.length >= 50) {
                return { valid: true };
            }

            return { valid: false, error: '无法识别的session格式' };
        }

        function parseCookieData(cookieValue) {
            const trimmed = cookieValue.trim();
            let sessionValue = '';
            let cookies = '';

            if (trimmed.includes('_session=')) {
                // 完整的cookie字符串
                cookies = trimmed;
                const match = trimmed.match(/_session=([^;]+)/);
                if (match) {
                    sessionValue = match[1];
                }
            } else if (trimmed.startsWith('eyJ')) {
                // 只有session值
                sessionValue = trimmed;
                cookies = '_session=' + sessionValue;
            }

            // 尝试解析JWT获取用户信息
            let userInfo = undefined;
            try {
                if (sessionValue.startsWith('eyJ')) {
                    const payload = sessionValue.split('.')[1];
                    const decoded = JSON.parse(atob(payload));
                    userInfo = {
                        userId: decoded.user_id,
                        email: decoded.email,
                        exp: decoded.exp
                    };
                    console.log('📊 解析的用户信息:', userInfo);
                }
            } catch (error) {
                console.log('⚠️ JWT解析失败，使用原始值:', error);
            }

            return {
                cookies,
                sessionValue,
                userInfo
            };
        }

        async function extractFromApi() {
            if (isExtracting) return;

            isExtracting = true;
            const apiExtractBtn = document.getElementById('apiExtractBtn');
            const originalText = apiExtractBtn.textContent;

            apiExtractBtn.disabled = true;
            apiExtractBtn.innerHTML = '<span class="spinner"></span> 正在从API提取...';

            showStatus('🚀 正在从API响应头提取_session...', 'info');

            try {
                // 首先获取当前页面的cookies作为基础
                const currentCookies = document.cookie;
                console.log('📋 Current cookies:', currentCookies);

                // 发送API提取请求
                const response = await fetch('/api-extract', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'extract-from-api',
                        cookies: currentCookies
                    })
                });

                const result = await response.json();
                console.log('📡 API extraction result:', result);

                if (result.success) {
                    showStatus('✅ 从API成功提取_session！VSCode将自动配置认证。', 'success');

                    // 自动关闭页面
                    setTimeout(() => {
                        if (confirm('认证配置成功！是否关闭此页面？')) {
                            window.close();
                        }
                    }, 3000);
                } else {
                    showStatus('❌ API提取失败: ' + result.message + '\\n\\n尝试使用浏览器提取方法', 'error');

                    // 提示用户尝试其他方法
                    setTimeout(() => {
                        if (confirm('API提取失败，是否尝试浏览器提取方法？')) {
                            extractCookies();
                        }
                    }, 2000);
                }

            } catch (error) {
                console.error('API提取错误:', error);
                showStatus('❌ API提取失败: ' + error.message + '\\n\\n请尝试浏览器提取方法', 'error');

                // 提示用户尝试其他方法
                setTimeout(() => {
                    if (confirm('API提取失败，是否尝试浏览器提取方法？')) {
                        extractCookies();
                    }
                }, 2000);
            } finally {
                isExtracting = false;
                apiExtractBtn.disabled = false;
                apiExtractBtn.textContent = originalText;
            }
        }

        async function extractCookies() {
            if (isExtracting) return;

            isExtracting = true;
            const extractBtn = document.getElementById('extractBtn');
            const originalText = extractBtn.textContent;

            extractBtn.disabled = true;
            extractBtn.innerHTML = '<span class="spinner"></span> 正在提取...';

            showStatus('正在尝试自动提取cookies...', 'info');

            try {
                // 方法1: 尝试从当前页面获取cookies（如果用户在同一浏览器中）
                let cookies = '';

                // 检查是否有可用的cookies
                if (document.cookie) {
                    cookies = document.cookie;
                    console.log('Found cookies:', cookies);
                }

                // 方法2: 提示用户手动获取cookies
                if (!cookies || !cookies.includes('_session=')) {
                    showStatus('未能自动获取cookies，请使用手动方法', 'error');

                    // 显示详细的手动指导
                    const manualInstructions = \`
🍪 HttpOnly Cookie提取指南：

📋 方法1 - Application标签页（推荐）：
1. 打开新标签页访问: https://app.augmentcode.com
2. 确保您已登录
3. 按F12打开开发者工具
4. 切换到Application/Storage标签页
5. 左侧选择Cookies → app.augmentcode.com
6. 找到_session cookie，复制其Value值

🔧 方法2 - Network标签页：
1. 开发者工具 → Network标签页
2. 刷新页面或访问任意API
3. 点击任意请求
4. 查看Request Headers中的Cookie
5. 复制_session=xxx部分

⚠️ 注意：如果_session是HttpOnly cookie，
document.cookie无法获取，请使用上述方法。
                    \`;

                    if (confirm(manualInstructions + '\\n\\n点击确定打开Augment页面')) {
                        window.open('https://app.augmentcode.com', '_blank');
                    }

                    // 提供手动输入选项
                    setTimeout(() => {
                        const manualCookies = prompt('请粘贴从Augment页面获取的cookies:');
                        if (manualCookies && manualCookies.includes('_session=')) {
                            sendCookiesToVSCode(manualCookies);
                        } else if (manualCookies) {
                            showStatus('❌ 无效的cookies - 必须包含_session=', 'error');
                        }
                    }, 1000);

                } else {
                    // 发送cookies到VSCode
                    await sendCookiesToVSCode(cookies);
                }

            } catch (error) {
                console.error('提取错误:', error);
                showStatus('❌ 自动提取失败: ' + error.message, 'error');
            } finally {
                isExtracting = false;
                extractBtn.disabled = false;
                extractBtn.textContent = originalText;
            }
        }

        async function sendCookiesToVSCode(cookies) {
            try {
                showStatus('正在发送cookies到VSCode...', 'info');

                const response = await fetch('/extract-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ cookies: cookies })
                });

                const result = await response.json();

                if (result.success) {
                    showStatus('✅ Cookie提取成功！VSCode将自动配置认证。您可以关闭此页面。', 'success');

                    // 自动关闭页面
                    setTimeout(() => {
                        if (confirm('认证配置成功！是否关闭此页面？')) {
                            window.close();
                        }
                    }, 3000);
                } else {
                    showStatus('❌ ' + result.message, 'error');
                }
            } catch (error) {
                console.error('发送错误:', error);
                showStatus('❌ 发送失败: ' + error.message, 'error');
            }
        }

        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            const statusMessage = document.getElementById('statusMessage');

            statusMessage.textContent = message;
            statusDiv.className = 'status ' + type;
            statusDiv.style.display = 'block';

            // 自动隐藏info类型的消息
            if (type === 'info') {
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 5000);
            }
        }

        function showExtractorScript() {
            const container = document.getElementById('scriptContainer');
            const textarea = document.getElementById('extractorScript');

            const script = \`// Augment Cookie Extractor
(function() {
    console.log('🔍 正在提取Augment cookies...');

    const cookies = document.cookie;
    const domain = window.location.hostname;

    console.log('🌐 域名:', domain);
    console.log('📊 Cookie数量:', document.cookie.split(';').length);

    if (!cookies.includes('_session=')) {
        console.error('❌ 未找到session cookie。请先登录。');
        alert('❌ 请先登录Augment，然后重新运行此脚本。');
        return null;
    }

    console.log('✅ 找到session cookie！');
    console.log('📋 要复制的Cookies:');
    console.log('--- 复制下面的内容 ---');
    console.log(cookies);
    console.log('--- 复制上面的内容 ---');

    // 尝试复制到剪贴板
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(cookies).then(() => {
            console.log('✅ Cookies已复制到剪贴板！');
            alert('✅ Cookies已复制到剪贴板！请在VSCode中粘贴。');
        }).catch(err => {
            console.log('⚠️ 无法复制到剪贴板:', err);
            alert('⚠️ 请手动从控制台复制cookies。');
        });
    } else {
        console.log('⚠️ 剪贴板不可用。请手动复制。');
        alert('⚠️ 请手动从控制台复制cookies。');
    }

    return cookies;
})();\`;

            textarea.value = script;
            container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }

        function copyScript() {
            const textarea = document.getElementById('extractorScript');
            textarea.select();
            document.execCommand('copy');
            showStatus('✅ 脚本已复制到剪贴板', 'success');
        }

        // 页面加载时的提示
        window.onload = function() {
            showStatus('欢迎使用Augment Cookie自动提取器！请先确保您已登录Augment。', 'info');
        };
    </script>
</body>
</html>
        `;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    }

    private handleApiExtraction(req: http.IncomingMessage, res: http.ServerResponse, resolve: (value: WebAuthResult) => void, _reject: (reason?: any) => void) {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    // 处理API提取请求

                    if (data.action === 'extract-from-api') {
                        // 尝试从API响应头提取_session
                        const sessionCookie = await this.extractSessionFromApi(data.cookies);

                        if (sessionCookie) {
                            res.writeHead(200, {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            });
                            res.end(JSON.stringify({
                                success: true,
                                message: 'Session extracted from API response',
                                sessionCookie: sessionCookie
                            }));

                            this.cleanup();
                            resolve({
                                success: true,
                                cookies: sessionCookie
                            });
                        } else {
                            res.writeHead(400, {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            });
                            res.end(JSON.stringify({
                                success: false,
                                message: 'Failed to extract session from API'
                            }));
                        }
                    } else {
                        res.writeHead(400, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({
                            success: false,
                            message: 'Invalid action'
                        }));
                    }
                } catch (error) {
                    console.error('API extraction error:', error);
                    res.writeHead(500, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Server error: ' + error
                    }));
                }
            });
        } else if (req.method === 'OPTIONS') {
            // 处理CORS预检请求
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end();
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
        }
    }

    private async extractSessionFromApi(existingCookies?: string): Promise<string | null> {
        try {
            console.log('🔍 Attempting to extract session from API...');

            // 使用Node.js的https模块进行请求
            return new Promise((resolve) => {
                const options = {
                    hostname: 'app.augmentcode.com',
                    port: 443,
                    path: '/api/user',
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                        'Referer': 'https://app.augmentcode.com/',
                        'Origin': 'https://app.augmentcode.com',
                        ...(existingCookies && { 'Cookie': existingCookies })
                    }
                };

                const req = https.request(options, (res) => {
                    console.log('📡 API Response status:', res.statusCode);
                    console.log('📡 API Response headers:', res.headers);

                    // 检查set-cookie响应头
                    const setCookieHeaders = res.headers['set-cookie'];
                    if (setCookieHeaders) {
                        console.log('🍪 Found set-cookie headers:', setCookieHeaders);

                        // 查找_session cookie
                        for (const cookieHeader of setCookieHeaders) {
                            const sessionMatch = cookieHeader.match(/_session=([^;]+)/);
                            if (sessionMatch) {
                                const sessionValue = sessionMatch[1];
                                console.log('✅ Extracted _session value:', sessionValue.substring(0, 20) + '...');

                                // 构建完整的cookie字符串
                                const fullCookie = `_session=${sessionValue}`;

                                // 如果有其他有用的cookies，也包含进来
                                if (existingCookies) {
                                    const otherCookies = existingCookies.split(';')
                                        .map(c => c.trim())
                                        .filter(c => !c.startsWith('_session='))
                                        .join('; ');

                                    resolve(otherCookies ? `${fullCookie}; ${otherCookies}` : fullCookie);
                                    return;
                                }

                                resolve(fullCookie);
                                return;
                            }
                        }
                    }

                    // 读取响应体
                    let responseBody = '';
                    res.on('data', (chunk) => {
                        responseBody += chunk;
                    });

                    res.on('end', () => {
                        console.log('📄 API Response body length:', responseBody.length);

                        // 检查是否需要登录
                        if (res.statusCode === 401 || responseBody.includes('login') || responseBody.includes('unauthorized')) {
                            console.log('❌ API indicates user is not logged in');
                            resolve(null);
                            return;
                        }

                        console.log('⚠️ No _session found in API response');
                        resolve(null);
                    });
                });

                req.on('error', (error) => {
                    console.error('❌ Error extracting session from API:', error);
                    resolve(null);
                });

                // 设置超时
                req.setTimeout(10000, () => {
                    console.error('❌ API request timeout');
                    req.destroy();
                    resolve(null);
                });

                req.end();
            });

        } catch (error) {
            console.error('❌ Error extracting session from API:', error);
            return null;
        }
    }

    private async handleCookieConfiguration(req: http.IncomingMessage, res: http.ServerResponse) {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    console.log('🔧 收到配置请求:', data.cookies ? data.cookies.substring(0, 50) + '...' : 'no cookies');

                    if (data.cookies && data.cookies.includes('_session=')) {
                        // 尝试多种方式获取API客户端
                        let apiClient = this.apiClient;

                        // 如果this.apiClient不可用，尝试通过全局方式获取
                        if (!apiClient && (global as any).augmentDetector) {
                            apiClient = (global as any).augmentDetector.apiClient;
                            console.log('🔄 通过全局方式获取API客户端');
                        }

                        if (apiClient && typeof apiClient.setCookies === 'function') {
                            try {
                                await apiClient.setCookies(data.cookies);
                                console.log('✅ Cookie已通过配置端点设置到API客户端');

                                // 验证设置
                                if (typeof apiClient.hasCookies === 'function') {
                                    const hasCookies = apiClient.hasCookies();
                                    console.log('🔍 配置端点Cookie验证:', hasCookies);
                                }

                                // 测试连接
                                if (typeof apiClient.getCreditsInfo === 'function') {
                                    const testResult = await apiClient.getCreditsInfo();
                                    console.log('🔍 配置端点API测试:', testResult.success ? '成功' : '失败');
                                }

                                res.writeHead(200, {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                });
                                res.end(JSON.stringify({
                                    success: true,
                                    message: 'Cookie configured successfully via configuration endpoint'
                                }));
                                return;
                            } catch (error) {
                                console.error('❌ 配置端点设置Cookie失败:', error);
                            }
                        } else {
                            console.warn('⚠️ 配置端点：API客户端不可用或缺少setCookies方法');
                        }
                    }

                    res.writeHead(400, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success: false, message: 'Configuration failed' }));

                } catch (error) {
                    console.error('❌ 配置端点处理错误:', error);
                    res.writeHead(500, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success: false, message: 'Server error' }));
                }
            });
        } else if (req.method === 'OPTIONS') {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end();
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
        }
    }

    private cleanup() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }

    dispose() {
        this.cleanup();
    }
}
