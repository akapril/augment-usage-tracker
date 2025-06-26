/**
 * Rebrowser-Puppeteer 安装和运行脚本
 * 自动安装依赖并运行演示
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class ProjectSetup {
    constructor() {
        this.projectRoot = process.cwd();
        this.nodeModulesPath = path.join(this.projectRoot, 'node_modules');
    }

    /**
     * 检查Node.js版本
     */
    async checkNodeVersion() {
        console.log('🔍 检查Node.js版本...');
        
        try {
            const { stdout } = await execAsync('node --version');
            const version = stdout.trim();
            const majorVersion = parseInt(version.substring(1).split('.')[0]);
            
            console.log(`📦 当前Node.js版本: ${version}`);
            
            if (majorVersion < 16) {
                console.error('❌ 需要Node.js 16.0.0或更高版本');
                console.log('请访问 https://nodejs.org/ 下载最新版本');
                process.exit(1);
            }
            
            console.log('✅ Node.js版本检查通过');
            return true;
            
        } catch (error) {
            console.error('❌ 无法检查Node.js版本:', error.message);
            process.exit(1);
        }
    }

    /**
     * 检查依赖是否已安装
     */
    checkDependencies() {
        console.log('🔍 检查项目依赖...');
        
        if (!existsSync(this.nodeModulesPath)) {
            console.log('📦 依赖未安装，需要运行 npm install');
            return false;
        }
        
        // 检查关键依赖
        const requiredDeps = [
            'rebrowser-puppeteer',
            'user-agents',
            'proxy-agent'
        ];
        
        for (const dep of requiredDeps) {
            const depPath = path.join(this.nodeModulesPath, dep);
            if (!existsSync(depPath)) {
                console.log(`📦 缺少依赖: ${dep}`);
                return false;
            }
        }
        
        console.log('✅ 所有依赖已安装');
        return true;
    }

    /**
     * 安装依赖
     */
    async installDependencies() {
        console.log('📦 开始安装依赖...');
        
        return new Promise((resolve, reject) => {
            const npmInstall = spawn('npm', ['install'], {
                stdio: 'inherit',
                shell: true
            });
            
            npmInstall.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ 依赖安装完成');
                    resolve(true);
                } else {
                    console.error('❌ 依赖安装失败');
                    reject(new Error(`npm install failed with code ${code}`));
                }
            });
            
            npmInstall.on('error', (error) => {
                console.error('❌ 安装过程中发生错误:', error.message);
                reject(error);
            });
        });
    }

    /**
     * 创建必要的目录
     */
    createDirectories() {
        console.log('📁 创建必要的目录...');
        
        const directories = [
            'screenshots',
            'logs',
            'temp'
        ];
        
        directories.forEach(dir => {
            const dirPath = path.join(this.projectRoot, dir);
            if (!existsSync(dirPath)) {
                mkdirSync(dirPath, { recursive: true });
                console.log(`✅ 创建目录: ${dir}`);
            }
        });
    }

    /**
     * 运行指定的演示脚本
     */
    async runDemo(demoName) {
        console.log(`🚀 运行演示: ${demoName}`);
        
        const demoScripts = {
            'basic': 'src/basic-example.js',
            'advanced': 'src/advanced-example.js',
            'detection': 'src/detection-test.js',
            'cloudflare': 'src/cloudflare-test.js'
        };
        
        const scriptPath = demoScripts[demoName];
        if (!scriptPath) {
            console.error(`❌ 未知的演示: ${demoName}`);
            console.log('可用的演示:', Object.keys(demoScripts).join(', '));
            return false;
        }
        
        if (!existsSync(path.join(this.projectRoot, scriptPath))) {
            console.error(`❌ 演示脚本不存在: ${scriptPath}`);
            return false;
        }
        
        return new Promise((resolve, reject) => {
            const nodeProcess = spawn('node', [scriptPath], {
                stdio: 'inherit',
                shell: true
            });
            
            nodeProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ 演示 ${demoName} 运行完成`);
                    resolve(true);
                } else {
                    console.error(`❌ 演示 ${demoName} 运行失败 (退出码: ${code})`);
                    resolve(false);
                }
            });
            
            nodeProcess.on('error', (error) => {
                console.error(`❌ 运行演示时发生错误:`, error.message);
                reject(error);
            });
        });
    }

    /**
     * 显示使用帮助
     */
    showHelp() {
        console.log(`
🎯 Rebrowser-Puppeteer 演示项目

使用方法:
  node install-and-run.js [命令] [选项]

命令:
  setup              - 安装依赖并设置项目
  basic              - 运行基础演示
  advanced           - 运行高级演示
  detection          - 运行检测测试
  cloudflare         - 运行Cloudflare测试
  all                - 运行所有演示
  help               - 显示此帮助信息

示例:
  node install-and-run.js setup
  node install-and-run.js basic
  node install-and-run.js all

注意:
  - 首次运行请先执行 setup 命令
  - 确保已安装Node.js 16.0.0或更高版本
  - 演示过程中会打开浏览器窗口
        `);
    }

    /**
     * 运行所有演示
     */
    async runAllDemos() {
        console.log('🚀 运行所有演示...');
        
        const demos = ['basic', 'advanced', 'detection', 'cloudflare'];
        const results = [];
        
        for (const demo of demos) {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`开始运行: ${demo}`);
            console.log(`${'='.repeat(50)}`);
            
            try {
                const success = await this.runDemo(demo);
                results.push({ demo, success });
                
                if (success) {
                    console.log(`✅ ${demo} 演示完成`);
                } else {
                    console.log(`❌ ${demo} 演示失败`);
                }
                
                // 演示间隔
                if (demo !== demos[demos.length - 1]) {
                    console.log('\n⏳ 等待5秒后继续下一个演示...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                console.error(`❌ ${demo} 演示出错:`, error.message);
                results.push({ demo, success: false, error: error.message });
            }
        }
        
        // 显示总结
        console.log(`\n${'='.repeat(50)}`);
        console.log('📊 演示总结');
        console.log(`${'='.repeat(50)}`);
        
        results.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.demo}: ${result.success ? '成功' : '失败'}`);
            if (result.error) {
                console.log(`   错误: ${result.error}`);
            }
        });
        
        const successCount = results.filter(r => r.success).length;
        console.log(`\n总计: ${successCount}/${results.length} 个演示成功`);
    }
}

