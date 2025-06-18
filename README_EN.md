# Augment Usage Tracker

A VSCode extension that displays Augment AI usage statistics in the status bar.

> **Language**: English | [中文](README.md)

## ✨ Features

- 📊 **Real-time Monitoring**: Display current usage and limits in status bar
- 🔄 **Auto Refresh**: Automatically update usage data every 5 seconds
- 🍪 **Smart Authentication**: Automatic cookie extraction and expiration management
- 🌐 **One-click Login**: Automatically open browser and configure authentication
- 📈 **Usage Details**: Detailed usage statistics and remaining quota
- 🌍 **Multi-language**: Support for Chinese and English interface
- 🚪 **Secure Logout**: One-click clear all authentication data

## 🚀 Quick Start

1. After installing the plugin, run `Ctrl+Shift+P` → "🌐 Web Login (Auto)"
2. Login to your Augment account in the opened browser
3. Follow the prompts to complete authentication configuration
4. View real-time usage data in the status bar

## 🔧 Common Commands

Open command palette with `Ctrl+Shift+P`, then type:

- **🌐 Web Login (Auto)** - One-click authentication setup
- **Show Usage Details** - View detailed statistics
- **🔄 Manual Refresh** - Immediately update data
- **🍪 Check Cookie Status** - Check authentication status
- **🚪 Logout** - Clear all data

## 📊 Status Bar Explanation

```
$(pulse) Augment: 7/56 ● (12%)     # When data is available
$(circle-slash) Augment: Not logged in    # When not logged in
```

- **7/56**: Current usage / Total limit
- **●**: Real data indicator
- **(12%)**: Usage percentage
- **Click**: Configure authentication or view details

## ⚙️ Configuration Options

Search for "augment" in VSCode settings to configure:

- **Enable Tracker**: Turn functionality on/off
- **Refresh Interval**: Data update frequency (default 5 seconds)
- **Show in Status Bar**: Whether to display in status bar
- **Interface Language**: Chinese/English switching

## 🔐 Authentication Setup

### Automatic Login (Recommended)
1. `Ctrl+Shift+P` → "🌐 Web Login (Auto)"
2. Login to Augment account in browser
3. Follow prompts to complete configuration

### Manual Configuration
1. Login to https://app.augmentcode.com
2. `Ctrl+Shift+P` → "Setup Browser Cookies"
3. Follow prompts to enter cookie information

## 🔧 Advanced Features

### Cookie Management
- **Auto Detection**: Smart detection of cookie expiration status
- **Periodic Reminders**: Automatic reminders before expiration
- **One-click Refresh**: `Ctrl+Shift+P` → "🔄 Refresh Cookie"

### Other Features
- **Manual Refresh**: `Ctrl+Shift+P` → "🔄 Manual Refresh"
- **Language Switch**: `Ctrl+Shift+P` → "🌐 Set Language"
- **Secure Logout**: `Ctrl+Shift+P` → "🚪 Logout"

## 🔍 Troubleshooting

### Status bar shows "Not logged in"
1. Run `Ctrl+Shift+P` → "🌐 Web Login (Auto)"
2. Check authentication status: `Ctrl+Shift+P` → "Check Authentication Status"
3. Manual refresh data: `Ctrl+Shift+P` → "🔄 Manual Refresh"

### Data not updating
1. Check if plugin is enabled
2. Verify network connection
3. Check developer console (F12) for errors

## 🛡️ Privacy & Security

All authentication data is stored locally in VSCode and no data is sent to third parties.

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Enjoy real-time monitoring of Augment usage in VSCode!** 🚀
