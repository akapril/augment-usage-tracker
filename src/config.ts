import * as vscode from 'vscode';

export class ConfigManager {
    private config!: vscode.WorkspaceConfiguration;

    constructor() {
        this.reloadConfig();
    }

    reloadConfig() {
        this.config = vscode.workspace.getConfiguration('augmentTracker');
    }

    isEnabled(): boolean {
        return this.config.get<boolean>('enabled', true);
    }

    getRefreshInterval(): number {
        return this.config.get<number>('refreshInterval', 60);
    }

    shouldShowInStatusBar(): boolean {
        return this.config.get<boolean>('showInStatusBar', true);
    }

    getClickAction(): string {
        return this.config.get<string>('clickAction', 'openWebsite');
    }

    async updateConfig(key: string, value: any) {
        await this.config.update(key, value, vscode.ConfigurationTarget.Global);
        this.reloadConfig();
    }
}
