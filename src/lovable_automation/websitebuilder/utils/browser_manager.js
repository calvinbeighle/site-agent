const { chromium } = require('playwright');
const { join } = require('path');
const { execSync } = require('child_process');
const { homedir } = require('os');

class BrowserManager {
    constructor(userDataDir) {
        this.userDataDir = join(homedir(), '.chromium-profile');
        this.browser = null;
    }

    async initialize() {
        try {
        if (this.browser) {
                return this.browser;
        }

            // Launch Chromium with persistent context
            console.log('Launching browser with custom configuration...');
        this.browser = await chromium.launchPersistentContext(this.userDataDir, {
            headless: false,
                channel: 'chrome',
                args: ['--disable-web-security'],
                ignoreDefaultArgs: ['--enable-automation']
        });

            // Handle disconnection without automatic cleanup
        this.browser.on('disconnected', async () => {
            console.log('Browser disconnected, attempting to reconnect...');
                this.browser = null;
            await this.initialize();
        });

        return this.browser;
        } catch (error) {
            console.error('Error initializing browser:', error);
            throw error;
        }
    }

    // Modified to not automatically close the browser
    async cleanup() {
        console.log('Skipping browser cleanup to keep it open...');
            this.browser = null;
    }

    async getBrowser() {
        if (!this.browser) {
            await this.initialize();
        }
        return this.browser;
    }

    async newPage() {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        return page;
    }
}

module.exports = BrowserManager; 