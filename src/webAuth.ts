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
    private readonly AUGMENT_DASHBOARD_URL = 'https://app.augmentcode.com/dashboard';
    private readonly CALLBACK_PORT = 3000;
    private server: http.Server | null = null;

    async authenticateWithWebLogin(): Promise<WebAuthResult> {
        try {
            // 显示进度提示
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Augment Web Authentication",
                cancellable: true
            }, async (progress, token) => {
                
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
                
                // 提示用户获取cookie
                const cookieInstructions = await vscode.window.showInformationMessage(
                    '🍪 Now we need to get your session cookies:\n\n' +
                    '1. In your browser, press F12 to open Developer Tools\n' +
                    '2. Go to Application tab → Cookies → app.augmentcode.com\n' +
                    '3. Copy all cookie values\n\n' +
                    'Or use our automatic cookie extractor!',
                    'Auto Extract',
                    'Manual Input',
                    'Cancel'
                );
                
                if (cookieInstructions === 'Cancel') {
                    return { success: false, error: 'User cancelled cookie extraction' };
                }
                
                progress.report({ increment: 75, message: "Getting cookies..." });
                
                if (cookieInstructions === 'Auto Extract') {
                    return await this.startAutoSessionExtraction();
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

    private async autoExtractCookies(): Promise<WebAuthResult> {
        try {
            // 显示JavaScript代码让用户在浏览器控制台执行
            const jsCode = `
// Augment Cookie Extractor
(function() {
    const cookies = document.cookie;
    if (cookies.includes('_session=')) {
        console.log('✅ Cookies extracted successfully!');
        console.log('📋 Copy the following line:');
        console.log('COOKIES_START');
        console.log(cookies);
        console.log('COOKIES_END');
        
        // 尝试复制到剪贴板
        if (navigator.clipboard) {
            navigator.clipboard.writeText(cookies).then(() => {
                console.log('✅ Cookies copied to clipboard!');
            }).catch(() => {
                console.log('⚠️ Please manually copy the cookies above');
            });
        }
        
        alert('✅ Cookies extracted! Check console and paste in VSCode.');
        return cookies;
    } else {
        console.log('❌ No valid session found. Please make sure you are logged in.');
        alert('❌ Please login first, then run this script again.');
        return null;
    }
})();`;

            // 显示JavaScript代码
            const doc = await vscode.workspace.openTextDocument({
                content: jsCode,
                language: 'javascript'
            });
            await vscode.window.showTextDocument(doc);
            
            const instruction = await vscode.window.showInformationMessage(
                '🔧 Auto Cookie Extractor:\n\n' +
                '1. Copy the JavaScript code shown above\n' +
                '2. In your browser (on app.augmentcode.com), press F12\n' +
                '3. Go to Console tab\n' +
                '4. Paste and press Enter\n' +
                '5. Copy the cookies output\n' +
                '6. Click "Paste Cookies" below',
                'Paste Cookies',
                'Cancel'
            );
            
            if (instruction === 'Paste Cookies') {
                return await this.manualCookieInput();
            } else {
                return { success: false, error: 'User cancelled auto extraction' };
            }
            
        } catch (error) {
            return {
                success: false,
                error: `Auto extraction failed: ${error}`
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

            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.cookies && data.cookies.includes('_session=')) {
                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({ success: true, message: 'Cookies received successfully' }));

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
        <h1>🍪 Augment Cookie 自动提取器</h1>
        <p>这个工具将帮助您自动提取Augment的session cookie，无需手动复制粘贴。</p>

        <div class="step">
            <h3>步骤 1: 登录 Augment</h3>
            <p>首先确保您已经登录到Augment。如果还没有登录，请点击下面的按钮。</p>
            <button class="button" onclick="openAugmentLogin()">🌐 打开 Augment 登录</button>
        </div>

        <div class="step">
            <h3>步骤 2: 自动提取 Cookie</h3>
            <p>登录完成后，选择提取方法：</p>
            <button class="button" id="apiExtractBtn" onclick="extractFromApi()">🚀 从API响应头提取（推荐）</button>
            <button class="button" id="extractBtn" onclick="extractCookies()">🔄 从浏览器提取</button>
        </div>

        <div id="status" class="status">
            <span id="statusMessage"></span>
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
            showStatus('请在新窗口中完成登录，然后返回此页面点击"自动提取 Cookie"', 'info');
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
请按照以下步骤手动获取cookies：

1. 打开新标签页访问: https://app.augmentcode.com
2. 确保您已登录
3. 按F12打开开发者工具
4. 在Console中输入: document.cookie
5. 复制输出结果
6. 点击下面的"手动输入Cookie"按钮
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

    private handleApiExtraction(req: http.IncomingMessage, res: http.ServerResponse, resolve: (value: WebAuthResult) => void, reject: (reason?: any) => void) {
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