// 主函数
async function main() {
    const setup = new ProjectSetup();
    const command = process.argv[2] || 'help';
    
    console.log('🎯 Rebrowser-Puppeteer 演示项目');
    console.log(`执行命令: ${command}\n`);
    
    try {
        // 检查Node.js版本
        await setup.checkNodeVersion();
        
        switch (command) {
            case 'setup':
                console.log('🔧 开始项目设置...');
                
                if (!setup.checkDependencies()) {
                    await setup.installDependencies();
                }
                
                setup.createDirectories();
                console.log('✅ 项目设置完成！');
                console.log('\n现在可以运行演示了:');
                console.log('  node install-and-run.js basic');
                break;
                
            case 'basic':
            case 'advanced':
            case 'detection':
            case 'cloudflare':
                if (!setup.checkDependencies()) {
                    console.log('📦 依赖未安装，正在自动安装...');
                    await setup.installDependencies();
                }
                setup.createDirectories();
                await setup.runDemo(command);
                break;
                
            case 'all':
                if (!setup.checkDependencies()) {
                    console.log('📦 依赖未安装，正在自动安装...');
                    await setup.installDependencies();
                }
                setup.createDirectories();
                await setup.runAllDemos();
                break;
                
            case 'help':
            default:
                setup.showHelp();
                break;
        }
        
    } catch (error) {
        console.error('❌ 执行过程中发生错误:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main().catch(console.error);
